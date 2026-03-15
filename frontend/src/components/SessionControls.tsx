"use client";

type SessionControlsProps = {
  connectionState: string;
  canStartSession: boolean;
  canEndSession: boolean;
  canCapture: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
  onCaptureImage: () => void;
};

export function SessionControls(props: SessionControlsProps) {
  const {
    connectionState,
    canStartSession,
    canEndSession,
    canCapture,
    onStartSession,
    onEndSession,
    onCaptureImage,
  } = props;
  const sessionLabel =
    connectionState === "session_active"
      ? "Session live"
      : connectionState === "connecting"
        ? "Connecting"
        : "Waiting to start";

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Session</p>
          <h2 className="panel__title">Tutor Controls</h2>
        </div>
        <span className="badge badge--muted">{sessionLabel}</span>
      </div>

      <div className="control-grid">
        <button
          className="button button--primary"
          onClick={onStartSession}
          disabled={!canStartSession}
        >
          Start tutor session
        </button>

        <button
          className="button button--secondary"
          onClick={onEndSession}
          disabled={!canEndSession}
        >
          End tutor session
        </button>

        <button
          className="button button--secondary"
          onClick={onCaptureImage}
          disabled={!canCapture}
        >
          Capture homework image
        </button>
      </div>
    </section>
  );
}
