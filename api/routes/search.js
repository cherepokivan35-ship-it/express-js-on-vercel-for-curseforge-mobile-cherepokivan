const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

const SEARCH_CACHE_TTL_MS = 30 * 1000;
const searchCache = new Map();

function getHeaders() {
  return {
    'x-api-key': process.env.CURSEFORGE_API_KEY,
    Accept: 'application/json',
  };
}

function setEdgeCache(res) {
  res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
}

router.get('/', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const pageRaw = req.query.page;
    const page = pageRaw === undefined ? 1 : Number.parseInt(String(pageRaw), 10);
    const version = typeof req.query.version === 'string' ? req.query.version.trim() : '';

    if (!q) {
      return res.status(400).json({ error: 'Query param q is required' });
    }

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: 'Query param page must be a positive integer' });
    }

    if (!process.env.CURSEFORGE_API_KEY) {
      return res.status(500).json({ error: 'Server misconfiguration: missing CURSEFORGE_API_KEY' });
    }

    const cacheKey = `${q}|${page}|${version}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setEdgeCache(res);
      return res.status(200).json(cached.payload);
    }

    const params = new URLSearchParams({
      searchFilter: q,
      gameId: '432',
      page: String(page),
      pageSize: '20',
      index: String((page - 1) * 20),
    });

    const cfResponse = await fetch(`https://api.curseforge.com/v1/mods/search?${params.toString()}`, {
      headers: getHeaders(),
    });

    if (!cfResponse.ok) {
      const snippet = await cfResponse.text();
      console.error('[CurseForge/search] status=', cfResponse.status, 'snippet=', snippet.slice(0, 200));
      return res.status(502).json({ error: 'Failed to fetch data from CurseForge' });
    }

    const json = await cfResponse.json();
    const mods = Array.isArray(json?.data) ? json.data : [];

    let filteredMods = mods;
    if (version) {
      filteredMods = mods.filter((mod) =>
        Array.isArray(mod?.latestFilesIndexes)
          ? mod.latestFilesIndexes.some((idx) => idx?.gameVersion === version)
          : false
      );
    }

    const payload = {
      page,
      pageSize: Number(json?.pagination?.pageSize) || 20,
      total: Number(json?.pagination?.totalCount) || filteredMods.length,
      results: filteredMods.map((mod) => {
        const latestFile = Array.isArray(mod?.latestFiles) ? mod.latestFiles[0] : null;
        const latestFileIndex = Array.isArray(mod?.latestFilesIndexes) ? mod.latestFilesIndexes[0] : null;

        return {
          id: mod?.id ?? null,
          name: mod?.name ?? null,
          summary: mod?.summary ?? null,
          author: Array.isArray(mod?.authors) && mod.authors[0] ? mod.authors[0].name : null,
          latestFileId: latestFile?.id ?? latestFileIndex?.fileId ?? null,
          latestFileName: latestFile?.displayName ?? latestFile?.fileName ?? null,
          downloadUrl: latestFile?.downloadUrl ?? null,
        };
      }),
    };

    searchCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });

    setEdgeCache(res);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[SearchError]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
