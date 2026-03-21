import shaDetailsRaw from "./sha.json?raw";
import { STREAMS } from "./data";
import Guide from "./Guide";
import Options from "./Options";

export default function Menu(props: {
  selectedSlugs: string[];
  onToggle: (streamSlug: string) => void;
  displayLogs?: boolean;
  onDisplayLogsChange?: (value: boolean) => void;
}) {
  return (
    <aside className="menu-column">
      <h1 className="menu-title" title={formatShaTooltip(shaDetailsRaw)}>
        watchwall420
      </h1>

      <div className="stream-list">
        {STREAMS.map((stream) => {
          const selected = props.selectedSlugs.includes(stream.slug);
          return (
            <button
              key={stream.slug}
              type="button"
              className={`stream-toggle ${selected ? "is-selected" : ""}`}
              onClick={() => props.onToggle(stream.slug)}
            >
              <span className="stream-name">{stream.label}</span>
            </button>
          );
        })}
      </div>

      <Guide />
      <Options
        displayLogs={props.displayLogs ?? true}
        onDisplayLogsChange={props.onDisplayLogsChange ?? (() => undefined)}
      />
    </aside>
  );
}

function formatShaTooltip(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
