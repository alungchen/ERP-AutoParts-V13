// functions/api/branches.js
export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT branch_id, name, phone, address FROM branches ORDER BY created_at ASC'
    ).all();
    return Response.json(results);
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
