const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

function setEdgeCache(res) {
  res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
}

function isNumericLike(value) {
  return /^\d+$/.test(String(value || ''));
}

router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

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
      console.error('[CurseForge/file] status=', response.status, 'snippet=', snippet.slice(0, 200));
      return res.status(502).json({ error: 'Failed to fetch file metadata from CurseForge' });
    }

    const json = await response.json();
    const file = json?.data;

    if (!file?.downloadUrl) {
      return res.status(404).json({ error: 'Download URL not found for fileId' });
    }

    const payload = {
      id: file?.id ?? Number(fileId),
      fileName: file?.fileName ?? file?.displayName ?? null,
      fileLength: file?.fileLength ?? null,
      downloadUrl: file?.downloadUrl,
    };

    setEdgeCache(res);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[FileError]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
