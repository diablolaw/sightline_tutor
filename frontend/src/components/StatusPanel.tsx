"use client";

type StatusPanelProps = {
  wsUrl: string;
  connectionState: string;
  backendSessionId?: string;
  model?: string;
  responseModality?: string;
  lastAssistantText?: string;
  lastError?: string;
  isCameraReady: boolean;
  isMicReady: boolean;
  isMicRecording: boolean;
  isAudioPlaying: boolean;
};

export function StatusPanel(props: StatusPanelProps) {
  const {
    wsUrl,
    connectionState,
    backendSessionId,
    model,
    responseModality,
    lastAssistantText,
    lastError,
    isCameraReady,
    isMicReady,
    isMicRecording,
    isAudioPlaying,
  } = props;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Live State</p>
          <h2 className="panel__title">Session Status</h2>
        </div>
      </div>

      <dl className="status-list">
        <div className="status-list__row">
          <dt>Backend WS</dt>
          <dd>{wsUrl}</dd>
        </div>
        <div className="status-list__row">
          <dt>Connection</dt>
          <dd>{connectionState}</dd>
        </div>
        <div className="status-list__row">
          <dt>Backend session</dt>
          <dd>{backendSessionId ?? "Not assigned"}</dd>
        </div>
        <div className="status-list__row">
          <dt>Model</dt>
          <dd>{model ?? "Not started"}</dd>
        </div>
        <div className="status-list__row">
          <dt>Response mode</dt>
          <dd>{responseModality ?? "Unknown"}</dd>
        </div>
        <div className="status-list__row">
          <dt>Camera</dt>
          <dd>{isCameraReady ? "Ready" : "Unavailable"}</dd>
        </div>
        <div className="status-list__row">
          <dt>Microphone</dt>
          <dd>
            {isMicRecording ? "Recording" : isMicReady ? "Ready" : "Unavailable"}
          </dd>
        </div>
        <div className="status-list__row">
          <dt>Assistant audio</dt>
          <dd>{isAudioPlaying ? "Speaking" : "Idle"}</dd>
        </div>
      </dl>

      {lastAssistantText ? (
        <div className="status-callout">
          <p className="eyebrow">Latest assistant text</p>
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
