const express = require('express');

const searchRouter = require('./routes/search');
const fileRouter = require('./routes/file');
const downloadRouter = require('./routes/download');

const app = express();

// ВАЖНО: в Vercel добавьте переменную окружения CURSEFORGE_API_KEY
// Project -> Settings -> Environment Variables.

app.disable('x-powered-by');

const tokenBuckets = new Map();
const RATE_LIMIT_CAPACITY = 30;
const RATE_LIMIT_REFILL_PER_SEC = 1;

// Базовый in-memory rate limit (только как заглушка).
// В serverless-окружении Vercel состояние эфемерное. Для production нужен Redis/Upstash.
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const bucket = tokenBuckets.get(ip) || { tokens: RATE_LIMIT_CAPACITY, updatedAt: now };
  const elapsed = Math.max(0, (now - bucket.updatedAt) / 1000);
  bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_SEC);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    tokenBuckets.set(ip, bucket);
    return res.status(429).json({ error: 'Too many requests' });
  }

  bucket.tokens -= 1;
  tokenBuckets.set(ip, bucket);
  return next();
});

app.get('/api', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/search', searchRouter);
app.use('/api/file', fileRouter);
app.use('/api/download', downloadRouter);

app.use((err, _req, res, _next) => {
  console.error('[UnhandledError]', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
