// functions/api/login-logs.js
// 使用者登入紀錄：POST 寫入一筆（成功/被擋都記）、GET 讀取最近紀錄

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      emp_id TEXT,
      emp_name TEXT,
      result TEXT NOT NULL,
      reason TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    await ensureTable(db);

    const body = await context.request.json().catch(() => ({}));
    const result = String(body.result || '').slice(0, 20);
    if (!['success', 'denied', 'failed'].includes(result)) {
      return new Response('invalid result', { status: 400 });
    }

    const ip = context.request.headers.get('CF-Connecting-IP')
      || context.request.headers.get('X-Forwarded-For')
      || '';
    const userAgent = (context.request.headers.get('User-Agent') || '').slice(0, 300);

    await db.prepare(`
      INSERT INTO login_logs (email, emp_id, emp_name, result, reason, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(body.email || '').slice(0, 200),
      String(body.emp_id || '').slice(0, 50),
      String(body.emp_name || '').slice(0, 100),
      result,
      String(body.reason || '').slice(0, 300),
      ip,
      userAgent
    ).run();

    return Response.json({ ok: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    await ensureTable(db);

    const url = new URL(context.request.url);
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100));

    const { results } = await db.prepare(
      'SELECT id, email, emp_id, emp_name, result, reason, ip, created_at FROM login_logs ORDER BY id DESC LIMIT ?'
    ).bind(limit).all();

    return Response.json(results || []);
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
