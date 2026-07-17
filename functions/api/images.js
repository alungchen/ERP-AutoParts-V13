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
    // 本機開發（localhost）時，若 local R2 沒有檔案則改向雲端抓取同路徑。
    const isLocalDevHost =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0';

    if (isLocalDevHost) {
      try {
        const fallbackBase = 'https://erp-autoparts-v13.pages.dev';
        const fallbackUrl = `${fallbackBase}/api/images?path=${encodeURIComponent(path)}`;
        const fallbackResp = await fetch(fallbackUrl);
        if (fallbackResp.ok) {
          const headers = new Headers(fallbackResp.headers);
          headers.set('Cache-Control', 'public, max-age=31536000');
          headers.set('x-image-source', 'remote-fallback');
          return new Response(fallbackResp.body, {
            status: fallbackResp.status,
            headers,
          });
        }
      } catch {
        // Ignore fallback error and return local not found.
      }
    }

    return new Response('Object Not Found', { status: 404 });
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Cache headers to make images load fast
  headers.set('Cache-Control', 'public, max-age=31536000');
  headers.set('x-image-source', 'local-r2');
  
  return new Response(object.body, { headers });
}
