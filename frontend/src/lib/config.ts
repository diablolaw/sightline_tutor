const FALLBACK_WS_URL = "ws://localhost:8080/ws/live";

export const config = {
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || FALLBACK_WS_URL,
  eventLogLimit: 120,
};
