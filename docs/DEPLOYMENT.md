# Deployment — two servers, one repo

The repo is a monorepo. Each host points at its own sub-folder.

## Backend → Render (or Railway / any VM)

Fix mode runs `npm` inside the backend, so the backend server needs **Python 3.12 and Node 20**. The included `backend/Dockerfile` installs both.

Render:
1. New → Web Service → connect the GitHub repo.
2. **Root Directory:** `backend` · **Runtime:** Docker (uses `backend/Dockerfile`).
3. Environment: copy every key from `backend/.env.example`; set `ALLOWED_ORIGINS=https://<your-app>.vercel.app`, a strong `APP_API_KEY`, `DB_PATH=/data/fixloop.db` with a persistent disk mounted at `/data` (or accept data loss on redeploy for the demo).
4. Health check path: `/health`.

Railway: New project → GitHub repo → set **Root Directory** to `backend` → it detects the Dockerfile.

Without Docker (VM): `cd backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000` behind nginx with HTTPS.

Ollama is not available on most hosts; the router simply skips it when `OLLAMA_BASE_URL` is unreachable.

## Frontend → Vercel
1. New Project → import the repo.
2. **Root Directory:** `frontend` (framework auto-detects Next.js).
3. Environment variables (server-side, **not** `NEXT_PUBLIC_`):
   - `BACKEND_URL=https://<backend-host>`
   - `APP_API_KEY=<same value as backend>`
4. Deploy. Vercel's "Ignored Build Step" can be set to `git diff --quiet HEAD^ HEAD ./` so backend-only commits don't redeploy the frontend.

## Local network demo (fastest at the venue)
Run both on one laptop (`README.md` quick start). If judges need to open it on their phones, run `npm run dev -- -H 0.0.0.0` and share `http://<laptop-ip>:3000` on the same Wi-Fi.
