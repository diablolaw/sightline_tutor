import argparse
import asyncio
import json

import websockets


async def run(uri: str, prompt: str, max_messages: int) -> None:
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
                    "payload": {"client_session_id": "manual-test"},
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

        for _ in range(max_messages):
            message = await websocket.recv()
            print("server:", message)

            parsed = json.loads(message)
            if parsed.get("type") in {"turn_complete", "session_ended", "error"}:
                break

        await websocket.send(
            json.dumps(
                {
                    "type": "end_session",
                    "payload": {"reason": "manual_test_complete"},
                }
            )
        )
        print("client: sent end_session")

        try:
            print("server:", await asyncio.wait_for(websocket.recv(), timeout=2))
        except TimeoutError:
            print("server: no final message before close")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manual websocket test client for the Sightline Tutor backend."
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
        default=10,
        help="Maximum number of server messages to print before ending.",
    )
    args = parser.parse_args()

    asyncio.run(run(args.uri, args.prompt, args.max_messages))


if __name__ == "__main__":
    main()
