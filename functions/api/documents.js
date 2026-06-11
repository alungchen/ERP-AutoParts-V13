const STOCK_IMPACT = {
    purchase: 1,       // 進貨：+qty
    sales: -1,         // 銷貨：-qty
    salesReturn: 1,    // 銷退：+qty
    purchaseReturn: -1 // 進退：-qty
};

export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        const branchId = request.headers.get('X-Active-Branch') || 'songshan';
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const datePrefix = url.searchParams.get('datePrefix');
        const docIdLike = url.searchParams.get('docIdLike');
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = 'SELECT * FROM documents WHERE branch_id = ?';
        const params = [branchId];

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        if (datePrefix) {
            query += ' AND date LIKE ?';
            params.push(`${datePrefix}%`);
        }
        if (docIdLike) {
            query += ' AND doc_id LIKE ?';
            params.push(`%${docIdLike}%`);
        }
        
        query += ' ORDER BY date DESC, updated_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const { results: docs } = await env.DB.prepare(query).bind(...params).all();

        // Fetch items for these docs in a single query
        if (docs && docs.length > 0) {
            let itemQuery = 'SELECT * FROM document_items WHERE doc_id IN (SELECT doc_id FROM documents WHERE branch_id = ?';
            const itemParams = [branchId];
            if (type) {
                itemQuery += ' AND type = ?';
                itemParams.push(type);
            }
            if (datePrefix) {
                itemQuery += ' AND date LIKE ?';
                itemParams.push(`${datePrefix}%`);
            }
            if (docIdLike) {
                itemQuery += ' AND doc_id LIKE ?';
                itemParams.push(`%${docIdLike}%`);
            }
            itemQuery += ' ORDER BY date DESC, updated_at DESC LIMIT ? OFFSET ?)';
            itemParams.push(limit, offset);

            const { results: allItems } = await env.DB.prepare(itemQuery).bind(...itemParams).all();
            
            // Map items to docs using a Map for O(N + M) complexity to prevent CPU timeout (Error 1102)
            const itemsMap = new Map();
            if (allItems) {
                for (const item of allItems) {
                    if (!itemsMap.has(item.doc_id)) {
                        itemsMap.set(item.doc_id, []);
                    }
                    itemsMap.get(item.doc_id).push(item);
                }
            }
            docs.forEach(doc => {
                doc.items = itemsMap.get(doc.doc_id) || [];
            });
        }

        return new Response(JSON.stringify(docs || []), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const branchId = request.headers.get('X-Active-Branch') || 'songshan';
        const body = await request.json();
        
        const { items, ...doc } = body;
        if (!doc.doc_id || !doc.type || !doc.date) {
            return new Response(JSON.stringify({ error: 'Missing required document fields' }), { status: 400 });
        }

        const newBranchId = doc.branch_id || branchId;
        const docToInsert = {
            ...doc,
            branch_id: newBranchId
        };

        // 1. 查詢舊單據與舊品項 (包含原本的庫位，用於 Revert 補償)
        const oldDoc = await env.DB.prepare('SELECT type, branch_id FROM documents WHERE doc_id = ?').bind(doc.doc_id).first();
        let oldItems = [];
        if (oldDoc) {
            const { results } = await env.DB.prepare('SELECT p_id, qty, location_code FROM document_items WHERE doc_id = ?').bind(doc.doc_id).all();
            oldItems = results || [];
        }

        // 2. 組裝批次交易 statements
        const batchStatements = [];

        // A. 舊單據庫存補償 (Revert)
        if (oldDoc && STOCK_IMPACT[oldDoc.type] !== undefined) {
            const oldImpact = STOCK_IMPACT[oldDoc.type];
            const revertMultiplier = -oldImpact; 
            
            for (const item of oldItems) {
                if (!item.p_id || item.p_id.trim() === '') continue;
                const loc = (item.location_code || 'A1').trim().toUpperCase();
                const qtyVal = Number(item.qty) || 0;
                if (qtyVal === 0) continue;

                // 確保庫存記錄存在
                batchStatements.push(
                    env.DB.prepare('INSERT OR IGNORE INTO product_stock (p_id, branch_id, location_code, qty) VALUES (?, ?, ?, 0)')
                        .bind(item.p_id, oldDoc.branch_id, loc)
                );
                // 更新數量
                batchStatements.push(
                    env.DB.prepare('UPDATE product_stock SET qty = qty + ? WHERE p_id = ? AND branch_id = ? AND location_code = ?')
                        .bind(revertMultiplier * qtyVal, item.p_id, oldDoc.branch_id, loc)
                );
            }
        }

        // B. 寫入或更新單據本身與品項
        const columns = Object.keys(docToInsert);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(k => docToInsert[k]);

        batchStatements.push(
            env.DB.prepare(`INSERT OR REPLACE INTO documents (${columns.join(',')}) VALUES (${placeholders})`).bind(...values)
        );

        // 刪除舊品項
        batchStatements.push(
            env.DB.prepare('DELETE FROM document_items WHERE doc_id = ?').bind(doc.doc_id)
        );

        // 插入新品項 (包含 location_code 欄位)
        if (items && items.length > 0) {
            items.forEach(item => {
                const loc = (item.location_code || 'A1').trim().toUpperCase();
                batchStatements.push(
                    env.DB.prepare('INSERT INTO document_items (doc_id, p_id, name, part_number, qty, unit_price, unit, note, location_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                        .bind(
                            doc.doc_id,
                            item.p_id || '',
                            item.name || '',
                            item.part_number || '',
                            Number(item.qty) || 1,
                            Number(item.unit_price) || 0,
                            item.unit || 'PCS',
                            item.note || '',
                            loc
                        )
                );
            });
        }

        // C. 新單據庫存套用 (Apply)
        if (STOCK_IMPACT[docToInsert.type] !== undefined) {
            const newImpact = STOCK_IMPACT[docToInsert.type];
            
            for (const item of (items || [])) {
                if (!item.p_id || item.p_id.trim() === '') continue;
                const loc = (item.location_code || 'A1').trim().toUpperCase();
                const qtyVal = Number(item.qty) || 0;
                if (qtyVal === 0) continue;

                // 確保庫存記錄存在
                batchStatements.push(
                    env.DB.prepare('INSERT OR IGNORE INTO product_stock (p_id, branch_id, location_code, qty) VALUES (?, ?, ?, 0)')
                        .bind(item.p_id, newBranchId, loc)
                );
                // 更新數量 (進貨+1 則加數量，銷貨-1 則減數量)
                batchStatements.push(
                    env.DB.prepare('UPDATE product_stock SET qty = qty + ? WHERE p_id = ? AND branch_id = ? AND location_code = ?')
                        .bind(newImpact * qtyVal, item.p_id, newBranchId, loc)
                );
            }
        }

        // 4. 批次提交交易
        if (batchStatements.length > 0) {
            await env.DB.batch(batchStatements);
        }

        return new Response(JSON.stringify({ success: true, doc_id: doc.doc_id }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPut(context) {
    return onRequestPost(context); // Same logic for updates (INSERT OR REPLACE)
}

export async function onRequestDelete(context) {
    try {
        const { request, env } = context;
        const branchId = request.headers.get('X-Active-Branch') || 'songshan';
        const url = new URL(request.url);
        const doc_id = url.searchParams.get('doc_id');

        if (!doc_id) {
            return new Response(JSON.stringify({ error: 'Missing doc_id' }), { status: 400 });
        }

        // 1. 查詢舊單據與舊品項 (用於 Revert 補償)
        const oldDoc = await env.DB.prepare('SELECT type, branch_id FROM documents WHERE doc_id = ?').bind(doc_id).first();
        let oldItems = [];
        if (oldDoc) {
            const { results } = await env.DB.prepare('SELECT p_id, qty, location_code FROM document_items WHERE doc_id = ?').bind(doc_id).all();
            oldItems = results || [];
        }

        // 2. 組裝批次交易 statements
        const batchStatements = [];

        // A. 舊單據庫存補償 (Revert)
        if (oldDoc && STOCK_IMPACT[oldDoc.type] !== undefined) {
            const oldImpact = STOCK_IMPACT[oldDoc.type];
            const revertMultiplier = -oldImpact; 
            
            for (const item of oldItems) {
                if (!item.p_id || item.p_id.trim() === '') continue;
                const loc = (item.location_code || 'A1').trim().toUpperCase();
                const qtyVal = Number(item.qty) || 0;
                if (qtyVal === 0) continue;

                // 確保庫存記錄存在
                batchStatements.push(
                    env.DB.prepare('INSERT OR IGNORE INTO product_stock (p_id, branch_id, location_code, qty) VALUES (?, ?, ?, 0)')
                        .bind(item.p_id, oldDoc.branch_id, loc)
                );
                // 更新數量
                batchStatements.push(
                    env.DB.prepare('UPDATE product_stock SET qty = qty + ? WHERE p_id = ? AND branch_id = ? AND location_code = ?')
                        .bind(revertMultiplier * qtyVal, item.p_id, oldDoc.branch_id, loc)
                );
            }
        }

        // B. 刪除品項與單據
        batchStatements.push(
            env.DB.prepare('DELETE FROM document_items WHERE doc_id = ?').bind(doc_id)
        );
        batchStatements.push(
            env.DB.prepare('DELETE FROM documents WHERE doc_id = ? AND branch_id = ?').bind(doc_id, branchId)
        );

        // 4. 批次提交交易
        if (batchStatements.length > 0) {
            await env.DB.batch(batchStatements);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
