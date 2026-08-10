/**
 * 本機 wrangler dev：Zustand 快照 + 產品 CRUD + R2 圖片
 * （與 Pages Functions 邏輯對齊，方便 npm run dev:all）
 */

const STORE_KEYS = new Set([
    'erp-app-store',
    'erp-document-store',
    'erp-customer-store',
    'erp-supplier-store',
    'erp-employee-store',
    'erp-sourcing-store',
    'erp-shorthand-store',
    'erp-import-estimates',
    'erp-settlement-store',
]);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    });
}

async function ensureSnapshotSchema(env) {
    await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS store_snapshots (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
    ).run();
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/' || path === '/favicon.ico') {
            return json({
                ok: true,
                hint: '此為 API Worker。請開發前端請用 Vite：http://localhost:5173（/api 會由 Vite 轉發至此）。',
                try: ['/api/health', '/api/db/ping', '/api/stores'],
            });
        }

        if (path === '/api/health') {
            return json({
                ok: true,
                service: 'erp-autoparts-worker',
                time: new Date().toISOString(),
            });
        }

        if (path === '/api/db/ping') {
            try {
                await ensureSnapshotSchema(env);
                const row = await env.DB.prepare('SELECT 1 AS ok').first();
                return json({ ok: true, d1: row, binding: 'DB' });
            } catch (err) {
                return json({ ok: false, error: err?.message || String(err) }, 500);
            }
        }

        if (path === '/api/stores' && request.method === 'GET') {
            try {
                await ensureSnapshotSchema(env);
                const { results } = await env.DB.prepare('SELECT id, payload FROM store_snapshots').all();
                const stores = {};
                for (const row of results || []) {
                    try {
                        stores[row.id] = JSON.parse(row.payload);
                    } catch {
                        /* skip */
                    }
                }
                return json({ ok: true, stores });
            } catch (err) {
                return json({ ok: false, error: err?.message || String(err) }, 500);
            }
        }

        if (path === '/api/stores' && request.method === 'PUT') {
            try {
                await ensureSnapshotSchema(env);
                const body = await request.json();
                if (!body || typeof body !== 'object') {
                    return json({ ok: false, error: 'Invalid JSON body' }, 400);
                }
                let count = 0;
                for (const [id, value] of Object.entries(body)) {
                    if (!STORE_KEYS.has(id)) continue;
                    const payload =
                        typeof value === 'string' ? value : JSON.stringify(value);
                    await env.DB.prepare(
                        `INSERT INTO store_snapshots (id, payload, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               payload = excluded.payload,
               updated_at = datetime('now')`
                    )
                        .bind(id, payload)
                        .run();
                    count += 1;
                }
                return json({ ok: true, saved: count });
            } catch (err) {
                return json({ ok: false, error: err?.message || String(err) }, 500);
            }
        }

        /* ---------- /api/products（同 functions/api/products.js）---------- */
        if (path === '/api/products' && request.method === 'GET') {
            try {
                const safeParseJson = (value, fallback) => {
                    if (value == null || value === '') return fallback;
                    if (typeof value !== 'string') return value;
                    try { return JSON.parse(value); } catch { return fallback; }
                };
                const mapProductRow = (p, stockMap, includeImages) => {
                    const details = stockMap.get(p.p_id) || [];
                    const totalStock = details.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                    return {
                        p_id: p.p_id,
                        name: p.name,
                        category: p.category || '',
                        brand: p.brand || '',
                        specifications: p.specifications || '',
                        safety_stock: p.safety_stock || 0,
                        base_cost: p.base_cost || 0,
                        updated_at: p.updated_at,
                        car_models: safeParseJson(p.car_models, []),
                        part_numbers: safeParseJson(p.part_numbers, []),
                        images: includeImages ? safeParseJson(p.images, []) : [],
                        stock: totalStock,
                        stock_details: details,
                    };
                };

                const id = url.searchParams.get('id');
                const includeImages = url.searchParams.get('includeImages') === '1' || Boolean(id);

                if (id) {
                    const p = await env.DB.prepare(
                        'SELECT p_id, name, car_models, category, images, part_numbers, brand, specifications, safety_stock, base_cost, updated_at FROM products WHERE p_id = ?'
                    ).bind(id).first();
                    if (!p) return new Response('Not found', { status: 404, headers: corsHeaders });
                    const { results: stockDetails } = await env.DB.prepare(
                        'SELECT branch_id, location_code, qty FROM product_stock WHERE p_id = ?'
                    ).bind(id).all();
                    const stockMap = new Map([[id, (stockDetails || []).map((row) => ({
                        branch_id: row.branch_id,
                        location_code: row.location_code,
                        qty: row.qty,
                    }))]]);
                    return Response.json(mapProductRow(p, stockMap, true), { headers: corsHeaders });
                }

                if (url.searchParams.get('stockOnly') === '1') {
                    const { results: stockDetails } = await env.DB.prepare(
                        'SELECT p_id, branch_id, location_code, qty FROM product_stock'
                    ).all();
                    const stockObj = {};
                    for (const row of stockDetails || []) {
                        if (!stockObj[row.p_id]) stockObj[row.p_id] = [];
                        stockObj[row.p_id].push({
                            branch_id: row.branch_id,
                            location_code: row.location_code,
                            qty: row.qty,
                        });
                    }
                    return Response.json({ stock: stockObj }, { headers: corsHeaders });
                }

                const limitRaw = parseInt(url.searchParams.get('limit') || '500', 10);
                const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10);
                const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 500, 1), 1500);
                const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

                const countRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM products').first();
                const total = Number(countRow?.total) || 0;

                const cols = includeImages
                    ? 'p_id, name, car_models, category, images, part_numbers, brand, specifications, safety_stock, base_cost, updated_at'
                    : 'p_id, name, car_models, category, part_numbers, brand, specifications, safety_stock, base_cost, updated_at';

                const { results: products } = await env.DB.prepare(
                    `SELECT ${cols} FROM products ORDER BY updated_at DESC LIMIT ? OFFSET ?`
                ).bind(limit, offset).all();

                const emptyStock = new Map();
                const items = (products || []).map((p) => mapProductRow(p, emptyStock, includeImages));
                return Response.json({
                    items,
                    total,
                    limit,
                    offset,
                    hasMore: offset + items.length < total,
                }, { headers: corsHeaders });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: corsHeaders });
            }
        }

        if (path === '/api/products' && request.method === 'POST') {
            try {
                const data = await request.json();
                if (!data.p_id) {
                    return new Response("Missing p_id", { status: 400, headers: corsHeaders });
                }

                // 1. 新增產品主檔
                const stmt1 = env.DB.prepare(`
                    INSERT INTO products (p_id, name, car_models, category, images, part_numbers, brand, specifications, safety_stock, base_cost)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    data.p_id,
                    data.name,
                    JSON.stringify(data.car_models || []),
                    data.category || '',
                    JSON.stringify(data.images || []),
                    JSON.stringify(data.part_numbers || []),
                    data.brand || '',
                    data.specifications || '',
                    data.safety_stock || 0,
                    data.base_cost || 0
                );

                // 2. 清理原有的該產品庫存資料
                const stmtDelete = env.DB.prepare("DELETE FROM product_stock WHERE p_id = ?").bind(data.p_id);

                const batchStatements = [stmt1, stmtDelete];

                // 3. 插入新的多分店多庫位資料
                if (data.stock_details && Array.isArray(data.stock_details) && data.stock_details.length > 0) {
                    for (const item of data.stock_details) {
                        if (item.branch_id && item.location_code) {
                            batchStatements.push(
                                env.DB.prepare(`
                                    INSERT INTO product_stock (p_id, branch_id, location_code, qty)
                                    VALUES (?, ?, ?, ?)
                                `).bind(
                                    data.p_id,
                                    item.branch_id,
                                    item.location_code,
                                    parseInt(item.qty) || 0
                                )
                            );
                        }
                    }
                } else {
                    // 降級相容舊調用格式 (預設寫入松山店 A1 庫位)
                    batchStatements.push(
                        env.DB.prepare(`
                            INSERT INTO product_stock (p_id, branch_id, location_code, qty)
                            VALUES (?, 'songshan', 'A1', ?)
                        `).bind(
                            data.p_id,
                            parseInt(data.stock) || 0
                        )
                    );
                }

                await env.DB.batch(batchStatements);
                return Response.json({ success: true, p_id: data.p_id }, { headers: corsHeaders });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: corsHeaders });
            }
        }

        if (path === '/api/products' && request.method === 'PUT') {
            try {
                const data = await request.json();
                if (!data.p_id) return new Response('Missing p_id', { status: 400, headers: corsHeaders });

                // 1. 更新產品主檔
                const stmt1 = env.DB.prepare(`
                    UPDATE products SET
                        name = ?, car_models = ?, category = ?, images = ?, part_numbers = ?, brand = ?, specifications = ?, safety_stock = ?, base_cost = ?
                    WHERE p_id = ?
                `).bind(
                    data.name,
                    JSON.stringify(data.car_models || []),
                    data.category || '',
                    JSON.stringify(data.images || []),
                    JSON.stringify(data.part_numbers || []),
                    data.brand || '',
                    data.specifications || '',
                    data.safety_stock || 0,
                    data.base_cost || 0,
                    data.p_id
                );

                // 2. 清理原有的該產品庫存資料
                const stmtDelete = env.DB.prepare("DELETE FROM product_stock WHERE p_id = ?").bind(data.p_id);

                const batchStatements = [stmt1, stmtDelete];

                // 3. 插入新的多分店多庫位資料
                if (data.stock_details && Array.isArray(data.stock_details) && data.stock_details.length > 0) {
                    for (const item of data.stock_details) {
                        if (item.branch_id && item.location_code) {
                            batchStatements.push(
                                env.DB.prepare(`
                                    INSERT INTO product_stock (p_id, branch_id, location_code, qty)
                                    VALUES (?, ?, ?, ?)
                                `).bind(
                                    data.p_id,
                                    item.branch_id,
                                    item.location_code,
                                    parseInt(item.qty) || 0
                                )
                            );
                        }
                    }
                } else {
                    // 降級相容舊調用格式
                    batchStatements.push(
                        env.DB.prepare(`
                            INSERT INTO product_stock (p_id, branch_id, location_code, qty)
                            VALUES (?, 'songshan', 'A1', ?)
                        `).bind(
                            data.p_id,
                            parseInt(data.stock) || 0
                        )
                    );
                }

                await env.DB.batch(batchStatements);
                return Response.json({ success: true }, { headers: corsHeaders });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: corsHeaders });
            }
        }

        if (path === '/api/products' && request.method === 'DELETE') {
            try {
                const id = url.searchParams.get('id');
                if (!id) return new Response('Missing id parameter', { status: 400, headers: corsHeaders });
                // 產品被刪除時，外鍵級聯 (ON DELETE CASCADE) 會自動刪除 product_stock 表中的對應紀錄
                await env.DB.prepare('DELETE FROM products WHERE p_id = ?').bind(id).run();
                return Response.json({ success: true }, { headers: corsHeaders });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: corsHeaders });
            }
        }

        /* ---------- /api/images（同 functions/api/images.js）---------- */
        if (path === '/api/images' && request.method === 'POST') {
            try {
                const formData = await request.formData();
                const file = formData.get('file');
                if (!file) {
                    return new Response('No file provided', { status: 400, headers: corsHeaders });
                }
                const ext = file.name.split('.').pop() || 'jpg';
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                await env.BUCKET.put(fileName, file.stream(), {
                    httpMetadata: { contentType: file.type },
                });
                return Response.json({ success: true, fileName }, { headers: corsHeaders });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: corsHeaders });
            }
        }

        if (path === '/api/images' && request.method === 'GET') {
            const imgPath = url.searchParams.get('path');
            if (!imgPath) {
                return new Response('Missing path', { status: 400, headers: corsHeaders });
            }
            const object = await env.BUCKET.get(imgPath);
            if (object === null) {
                return new Response('Object Not Found', { status: 404, headers: corsHeaders });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Cache-Control', 'public, max-age=31536000');
            return new Response(object.body, { headers });
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
};
