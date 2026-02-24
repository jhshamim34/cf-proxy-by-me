import express from 'express';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  try {
    const encodedUrl = req.query.url as string;
    if (!encodedUrl) {
      return res.status(400).send('Missing url parameter');
    }

    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    const headers = {
      'Referer': 'https://megacloud.com/',
      'Origin': 'https://megacloud.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const response = await axios.get(targetUrl, { 
      headers, 
      responseType: 'stream',
      validateStatus: () => true // Don't throw on error status codes
    });

    const finalUrl = response.request?.res?.responseUrl || targetUrl;

    const contentType = response.headers['content-type'] || '';
    const isM3u8Response = contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || finalUrl.includes('.m3u8') || req.query.type === 'm3u8';

    if (isM3u8Response) {
      // Read the stream into memory
      let manifest = '';
      for await (const chunk of response.data) {
        manifest += chunk;
      }

      // Rewrite URLs
      const lines = manifest.split('\n');
      const rewrittenLines = lines.map((line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return line;

        const rewriteUrl = (urlStr: string) => {
          let absoluteUrl = urlStr;
          if (!urlStr.startsWith('http')) {
            try {
              const baseUrl = new URL(finalUrl);
              absoluteUrl = new URL(urlStr, baseUrl).href;
            } catch (e) {
              return urlStr;
            }
          }
          const encodedAbsoluteUrl = Buffer.from(absoluteUrl).toString('base64');
          return `/proxy?url=${encodeURIComponent(encodedAbsoluteUrl)}${absoluteUrl.includes('.m3u8') ? '&type=m3u8' : ''}`;
        };

        if (!trimmedLine.startsWith('#')) {
          // It's a segment or sub-playlist URL
          return rewriteUrl(trimmedLine);
        }

        // Handle URI attributes in tags
        if (trimmedLine.includes('URI="')) {
          return trimmedLine.replace(/URI="([^"]+)"/g, (match, uri) => {
            return `URI="${rewriteUrl(uri)}"`;
          });
        }

        return line; // Return original line with original whitespace if unmodified
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.status(response.status);
      res.send(rewrittenLines.join('\n'));
    } else {
      // Stream segments (.ts, .m4s, etc.)
      // Forward headers
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length'] && !response.headers['content-encoding']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      
      res.status(response.status);
      response.data.pipe(res);
    }
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(500).send('Error fetching target URL');
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
