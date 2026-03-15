"use client";

type StatusPanelProps = {
  connectionState: string;
  lastAssistantText?: string;
  lastError?: string;
  isCameraReady: boolean;
  isMicReady: boolean;
  isMicRecording: boolean;
  isAudioPlaying: boolean;
};

export function StatusPanel(props: StatusPanelProps) {
  const {
    connectionState,
    lastAssistantText,
    lastError,
    isCameraReady,
    isMicReady,
    isMicRecording,
    isAudioPlaying,
  } = props;
  const tutorStatus = isAudioPlaying
    ? "Tutor speaking"
    : isMicRecording
      ? "Listening"
      : connectionState === "session_active"
        ? "Ready"
        : connectionState === "connecting"
          ? "Connecting"
          : "Start tutor session";

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Tutor Status</p>
          <h2 className="panel__title">Ready To Learn</h2>
        </div>
        <span className="badge badge--muted">{tutorStatus}</span>
      </div>

      <p className="subtle">
        {connectionState === "session_active"
          ? "Talk naturally or capture a homework image when you are ready."
          : "The page connects in the background. Start the tutor when you want to begin."}
      </p>

      <div className="readiness-grid">
        <article className="readiness-card">
          <p className="eyebrow">Camera</p>
          <strong>{isCameraReady ? "Ready" : "Unavailable"}</strong>
          <p>{isCameraReady ? "Homework snapshots are available." : "Check camera permissions."}</p>
        </article>
        <article className="readiness-card">
          <p className="eyebrow">Microphone</p>
          <strong>{isMicRecording ? "Listening" : isMicReady ? "Ready" : "Unavailable"}</strong>
          <p>
            {isMicRecording
              ? "Speak whenever you want to jump in."
              : isMicReady
                ? "Voice input is available."
                : "Check microphone permissions."}
          </p>
        </article>
      </div>

      {lastAssistantText ? (
        <div className="status-callout">
          <p className="eyebrow">Latest Tutor Reply</p>
          <p>{lastAssistantText}</p>
        </div>
      ) : null}

      {lastError ? (
        <div className="status-callout status-callout--error">
          <p className="eyebrow">Latest error</p>
          <p>{lastError}</p>
        </div>
      ) : null}
    </section>
  );
}
