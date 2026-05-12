export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const limit = url.searchParams.get('limit') || 100;
        const offset = url.searchParams.get('offset') || 0;
        
        let query = 'SELECT * FROM documents';
        const params = [];

        if (type) {
            query += ' WHERE type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY date DESC, updated_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const { results: docs } = await env.DB.prepare(query).bind(...params).all();

        // Fetch items for these docs
        if (docs && docs.length > 0) {
            const docIds = docs.map(d => d.doc_id);
            let allItems = [];
            
            // Split docIds into chunks of 50 to avoid "too many SQL variables" error
            const chunkSize = 50;
            for (let i = 0; i < docIds.length; i += chunkSize) {
                const chunk = docIds.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const { results } = await env.DB.prepare(`SELECT * FROM document_items WHERE doc_id IN (${placeholders})`).bind(...chunk).all();
                if (results) {
                    allItems = allItems.concat(results);
                }
            }
            
            // Map items to docs
            docs.forEach(doc => {
                doc.items = allItems.filter(item => item.doc_id === doc.doc_id);
            });
        }

        return new Response(JSON.stringify(docs || []), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();
        
        const { items, ...doc } = body;
        if (!doc.doc_id || !doc.type || !doc.date) {
            return new Response(JSON.stringify({ error: 'Missing required document fields' }), { status: 400 });
        }

        // Insert document
        const columns = Object.keys(doc);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(k => doc[k]);

        await env.DB.prepare(`INSERT OR REPLACE INTO documents (${columns.join(',')}) VALUES (${placeholders})`).bind(...values).run();

        // Insert items
        if (items && items.length > 0) {
            // Delete old items if any
            await env.DB.prepare('DELETE FROM document_items WHERE doc_id = ?').bind(doc.doc_id).run();
            
            const batchStatements = items.map(item => {
                return env.DB.prepare(`INSERT INTO document_items (doc_id, p_id, name, part_number, qty, unit_price, unit, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                    .bind(
                        doc.doc_id,
                        item.p_id || '',
                        item.name || '',
                        item.part_number || '',
                        item.qty || 1,
                        item.unit_price || 0,
                        item.unit || 'PCS',
                        item.note || ''
                    );
            });
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
        const url = new URL(request.url);
        const doc_id = url.searchParams.get('doc_id');

        if (!doc_id) {
            return new Response(JSON.stringify({ error: 'Missing doc_id' }), { status: 400 });
        }

        // document_items has ON DELETE CASCADE, but D1 doesn't support PRAGMA foreign_keys reliably without explicitly enabling, so let's delete manually just in case
        await env.DB.prepare('DELETE FROM document_items WHERE doc_id = ?').bind(doc_id).run();
        await env.DB.prepare('DELETE FROM documents WHERE doc_id = ?').bind(doc_id).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
