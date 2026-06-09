export async function onRequestGet(context) {
  try {
    // 1. 查詢所有產品主檔
    const { results: products } = await context.env.DB.prepare("SELECT * FROM products ORDER BY updated_at DESC").all();
    
    // 2. 查詢所有產品的庫存明細
    const { results: stockDetails } = await context.env.DB.prepare("SELECT * FROM product_stock").all();
    
    // 將庫存明細按 p_id 分組
    const stockMap = new Map();
    for (const row of stockDetails) {
      if (!stockMap.has(row.p_id)) {
        stockMap.set(row.p_id, []);
      }
      stockMap.get(row.p_id).push({
        branch_id: row.branch_id,
        location_code: row.location_code,
        qty: row.qty
      });
    }

    // 將儲存的 JSON 字串與庫存明細整合回物件結構
    const productsWithStock = products.map(p => {
      const details = stockMap.get(p.p_id) || [];
      const totalStock = details.reduce((sum, item) => sum + item.qty, 0);
      
      return {
        ...p,
        car_models: p.car_models ? JSON.parse(p.car_models) : [],
        images: p.images ? JSON.parse(p.images) : [],
        part_numbers: p.part_numbers ? JSON.parse(p.part_numbers) : [],
        stock: totalStock, // 保留原欄位以向下相容舊介面
        stock_details: details // 新增的多分店、多庫位明細欄位
      };
    });

    return Response.json(productsWithStock);
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
