export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // 產生一個唯一檔名
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // 存入 R2 bucket
    await context.env.BUCKET.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    return Response.json({ success: true, fileName });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get('path');
  
  if (!path) {
    return new Response('Missing path', { status: 400 });
  }
  
  const object = await context.env.BUCKET.get(path);
  if (object === null) {
    return new Response('Object Not Found', { status: 404 });
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Cache headers to make images load fast
  headers.set('Cache-Control', 'public, max-age=31536000');
  
  return new Response(object.body, { headers });
}
