# SightLine Tutor

SightLine Tutor is a multimodal homework assistant built for the Gemini Live Agent challenge.

It combines:

- a Next.js frontend for camera, microphone, and tutor controls
- a FastAPI backend that brokers a live Gemini session over websocket
- live voice interaction with streamed tutor audio
- homework image snapshots captured during the session

The goal is simple: point the camera at a problem, start a tutor session, ask a question out loud, and get real-time spoken help.

## Features

- 🎤 Live voice tutoring
- 📷 Homework image capture
- 🧠 Multimodal reasoning with Gemini
- 🔊 Real-time streamed tutor audio
- ⚡ WebSocket-powered real-time interaction

## Repo Structure

- [`frontend/`](./frontend)
  - Next.js app for the demo UI
  - camera preview
  - microphone capture
  - tutor audio playback
  - optional debug panel for live-session inspection
- [`backend/`](./backend)
  - FastAPI websocket server
  - Gemini Live session management
  - message validation and event translation

## How It Works

1. The frontend opens a websocket transport to the backend when the page loads.
2. The user clicks `Start tutor session`.
3. The backend starts a Gemini Live session.
4. The user can:
   - speak into the microphone
   - capture a homework image
   - continue the conversation in the same session
5. The backend forwards user audio, text, and image input to Gemini.
6. The frontend receives streamed tutor text and audio responses over websocket.

## Main Features

- Live voice tutoring
- Homework image capture during the session
- Real-time assistant audio playback
- Camera and microphone readiness shown in the UI
- Collapsed technical details panel for demos and troubleshooting

## Local Setup

### 1. Start the backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in `backend/.env`, then run:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

### 2. Start the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Notes

### Backend

Important variables are documented in [`backend/README.md`](./backend/README.md), including:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_RESPONSE_MODALITY`
- `ALLOWED_ORIGINS`

### Frontend

Important variables are documented in [`frontend/README.md`](./frontend/README.md), including:

- `NEXT_PUBLIC_WS_URL`

For local development, the default websocket URL is:

```text
ws://localhost:8080/ws/live
```

## Deployment Overview

Typical deployment setup:

- deploy the backend separately on a websocket-capable host
- deploy the frontend on a static or Next.js-friendly platform
- point the frontend at the deployed backend with `NEXT_PUBLIC_WS_URL`

In production:

- use `wss://` for the websocket URL
- use HTTPS so camera and microphone permissions work reliably
- ensure backend CORS/origin settings allow the frontend host

### Deployment Scripts

Repo-level PowerShell scripts are included for faster Cloud Run redeploys:

- [`scripts/deploy-backend.ps1`](./scripts/deploy-backend.ps1)
- [`scripts/deploy-frontend.ps1`](./scripts/deploy-frontend.ps1)

Examples:

```powershell
.\scripts\deploy-backend.ps1 -ProjectId YOUR_PROJECT_ID -GeminiApiKey YOUR_KEY
```

```powershell
.\scripts\deploy-frontend.ps1 -ProjectId YOUR_PROJECT_ID -BackendUrl https://your-backend-service.run.app/
```

## Proof Of Google Cloud Deployment

Google Cloud deployment proof video:

- https://www.youtube.com/watch?v=zqbUoMeGQSc

This recording shows the project running on Google Cloud Run and serves as deployment proof for the Gemini Live Agent challenge submission.

## Demo Flow

For the challenge submission, the intended flow is:

1. open the deployed app
2. confirm camera and microphone are ready
3. click `Start tutor session`
4. ask a question out loud
5. optionally capture a homework image
6. continue the conversation
7. click `End tutor session`

The `Technical details` section is collapsed by default so the demo stays clean, but it can be opened to show live session behavior if needed.

## Notes

- Webcam input is snapshot-based, not continuous video streaming
- This is a hackathon demo, so there is no auth or persistence layer
- Gemini Live behavior may vary because the API and SDK are still evolving

## More Detail

- Frontend setup and behavior: [`frontend/README.md`](./frontend/README.md)
- Backend setup and websocket contract: [`backend/README.md`](./backend/README.md)
