export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  let targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing target URL', { status: 400 });
  }

  try {
    // Cloudflare Workers 可以正常抓取 http 的資源
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer': 'http://cck2.uparts.info/'
      }
    });

    if (!response.ok) {
        return new Response('Proxy Error: ' + response.statusText, { status: response.status });
    }
    
    // Create new response with appropriate CORS headers and cache
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Cache-Control', 'public, max-age=31536000');
    // 確保 Content-Type 正確
    const contentType = response.headers.get('content-type');
    if (contentType) {
        newResponse.headers.set('Content-Type', contentType);
    } else {
        newResponse.headers.set('Content-Type', 'image/jpeg');
    }
    
    return newResponse;
  } catch (err) {
    return new Response('Proxy Exception: ' + err.message, { status: 500 });
  }
}
