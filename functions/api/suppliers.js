// functions/api/suppliers.js
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const row = await context.env.DB.prepare('SELECT * FROM suppliers WHERE sup_id = ?').bind(id).first();
      if (!row) return new Response('Not found', { status: 404 });
      return Response.json({ ...row, categories: row.categories ? JSON.parse(row.categories) : [] });
    }
    const { results } = await context.env.DB.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    return Response.json(results.map(r => ({ ...r, categories: r.categories ? JSON.parse(r.categories) : [] })));
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const d = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO suppliers (sup_id, supplier_code, name, contact_name, responsible_person, email,
        payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
        zip_code, website, closing_day, region_code, accounting_code, address, country, currency,
        categories, rating, notes, tier, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(sup_id) DO UPDATE SET
        supplier_code=excluded.supplier_code, name=excluded.name, contact_name=excluded.contact_name,
        responsible_person=excluded.responsible_person, email=excluded.email,
        payment_terms=excluded.payment_terms, phone1=excluded.phone1, phone2=excluded.phone2,
        mobile=excluded.mobile, fax=excluded.fax, tax_id=excluded.tax_id,
        invoice_title=excluded.invoice_title, invoice_address=excluded.invoice_address,
        zip_code=excluded.zip_code, website=excluded.website, closing_day=excluded.closing_day,
        region_code=excluded.region_code, accounting_code=excluded.accounting_code,
        address=excluded.address, country=excluded.country, currency=excluded.currency,
        categories=excluded.categories, rating=excluded.rating, notes=excluded.notes,
        tier=excluded.tier, updated_at=CURRENT_TIMESTAMP
    `).bind(
      d.sup_id, d.supplier_code||'', d.name||'', d.contact_name||'', d.responsible_person||'',
      d.email||'', d.payment_terms||'', d.phone1||'', d.phone2||'', d.mobile||'', d.fax||'',
      d.tax_id||'', d.invoice_title||'', d.invoice_address||'', d.zip_code||'', d.website||'',
      d.closing_day||'', d.region_code||'', d.accounting_code||'', d.address||'',
      d.country||'Taiwan', d.currency||'TWD',
      JSON.stringify(d.categories||[]), d.rating||0, d.notes||'', d.tier||'B'
    ).run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPut(context) {
  return onRequestPost(context);
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const clearAll = url.searchParams.get('clearAll');
    if (clearAll === '1') {
      await context.env.DB.prepare('DELETE FROM suppliers').run();
      return Response.json({ success: true, cleared: true });
    }
    if (!id) return new Response('Missing id', { status: 400 });
    await context.env.DB.prepare('DELETE FROM suppliers WHERE sup_id = ?').bind(id).run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
