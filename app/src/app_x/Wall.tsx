import type { Stream, StreamId } from "./types";

export default function Wall(props: {
  streams: Stream[];
  focusedId?: StreamId;
  onFocus: (streamId: StreamId) => void;
}) {
  const focusedStream =
    props.streams.find((stream) => stream.id === props.focusedId) ?? props.streams[0];

  return (
    <section className="wall">
      <div className="screen-grid">
        {props.streams.map((stream) => (
          <button
            key={stream.id}
            type="button"
            className={`screen-card ${focusedStream?.id === stream.id ? "is-focused" : ""}`}
            onClick={() => props.onFocus(stream.id)}
          >
            <span className="screen-index">{stream.id}</span>
            <span className="screen-letter">{stream.label}</span>
          </button>
        ))}
      </div>

      <div className="log-panel">
        <div className="panel-header">
          <h2>Log</h2>
          <span>{focusedStream?.id ?? "-"}</span>
        </div>
        <div className="log-entry">{focusedStream?.log ?? ""}</div>
      </div>
    </section>
  );
}
