const safeParseJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const includeImages = url.searchParams.get('includeImages') === '1' || Boolean(id);

    // 單筆查詢（含照片，供抽屜用）
    if (id) {
      const p = await context.env.DB.prepare(
        'SELECT p_id, name, car_models, category, images, part_numbers, brand, specifications, safety_stock, base_cost, updated_at FROM products WHERE p_id = ?'
      ).bind(id).first();
      if (!p) return new Response('Not found', { status: 404 });

      const { results: stockDetails } = await context.env.DB.prepare(
        'SELECT branch_id, location_code, qty FROM product_stock WHERE p_id = ?'
      ).bind(id).all();
      const stockMap = new Map([[id, (stockDetails || []).map((row) => ({
        branch_id: row.branch_id,
        location_code: row.location_code,
        qty: row.qty,
      }))]]);
      return Response.json(mapProductRow(p, stockMap, true));
    }

    // 分頁列表（預設每頁 1500，避免 Cloudflare Worker CPU / 回應逾時）
    const limitRaw = parseInt(url.searchParams.get('limit') || '1500', 10);
    const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 1500, 1), 3000);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

    const countRow = await context.env.DB.prepare('SELECT COUNT(*) AS total FROM products').first();
    const total = Number(countRow?.total) || 0;

    const cols = includeImages
      ? 'p_id, name, car_models, category, images, part_numbers, brand, specifications, safety_stock, base_cost, updated_at'
      : 'p_id, name, car_models, category, part_numbers, brand, specifications, safety_stock, base_cost, updated_at';

    const { results: products } = await context.env.DB.prepare(
      `SELECT ${cols} FROM products ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    const { results: stockDetails } = await context.env.DB.prepare(
      'SELECT p_id, branch_id, location_code, qty FROM product_stock'
    ).all();

    const stockMap = new Map();
    for (const row of stockDetails || []) {
      if (!stockMap.has(row.p_id)) stockMap.set(row.p_id, []);
      stockMap.get(row.p_id).push({
        branch_id: row.branch_id,
        location_code: row.location_code,
        qty: row.qty,
      });
    }

    const items = (products || []).map((p) => mapProductRow(p, stockMap, includeImages));
    return Response.json({
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    if (!data.p_id) {
      return new Response("Missing p_id", { status: 400 });
    }
    
    // 1. 新增產品主檔
    const stmt1 = context.env.DB.prepare(`
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
    const stmtDelete = context.env.DB.prepare("DELETE FROM product_stock WHERE p_id = ?").bind(data.p_id);
    
    const batchStatements = [stmt1, stmtDelete];
    
    // 3. 插入新的多分店多庫位資料
    if (data.stock_details && Array.isArray(data.stock_details) && data.stock_details.length > 0) {
      for (const item of data.stock_details) {
        if (item.branch_id && item.location_code) {
          batchStatements.push(
            context.env.DB.prepare(`
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
        context.env.DB.prepare(`
          INSERT INTO product_stock (p_id, branch_id, location_code, qty)
          VALUES (?, 'songshan', 'A1', ?)
        `).bind(
          data.p_id,
          parseInt(data.stock) || 0
        )
      );
    }
    
    await context.env.DB.batch(batchStatements);
    return Response.json({ success: true, p_id: data.p_id });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const data = await context.request.json();
    if (!data.p_id) return new Response("Missing p_id", { status: 400 });

    // 1. 更新產品主檔
    const stmt1 = context.env.DB.prepare(`
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
    const stmtDelete = context.env.DB.prepare("DELETE FROM product_stock WHERE p_id = ?").bind(data.p_id);
    
    const batchStatements = [stmt1, stmtDelete];
    
    // 3. 插入新的多分店多庫位資料
    if (data.stock_details && Array.isArray(data.stock_details) && data.stock_details.length > 0) {
      for (const item of data.stock_details) {
        if (item.branch_id && item.location_code) {
          batchStatements.push(
            context.env.DB.prepare(`
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
        context.env.DB.prepare(`
          INSERT INTO product_stock (p_id, branch_id, location_code, qty)
          VALUES (?, 'songshan', 'A1', ?)
        `).bind(
          data.p_id,
          parseInt(data.stock) || 0
        )
      );
    }
    
    await context.env.DB.batch(batchStatements);
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

    // 產品被刪除時，外鍵級聯 (ON DELETE CASCADE) 會自動刪除 product_stock 表中的對應紀錄
    await context.env.DB.prepare("DELETE FROM products WHERE p_id = ?").bind(id).run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
