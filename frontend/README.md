# SightLine Tutor Frontend

Single-page Next.js frontend for the SightLine Tutor hackathon demo. It shows a webcam preview, connects to the live tutoring websocket, sends still homework snapshots, streams microphone audio chunks, plays assistant audio, and exposes clear live session controls.

## What it does

- Shows a live webcam preview
- Opens a websocket transport to the backend
- Starts and ends a tutoring session explicitly
- Captures and sends a still image frame on demand
- Records microphone audio with `MediaRecorder` and sends chunks to the backend
- Plays streamed assistant PCM audio responses in sequence
- Supports interrupting tutor playback and sending an `interrupt` event
- Shows simple status and a recent event log

## Environment variables

Create `frontend/.env.local` from `frontend/.env.local.example`.

- `NEXT_PUBLIC_WS_URL`
  - Local default: `ws://localhost:8080/ws/live`
  - Used for the backend websocket endpoint

## Install

```bash
cd frontend
npm install
```

## Run locally

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Backend expectation

The frontend expects the backend websocket contract currently implemented in `backend/app/routes/ws.py`:

1. connect websocket
2. receive `transport_ready`
3. send `start_session`
4. receive `session_started`
5. send `image_frame`, `audio_chunk`, `interrupt`, and `end_session` as needed

## Known limitations

- Microphone capture uses `MediaRecorder`, which usually produces `audio/webm;codecs=opus` chunks. This is practical for browser capture, but the backend and upstream model must accept that mime type for live audio to work end-to-end.
- Webcam upload is snapshot-only. It does not stream continuous video.
- Assistant audio playback assumes backend audio chunks are 16-bit mono PCM and include a `rate=` parameter when the sample rate differs from `24000`.
- There is no persistence, auth, or reconnect recovery beyond basic hackathon-friendly behavior.

## Design notes

The UI styling is intentionally lightweight and loosely follows Material Design principles for clear hierarchy, rounded surfaces, strong primary actions, and obvious status color usage. Official references used for direction:

- https://nextjs.org/docs/pages/getting-started/installation
- https://nextjs.org/docs/app/getting-started/upgrading
- https://m3.material.io/
