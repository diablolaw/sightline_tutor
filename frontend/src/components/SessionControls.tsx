"use client";

type SessionControlsProps = {
  connectionState: string;
  isTransportConnected: boolean;
  canStartSession: boolean;
  canEndSession: boolean;
  canCapture: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartSession: () => void;
  onEndSession: () => void;
  onCaptureImage: () => void;
  onInterrupt: () => void;
};

export function SessionControls(props: SessionControlsProps) {
  const {
    connectionState,
    isTransportConnected,
    canStartSession,
    canEndSession,
    canCapture,
    onConnect,
    onDisconnect,
    onStartSession,
    onEndSession,
    onCaptureImage,
    onInterrupt,
  } = props;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Session</p>
          <h2 className="panel__title">Tutor Controls</h2>
        </div>
        <span className="badge badge--muted">{connectionState}</span>
      </div>

      <div className="control-grid">
        {!isTransportConnected ? (
          <button className="button button--primary" onClick={onConnect}>
            Connect transport
          </button>
        ) : (
          <button className="button button--secondary" onClick={onDisconnect}>
            Disconnect transport
          </button>
        )}

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

        <button className="button button--danger" onClick={onInterrupt} disabled={!canEndSession}>
          Interrupt tutor
        </button>
      </div>
    </section>
  );
}
