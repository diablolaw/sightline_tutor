"use client";

type MicControlsProps = {
  inputLevel: number;
  isStarting: boolean;
  isRecording: boolean;
  isReady: boolean;
  error: string | null;
  disabled: boolean;
  onToggle: () => void;
};

export function MicControls({
  inputLevel,
  isStarting,
  isRecording,
  isReady,
  error,
  disabled,
  onToggle,
}: MicControlsProps) {
  const bars = Array.from({ length: 16 }, (_, index) => {
    const position = index / 15;
    const shapeBias = 1 - Math.abs(position - 0.5) * 1.55;
    const activity = Math.max(0.18, Math.min(1, inputLevel * 6 + shapeBias * 0.35));
    const height = Math.round(16 + activity * 44);

    return (
      <span
        key={`mic-bar-${index}`}
        className={`mic-visualizer__bar ${isRecording ? "mic-visualizer__bar--active" : ""}`}
        style={{ height: `${height}px` }}
      />
    );
  });

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Microphone</p>
          <h2 className="panel__title">Voice Input</h2>
        </div>
        <span
          className={`badge ${isRecording ? "badge--danger" : isStarting || isReady ? "badge--success" : "badge--muted"}`}
        >
          {isRecording ? "Listening" : isStarting ? "Starting" : isReady ? "Ready" : "Idle"}
        </span>
      </div>

      <button className="button button--primary" onClick={onToggle} disabled={disabled || isStarting}>
        {isRecording ? "Stop microphone" : isStarting ? "Starting microphone..." : "Start microphone"}
      </button>

      <div className={`mic-visualizer ${isRecording ? "mic-visualizer--listening" : ""}`}>
        <div className="mic-visualizer__bars" aria-hidden="true">
          {bars}
        </div>
        <p className="mic-visualizer__label">
          {isRecording
            ? "Mic activity"
            : isStarting
              ? "Waiting for microphone"
              : "Start the microphone to see your voice level"}
        </p>
      </div>

      <p className="subtle">
        Uses browser audio capture and sends PCM chunks over the live websocket.
      </p>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
