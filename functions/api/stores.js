// functions/api/stores.js
// 儲存/讀取 localStorage 狀態到 D1（供 erpPersistStorage 使用）
// 用一張 key-value 表儲存各個 Zustand store 的 JSON 序列化內容

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT store_key, store_value FROM erp_stores'
    ).all();
    const out = {};
    for (const row of results) {
      try { out[row.store_key] = JSON.parse(row.store_value); } catch { /* skip */ }
    }
    return Response.json(out);
  } catch (err) {
    // 資料表不存在時回傳空物件，不報錯
    return Response.json({});
  }
}

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();
    // 建立資料表（若不存在）
    await context.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS erp_stores (
        store_key TEXT PRIMARY KEY,
        store_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const entries = Object.entries(body);
    if (entries.length === 0) return Response.json({ ok: true, saved: 0 });

    const stmts = entries.map(([k, v]) =>
      context.env.DB.prepare(`
        INSERT INTO erp_stores (store_key, store_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(store_key) DO UPDATE SET
          store_value = excluded.store_value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(k, JSON.stringify(v))
    );
    await context.env.DB.batch(stmts);
    return Response.json({ ok: true, saved: entries.length });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

// POST 也接受（相容性）
export const onRequestPost = onRequestPut;
