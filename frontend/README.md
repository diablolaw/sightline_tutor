# SightLine Tutor Frontend

Next.js frontend for the SightLine Tutor demo built for the Gemini Live Agent challenge.

It provides a camera preview, microphone controls, live websocket connection to the backend, streamed tutor audio playback, and an optional debug panel for challenge demos and troubleshooting.

## What The Frontend Does

- Auto-connects to the backend websocket when the page loads
- Lets the user explicitly start and end a tutor session
- Shows camera and microphone readiness in the main UI
- Captures and sends homework image snapshots during a live session
- Streams microphone audio to the backend as PCM
- Plays streamed tutor audio replies in sequence
- Shows the latest full tutor reply in the UI
- Keeps technical session details behind a collapsed debug section

## Main User Flow

1. Open the page
2. Wait for the app to become ready
3. Click `Start tutor session`
4. Speak to the tutor and optionally capture a homework image
5. Click `End tutor session` when done

The websocket transport connects automatically. Users do not need to manually connect transport first.

## Environment Variables

Create `frontend/.env.local` from `frontend/.env.local.example`.

- `NEXT_PUBLIC_WS_URL`
  - Local default: `ws://localhost:8080/ws/live`
  - Production example: `wss://your-backend-host/ws/live`

## Local Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Set `NEXT_PUBLIC_WS_URL` if your backend is not running on `localhost:8080`.

## Run Locally

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
cd frontend
npm run build
npm run start
```

## Backend Contract

The frontend expects the websocket backend implemented in [`backend/app/routes/ws.py`](../backend/app/routes/ws.py).

Typical flow:

1. page opens websocket
2. backend sends `transport_ready`
3. frontend sends `start_session`
4. backend sends `session_started`
5. frontend sends `image_frame`, `text_input`, and `audio_chunk` messages during the live session
6. backend streams back `assistant_text`, `assistant_audio_chunk`, `user_transcript`, `turn_complete`, and `session_ended`

## Deployment Notes

- The frontend is static/server-rendered Next.js and can be deployed separately from the backend
- In deployed environments, use `wss://` for `NEXT_PUBLIC_WS_URL`
- The backend must allow your frontend origin and support websocket upgrades
- Browser microphone and camera access generally require HTTPS in production

## Demo Notes For Submission

- The main UI is intentionally simple for judges
- `Technical details` is kept collapsed by default so the product experience stays clean
- The debug section is still useful during judging because it can demonstrate that the app is genuinely using a live streamed session

## Known Limitations

- Webcam input is snapshot-based, not continuous video streaming
- Microphone behavior depends on browser audio permissions and local hardware noise conditions
- The Gemini Live session behavior is still subject to preview API and SDK quirks
- No authentication, persistence, or user accounts are included

## Scripts

- `npm run dev` starts the development server
- `npm run build` creates a production build
- `npm run start` runs the production server
- `npm run lint` runs Next.js linting
