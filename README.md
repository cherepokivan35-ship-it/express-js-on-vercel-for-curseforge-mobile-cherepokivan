# vercel-curse-proxy

Безопасный backend-прокси для CurseForge API на базе шаблона **Express.js on Vercel**.

## Что делает этот сервис

- Прячет ваш `CURSEFORGE_API_KEY` на серверной стороне.
- Даёт удобные endpoint'ы для Android-приложения:
  - `GET /api` — health check
  - `GET /api/search?q=&page=&version=`
  - `GET /api/file/:fileId`
  - `GET /api/download?fileId=` (возвращает `302` редирект)
- Добавляет edge-кэш заголовком:
  - `Cache-Control: s-maxage=60, stale-while-revalidate=120`
- Включает небольшой in-memory cache для поиска на 30 секунд (эфемерный в serverless).
- Включает базовую in-memory заглушку rate limit по IP.

## Структура проекта

```txt
/
├─ api/
│  ├─ index.js
│  ├─ routes/
│  │  ├─ search.js
│  │  ├─ file.js
│  │  └─ download.js
├─ package.json
├─ README.md
├─ .gitignore
```

## Настройка и деплой на Vercel

1. Импортируйте репозиторий в Vercel.
2. Откройте **Project → Settings → Environment Variables**.
3. Добавьте переменную:
   - **Name:** `CURSEFORGE_API_KEY`
   - **Value:** ваш API ключ CurseForge
4. Сохраните переменную и сделайте redeploy проекта.

> Важно: ключ читается только из `process.env.CURSEFORGE_API_KEY`.

## Локальный запуск

```bash
npm install
npm run dev
```

Для локальной проверки добавьте `CURSEFORGE_API_KEY` в окружение (например, через Vercel env или shell export).

## Примеры запросов (curl)

> Замените `https://your-project.vercel.app` на ваш домен.

Health check:

```bash
curl -i "https://your-project.vercel.app/api"
```

Search:

```bash
curl -i "https://your-project.vercel.app/api/search?q=shaders&page=1"
```

File metadata:

```bash
curl -i "https://your-project.vercel.app/api/file/123456"
```

Download redirect (ожидается `302` + заголовок `Location`):

```bash
curl -i "https://your-project.vercel.app/api/download?fileId=123456"
```

## Безопасность

- **Не коммитьте API ключи** в репозиторий.
- Если ключ случайно утёк — сразу сгенерируйте новый в CurseForge.
- Сервер не логирует полные ответы CurseForge, только короткие debug snippets при ошибках.

## Примечание про проксирование файла

Сейчас `/api/download` использует **302 redirect** на реальный URL загрузки (рекомендуется).

Если делать полное проксирование/стрим файла через Vercel, это будет расходовать bandwidth и может быстрее упираться в лимиты.
