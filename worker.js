export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        }
      });
    }

    if (url.pathname === '/proxy') {
      const encodedUrl = url.searchParams.get('url');
      if (!encodedUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      try {
        const targetUrl = atob(encodedUrl);
        
        // Standard headers for the proxy request
        const headers = new Headers({
          'Referer': 'https://megacloud.com/',
          'Origin': 'https://megacloud.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        });

        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: headers,
          redirect: 'follow'
        });

        const finalUrl = response.url;
        const contentType = response.headers.get('content-type') || '';
        const isM3u8Response = contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || finalUrl.includes('.m3u8') || url.searchParams.get('type') === 'm3u8';

        const proxyHeaders = new Headers();
        // Ensure CORS is allowed for the player
        proxyHeaders.set('Access-Control-Allow-Origin', '*');
        
        if (isM3u8Response) {
          const manifest = await response.text();
          const lines = manifest.split('\n');
          const rewrittenLines = lines.map(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return line;

            const rewriteUrl = (urlStr) => {
              let absoluteUrl = urlStr;
              if (!urlStr.startsWith('http')) {
                try {
                  const baseUrl = new URL(finalUrl);
                  absoluteUrl = new URL(urlStr, baseUrl).href;
                } catch (e) {
                  return urlStr;
                }
              }
              const encodedAbsoluteUrl = btoa(absoluteUrl);
              return `/proxy?url=${encodeURIComponent(encodedAbsoluteUrl)}${absoluteUrl.includes('.m3u8') ? '&type=m3u8' : ''}`;
            };

            if (!trimmedLine.startsWith('#')) {
              return rewriteUrl(trimmedLine);
            }

            if (trimmedLine.includes('URI="')) {
              return trimmedLine.replace(/URI="([^"]+)"/g, (match, uri) => {
                return `URI="${rewriteUrl(uri)}"`;
              });
            }

            return line;
          });

          proxyHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
          return new Response(rewrittenLines.join('\n'), {
            status: response.status,
            headers: proxyHeaders
          });
        } else {
          // Stream segments directly
          if (response.headers.has('content-type')) {
            proxyHeaders.set('Content-Type', response.headers.get('content-type'));
          }
          if (response.headers.has('content-length') && !response.headers.has('content-encoding')) {
            proxyHeaders.set('Content-Length', response.headers.get('content-length'));
          }

          return new Response(response.body, {
            status: response.status,
            headers: proxyHeaders
          });
        }
      } catch (error) {
        return new Response('Error fetching target URL', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
