export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM products ORDER BY updated_at DESC").all();
    
    // 將儲存的 JSON 字串轉回物件結構供前端使用
    const products = results.map(p => ({
      ...p,
      car_models: p.car_models ? JSON.parse(p.car_models) : [],
      images: p.images ? JSON.parse(p.images) : [],
      part_numbers: p.part_numbers ? JSON.parse(p.part_numbers) : []
    }));

    return Response.json(products);
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    const stmt = context.env.DB.prepare(`
      INSERT INTO products (p_id, name, car_models, category, images, part_numbers, brand, stock, specifications, safety_stock, base_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.p_id,
      data.name,
      JSON.stringify(data.car_models || []),
      data.category || '',
      JSON.stringify(data.images || []),
      JSON.stringify(data.part_numbers || []),
      data.brand || '',
      data.stock || 0,
      data.specifications || '',
      data.safety_stock || 0,
      data.base_cost || 0
    );
    
    await stmt.run();
    return Response.json({ success: true, p_id: data.p_id });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    if (!data.p_id) return new Response("Missing p_id", { status: 400 });

    const stmt = context.env.DB.prepare(`
      UPDATE products SET 
        name = ?, car_models = ?, category = ?, images = ?, part_numbers = ?, brand = ?, stock = ?, specifications = ?, safety_stock = ?, base_cost = ?
      WHERE p_id = ?
    `).bind(
      data.name,
      JSON.stringify(data.car_models || []),
      data.category || '',
      JSON.stringify(data.images || []),
      JSON.stringify(data.part_numbers || []),
      data.brand || '',
      data.stock || 0,
      data.specifications || '',
      data.safety_stock || 0,
      data.base_cost || 0,
      data.p_id
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
    if (!id) return new Response("Missing id parameter", { status: 400 });

    await context.env.DB.prepare("DELETE FROM products WHERE p_id = ?").bind(id).run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
