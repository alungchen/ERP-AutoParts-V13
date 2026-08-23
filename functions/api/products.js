export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10);
    const activeBranch = context.request.headers.get('X-Active-Branch') || url.searchParams.get('branch_id') || '';

    const safeParseJson = (value, fallback) => {
      if (value == null || value === '') return fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    };

    // 僅回傳庫存表（含所有分店，前端與產品分頁平行載入後合併）
    if (url.searchParams.get('stockOnly') === '1') {
      const { results: stockRows } = await context.env.DB.prepare(
        'SELECT p_id, branch_id, location_code, qty FROM product_stock'
      ).all();
      const stock = {};
      for (const row of stockRows || []) {
        if (!stock[row.p_id]) stock[row.p_id] = [];
        stock[row.p_id].push({ branch_id: row.branch_id, location_code: row.location_code, qty: row.qty });
      }
      return Response.json({ stock }, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
      });
    }

    // rowid 游標分頁：全量載入用，深頁不需 OFFSET 掃描；庫存由 stockOnly 另行合併
    const cursorRaw = url.searchParams.get('cursor');
    if (cursorRaw !== null) {
      const cursor = Number(cursorRaw) || 0;
      const pageSize = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 3000) : 2000;
      const branchFilter = activeBranch
        ? ' AND EXISTS (SELECT 1 FROM product_stock ps WHERE ps.p_id = p.p_id AND ps.branch_id = ?)'
        : '';

      const countBinds = activeBranch ? [activeBranch] : [];
      const countRow = await context.env.DB.prepare(
        `SELECT COUNT(*) AS total FROM products p WHERE 1=1${branchFilter}`
      ).bind(...countBinds).first();
      const total = Number(countRow?.total) || 0;

      const pageBinds = activeBranch ? [cursor, activeBranch, pageSize] : [cursor, pageSize];
      const { results: rows } = await context.env.DB.prepare(
        `SELECT p.rowid AS _rid, p.* FROM products p WHERE p.rowid > ?${branchFilter} ORDER BY p.rowid LIMIT ?`
      ).bind(...pageBinds).all();

      const pageRows = rows || [];
      const items = pageRows.map((row) => {
        const { _rid, ...p } = row;
        return {
          ...p,
          car_models: safeParseJson(p.car_models, []),
          images: safeParseJson(p.images, []),
          part_numbers: safeParseJson(p.part_numbers, []),
          stock: 0,
          stock_details: [],
        };
      });

      return Response.json({
        items,
        total,
        nextCursor: pageRows.length ? pageRows[pageRows.length - 1]._rid : null,
        hasMore: pageRows.length === pageSize,
      }, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
      });
    }

    let products = [];
    let stockDetails = [];

    if (activeBranch) {
      const baseQuery = `
        SELECT p.*
        FROM products p
        INNER JOIN product_stock ps ON ps.p_id = p.p_id AND ps.branch_id = ?
        GROUP BY p.p_id
        ORDER BY p.updated_at DESC
      `;

      const query = Number.isFinite(limit) && limit > 0
        ? `${baseQuery} LIMIT ?`
        : baseQuery;

      const bindValues = Number.isFinite(limit) && limit > 0
        ? [activeBranch, limit]
        : [activeBranch];

      const { results: branchProducts } = await context.env.DB.prepare(query).bind(...bindValues).all();
      products = branchProducts || [];

      const { results: branchStock } = await context.env.DB.prepare(
        'SELECT * FROM product_stock WHERE branch_id = ? ORDER BY p_id ASC'
      ).bind(activeBranch).all();
      stockDetails = branchStock || [];
    } else {
      let productsQuery = 'SELECT * FROM products ORDER BY updated_at DESC';
      const bindValues = [];
      if (Number.isFinite(limit) && limit > 0) {
        productsQuery += ' LIMIT ?';
        bindValues.push(limit);
      }

      const stmt = bindValues.length > 0
        ? context.env.DB.prepare(productsQuery).bind(...bindValues)
        : context.env.DB.prepare(productsQuery);
      const { results: allProducts } = await stmt.all();
      products = allProducts || [];

      const { results: allStock } = await context.env.DB.prepare('SELECT * FROM product_stock').all();
      stockDetails = allStock || [];
    }

    const stockMap = new Map();
    for (const row of stockDetails || []) {
      if (!stockMap.has(row.p_id)) {
        stockMap.set(row.p_id, []);
      }
      stockMap.get(row.p_id).push({
        branch_id: row.branch_id,
        location_code: row.location_code,
        qty: row.qty
      });
    }

    const productsWithStock = (products || []).map(p => {
      const details = stockMap.get(p.p_id) || [];
      const totalStock = details.reduce((sum, item) => sum + item.qty, 0);

      return {
        ...p,
        car_models: p.car_models ? JSON.parse(p.car_models) : [],
        images: p.images ? JSON.parse(p.images) : [],
        part_numbers: p.part_numbers ? JSON.parse(p.part_numbers) : [],
        stock: totalStock,
        stock_details: details
      };
    });

    return Response.json(productsWithStock, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      }
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
