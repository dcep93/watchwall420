import type { Stream, StreamId } from "./types";

export default function StreamControls(props: {
  streams: Stream[];
  selectedIds: StreamId[];
  onToggle: (streamId: StreamId) => void;
}) {
  return (
    <aside className="control-panel">
      <div className="panel-header">
        <h2>Streams</h2>
        <span>{props.selectedIds.length}/3 live</span>
      </div>
      <div className="stream-list">
        {props.streams.map((stream) => {
          const selected = props.selectedIds.includes(stream.id);
          return (
            <button
              key={stream.id}
              type="button"
              className={`stream-toggle ${selected ? "is-selected" : ""}`}
              onClick={() => props.onToggle(stream.id)}
            >
              <span className="stream-name">{stream.label}</span>
              <span className="stream-log">{stream.log}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
