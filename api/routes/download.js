const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

function setEdgeCache(res) {
  res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
}

function isNumericLike(value) {
  return /^\d+$/.test(String(value || ''));
}

router.get('/', async (req, res) => {
  try {
    const { fileId } = req.query;

    if (!isNumericLike(fileId)) {
      return res.status(400).json({ error: 'fileId must be numeric' });
    }

    if (!process.env.CURSEFORGE_API_KEY) {
      return res.status(500).json({ error: 'Server misconfiguration: missing CURSEFORGE_API_KEY' });
    }

    const response = await fetch(`https://api.curseforge.com/v1/mods/files/${fileId}`, {
      headers: {
        'x-api-key': process.env.CURSEFORGE_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const snippet = await response.text();
      console.error('[CurseForge/download] status=', response.status, 'snippet=', snippet.slice(0, 200));
      return res.status(502).json({ error: 'Failed to fetch file metadata from CurseForge' });
    }

    const json = await response.json();
    const downloadUrl = json?.data?.downloadUrl;

    if (!downloadUrl) {
      return res.status(404).json({ error: 'Download URL not found for fileId' });
    }

    setEdgeCache(res);
    return res.redirect(302, downloadUrl);
  } catch (error) {
    console.error('[DownloadError]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
