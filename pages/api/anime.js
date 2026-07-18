// pages/api/anime.js
import { NextApiRequest, NextApiResponse } from 'next';

const GIST_RAW_URL = 'https://gist.githubusercontent.com/jv8784815-ctrl/c520f9db26b1b30f2d58cd761921ed76/raw/anime-tunnel.json';

let cachedBaseUrl = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

async function getBackendUrl() {
  const now = Date.now();
  if (cachedBaseUrl && now - lastFetchTime < CACHE_DURATION) {
    return cachedBaseUrl;
  }

  try {
    const res = await fetch(GIST_RAW_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Gist error: ${res.status}`);
    const data = await res.json();
    const baseUrl = data.tunnel?.trimEnd('/');
    if (!baseUrl) throw new Error('No tunnel URL found in Gist');
    cachedBaseUrl = baseUrl;
    lastFetchTime = now;
    console.log(`[proxy] Backend URL actualizado: ${baseUrl}`);
    return baseUrl;
  } catch (error) {
    console.error('[proxy] Error al leer Gist:', error.message);
    if (cachedBaseUrl) {
      console.warn('[proxy] Usando URL en caché.');
      return cachedBaseUrl;
    }
    throw error;
  }
}

export default async function handler(req, res) {
  try {
    const backendBaseUrl = await getBackendUrl();
    const { path = [] } = req.query;
    const backendPath = Array.isArray(path) ? path.join('/') : path;
    const backendUrl = `${backendBaseUrl}/${backendPath}`;

    const proxyRes = await fetch(backendUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        connection: undefined,
        host: undefined,
        cookie: undefined,
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await proxyRes.json();

    res.status(proxyRes.status).json(data);
  } catch (error) {
    console.error('[proxy] Error:', error.message);
    res.status(500).json({ error: 'Error interno del proxy' });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
