export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM shorthands").all();
    return Response.json(results);
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // Check if it is a batch operation (array) or a single object
    if (Array.isArray(data)) {
      // D1 does not support large bulk inserts easily in a single string if it's too big, 
      // but for shorthands it's small enough. We will run them in a batch.
      const stmts = data.map(item => 
        context.env.DB.prepare(`
          INSERT INTO shorthands (s_id, type, shorthand, fullname, meta_category)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          item.s_id,
          item.type,
          item.shorthand,
          item.fullname,
          item.meta_category || ''
        )
      );
      
      await context.env.DB.batch(stmts);
      return Response.json({ success: true, count: data.length });
    } else {
      const stmt = context.env.DB.prepare(`
        INSERT INTO shorthands (s_id, type, shorthand, fullname, meta_category)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        data.s_id,
        data.type,
        data.shorthand,
        data.fullname,
        data.meta_category || ''
      );
      
      await stmt.run();
      return Response.json({ success: true, s_id: data.s_id });
    }
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    if (!data.s_id) return new Response("Missing s_id", { status: 400 });

    const stmt = context.env.DB.prepare(`
      UPDATE shorthands SET 
        type = ?, shorthand = ?, fullname = ?, meta_category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE s_id = ?
    `).bind(
      data.type,
      data.shorthand,
      data.fullname,
      data.meta_category || '',
      data.s_id
    );
    
    await stmt.run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const idsParam = url.searchParams.get('ids'); // For batch delete

    if (idsParam) {
      const ids = idsParam.split(',');
      const placeholders = ids.map(() => '?').join(',');
      await context.env.DB.prepare(`DELETE FROM shorthands WHERE s_id IN (${placeholders})`).bind(...ids).run();
    } else if (id) {
      await context.env.DB.prepare("DELETE FROM shorthands WHERE s_id = ?").bind(id).run();
    } else {
       // If clear type is provided
       const type = url.searchParams.get('type');
       if (type) {
         await context.env.DB.prepare("DELETE FROM shorthands WHERE type = ?").bind(type).run();
       } else {
         return new Response("Missing id parameter", { status: 400 });
       }
    }
    
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
