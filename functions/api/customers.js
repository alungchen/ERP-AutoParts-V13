// functions/api/customers.js
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const row = await context.env.DB.prepare('SELECT * FROM customers WHERE cust_id = ?').bind(id).first();
      if (!row) return new Response('Not found', { status: 404 });
      return Response.json({ ...row, full_invoice: !!row.full_invoice });
    }
    const { results } = await context.env.DB.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    return Response.json(results.map(r => ({ ...r, full_invoice: !!r.full_invoice })));
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const d = await context.request.json();
    await context.env.DB.prepare(`
      INSERT INTO customers (cust_id, customer_code, name, contact_name, responsible_person, email,
        payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
        zip_code, website, closing_day, collection_day, region_code, accounting_code, address,
        delivery_address, salesperson, full_invoice, country, currency, tier, credit_limit, notes, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(cust_id) DO UPDATE SET
        customer_code=excluded.customer_code, name=excluded.name, contact_name=excluded.contact_name,
        responsible_person=excluded.responsible_person, email=excluded.email,
        payment_terms=excluded.payment_terms, phone1=excluded.phone1, phone2=excluded.phone2,
        mobile=excluded.mobile, fax=excluded.fax, tax_id=excluded.tax_id,
        invoice_title=excluded.invoice_title, invoice_address=excluded.invoice_address,
        zip_code=excluded.zip_code, website=excluded.website, closing_day=excluded.closing_day,
        collection_day=excluded.collection_day, region_code=excluded.region_code,
        accounting_code=excluded.accounting_code, address=excluded.address,
        delivery_address=excluded.delivery_address, salesperson=excluded.salesperson,
        full_invoice=excluded.full_invoice, country=excluded.country, currency=excluded.currency,
        tier=excluded.tier, credit_limit=excluded.credit_limit, notes=excluded.notes,
        updated_at=CURRENT_TIMESTAMP
    `).bind(
      d.cust_id, d.customer_code||'', d.name||'', d.contact_name||'', d.responsible_person||'',
      d.email||'', d.payment_terms||'', d.phone1||'', d.phone2||'', d.mobile||'', d.fax||'',
      d.tax_id||'', d.invoice_title||'', d.invoice_address||'', d.zip_code||'', d.website||'',
      d.closing_day||'', d.collection_day||'', d.region_code||'', d.accounting_code||'',
      d.address||'', d.delivery_address||'', d.salesperson||'', d.full_invoice ? 1 : 0,
      d.country||'Taiwan', d.currency||'TWD', d.tier||'B', d.credit_limit||0, d.notes||''
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
      await context.env.DB.prepare('DELETE FROM customers').run();
      return Response.json({ success: true, cleared: true });
    }
    if (!id) return new Response('Missing id', { status: 400 });
    await context.env.DB.prepare('DELETE FROM customers WHERE cust_id = ?').bind(id).run();
    return Response.json({ success: true });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
