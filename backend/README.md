# Sightline Tutor Backend

Minimal FastAPI backend for a real-time, vision-enabled voice tutor powered by the Gemini Live API. This service stays thin by design: it accepts websocket events from the frontend, forwards text/audio/image input to Gemini, and streams model events back. No database, auth, queues, or background workers are included.

## Architecture

- `FastAPI` app with:
  - `GET /health` for Cloud Run health checks
  - `WS /ws/live` for realtime tutoring sessions
- `GeminiLiveService` wraps the Google GenAI SDK live session
- Pydantic models validate inbound websocket messages and shape outbound events
- Structured JSON logging for connect/disconnect, session lifecycle, and errors

## Environment Variables

- `GEMINI_API_KEY` required, Gemini Developer API key
- `PORT` optional, defaults to `8080`
- `ALLOWED_ORIGINS` optional, comma-separated list for CORS
- `GEMINI_MODEL` optional, defaults to `models/gemini-live-2.5-flash-preview`
- `GEMINI_RESPONSE_MODALITY` optional, defaults to `AUDIO`

## Local Setup

Create a virtual environment and install dependencies:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in `.env`, then run the server:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

Health check:

```powershell
curl http://localhost:8080/health
```

## Websocket API

Connect the frontend to:

```text
ws://localhost:8080/ws/live
```

Example client messages:

```json
{ "type": "start_session", "payload": { "client_session_id": "abc123" } }
```

```json
{ "type": "text_input", "payload": { "text": "Help me solve 2x + 3 = 11", "end_of_turn": true } }
```

```json
{ "type": "image_frame", "payload": { "mime_type": "image/jpeg", "data_base64": "..." } }
```

```json
{
  "type": "audio_chunk",
  "payload": {
    "mime_type": "audio/pcm",
    "data_base64": "...",
    "activity_start": true,
    "activity_end": false,
    "end_of_stream": false
  }
}
```

```json
{ "type": "interrupt", "payload": {} }
```

```json
{ "type": "end_session", "payload": { "reason": "user_left" } }
```

Example server events:

```json
{ "type": "session_started", "payload": { "session_id": "...", "model": "models/gemini-live-2.5-flash-preview", "response_modality": "AUDIO" } }
```

```json
{ "type": "assistant_audio_chunk", "payload": { "mime_type": "audio/pcm", "data_base64": "..." } }
```

```json
{ "type": "assistant_text", "payload": { "text": "Let's isolate x first.", "source": "output_transcription" } }
```

```json
{ "type": "error", "payload": {}, "error": { "code": "invalid_message", "message": "Malformed websocket message." } }
```

## Cloud Run Deploy

Build and deploy from the repository root:

```powershell
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/sightline-tutor-backend ./backend
gcloud run deploy sightline-tutor-backend `
  --image gcr.io/YOUR_PROJECT_ID/sightline-tutor-backend `
  --platform managed `
  --region YOUR_REGION `
  --allow-unauthenticated `
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,GEMINI_MODEL=models/gemini-live-2.5-flash-preview
```

Cloud Run uses `PORT=8080` automatically. Keep websocket clients on HTTPS/WSS in deployed environments.

For current Gemini Live testing, a safe local starting point is:

```env
GEMINI_MODEL=gemini-live-2.5-flash-preview
GEMINI_RESPONSE_MODALITY=TEXT
```

If you switch to an audio-capable native-audio Live model, set:

```env
GEMINI_RESPONSE_MODALITY=AUDIO
```

## Known Limitations

- No database is used by design.
- The backend defaults Gemini Live sessions to `TEXT` output for safer local setup. Audio output requires a compatible Live model plus `GEMINI_RESPONSE_MODALITY=AUDIO`.
- Gemini Live interruption is only partially wired. Server-side barge-in is supported when new user activity arrives, but the current Python SDK docs do not show a clearly documented explicit cancel call for a standalone `interrupt` message, so the backend reports that limitation instead of silently faking it.
- The Live API is still preview and SDK event fields may change. SDK-specific assumptions are isolated in `app/services/gemini_live.py`.
