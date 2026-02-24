/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function App() {
  const [url, setUrl] = useState('https://haildrop77.pro/_v7/1045ce04cf93fecf1a122479cf6cc60a8a623f0f88ece419a1542ac6bd14900a487811db96433b34404f75ea74d12164a1369aa23a254d64a11101e7e0b69cc26301b113ffa35aa2b95fb23e51924c82c39cbc81961b13eeb6aea806865926e2b8086fb2be5c8588605be638385e2e57046da8254cec04f8b0d1e0fbde3787cd/master.m3u8');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const handlePlay = () => {
    if (!videoRef.current) return;

    const encodedUrl = btoa(url);
    const proxyUrl = `/proxy?url=${encodeURIComponent(encodedUrl)}`;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(e => console.error('Playback error:', e));
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = proxyUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play().catch(e => console.error('Playback error:', e));
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-medium tracking-tight">HLS Proxy Player</h1>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter m3u8 URL..."
          />
          <button 
            onClick={handlePlay}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors cursor-pointer"
          >
            Play
          </button>
        </div>

        <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
          <video 
            ref={videoRef}
            controls 
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
