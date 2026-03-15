import argparse
import asyncio
import base64
import json
import wave
from pathlib import Path

import websockets
from websockets.exceptions import ConnectionClosedOK


def write_pcm_wav(path: Path, pcm_data: bytes, sample_rate: int, channels: int = 1) -> None:
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)


def parse_sample_rate(mime_type: str) -> int:
    parts = [part.strip() for part in mime_type.split(";")]
    for part in parts[1:]:
        if part.startswith("rate="):
            return int(part.split("=", 1)[1])
    return 24000


async def run(uri: str, prompt: str, max_messages: int | None, output_path: Path) -> None:
    audio_chunks: list[bytes] = []
    sample_rate = 24000
    first_response_timeout_seconds = 10
    idle_timeout_seconds = 1.5

    async with websockets.connect(uri) as websocket:
        print("connected:", uri)

        initial_event = await websocket.recv()
        print("server:", initial_event)
        initial_payload = json.loads(initial_event)
        if initial_payload.get("type") == "error":
            print("server reported startup error; stopping test client")
            return
        if initial_payload.get("type") != "transport_ready":
            print("unexpected initial event; stopping test client")
            return

        await websocket.send(
            json.dumps(
                {
                    "type": "start_session",
                    "payload": {"client_session_id": "manual-wav-test"},
                }
            )
        )
        print("client: sent start_session")

        started_event = await websocket.recv()
        print("server:", started_event)
        started_payload = json.loads(started_event)
        if started_payload.get("type") == "error":
            print("server reported start_session error; stopping test client")
            return

        await websocket.send(
            json.dumps(
                {
                    "type": "text_input",
                    "payload": {
                        "text": prompt,
                        "end_of_turn": True,
                    },
                }
            )
        )
        print("client: sent text_input")

        received_messages = 0
        seen_terminal_event = False

        stop_reason = "idle_timeout"

        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.recv(),
                    timeout=(
                        first_response_timeout_seconds
                        if received_messages == 0
                        else idle_timeout_seconds
                    ),
                )
            except TimeoutError:
                stop_reason = "idle_timeout"
                break

            received_messages += 1
            print("server:", message)

            parsed = json.loads(message)
            if parsed.get("type") == "assistant_audio_chunk":
                payload = parsed.get("payload", {})
                mime_type = payload.get("mime_type", "audio/pcm;rate=24000")
                sample_rate = parse_sample_rate(mime_type)
                audio_chunks.append(base64.b64decode(payload["data_base64"]))

            if parsed.get("type") == "error":
                seen_terminal_event = True
                stop_reason = "server_error"
                break

            if parsed.get("type") == "session_ended":
                seen_terminal_event = True
                stop_reason = "server_session_ended"
                break

            if max_messages is not None and received_messages >= max_messages:
                stop_reason = f"max_messages={max_messages}"
                print(f"reached max_messages={max_messages}; stopping receive loop")
                break

        if not seen_terminal_event:
            await websocket.send(
                json.dumps(
                    {
                        "type": "end_session",
                        "payload": {"reason": "manual_wav_test_complete"},
                    }
                )
            )
            print("client: sent end_session")
            print(f"client: stopping because {stop_reason}")

        try:
            while True:
                message = await asyncio.wait_for(websocket.recv(), timeout=1)
                print("server:", message)
                parsed = json.loads(message)
                if parsed.get("type") == "session_ended":
                    break
                if parsed.get("type") == "assistant_audio_chunk":
                    payload = parsed.get("payload", {})
                    mime_type = payload.get("mime_type", "audio/pcm;rate=24000")
                    sample_rate = parse_sample_rate(mime_type)
                    audio_chunks.append(base64.b64decode(payload["data_base64"]))
        except TimeoutError:
            pass
        except ConnectionClosedOK:
            pass

    if not audio_chunks:
        print("no audio chunks received; no wav file written")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_pcm_wav(output_path, b"".join(audio_chunks), sample_rate)
    print(f"wrote wav: {output_path} ({len(audio_chunks)} chunks, {sample_rate} Hz)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manual websocket test client that saves streamed assistant audio to wav."
    )
    parser.add_argument(
        "--uri",
        default="ws://localhost:8080/ws/live",
        help="Websocket URI to connect to.",
    )
    parser.add_argument(
        "--prompt",
        default="Help me solve 2x + 3 = 11 step by step.",
        help="Text prompt to send to the backend.",
    )
    parser.add_argument(
        "--max-messages",
        type=int,
        default=None,
        help="Optional maximum number of server messages to read before ending.",
    )
    parser.add_argument(
        "--output",
        default="tmp/assistant_response.wav",
        help="Path for the output wav file.",
    )
    args = parser.parse_args()

    asyncio.run(
        run(
            args.uri,
            args.prompt,
            args.max_messages,
            Path(args.output),
        )
    )


if __name__ == "__main__":
    main()
