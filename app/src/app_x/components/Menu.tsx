import shaDetailsRaw from "../config/sha.json?raw";
import { STREAMS } from "../config/data";
import type { StreamSlug } from "../config/types";
import Guide from "./Guide";
import Options from "./Options";

export default function Menu(props: {
  selectedSlugs: StreamSlug[];
  onToggle: (streamSlug: StreamSlug) => void;
  displayLogs?: boolean;
  onDisplayLogsChange?: (value: boolean) => void;
}) {
  return (
    <aside className="menu-column">
      <h1 className="menu-title" title={formatShaTooltip(shaDetailsRaw)}>
        watchwall420
      </h1>

      <div className="stream-list">
        {STREAMS.map((stream) => (
          <StreamToggle
            key={stream.slug}
            isSelected={props.selectedSlugs.includes(stream.slug)}
            label={stream.label}
            onClick={() => props.onToggle(stream.slug)}
          />
        ))}
      </div>

      <Guide />
      <Options
        displayLogs={props.displayLogs ?? true}
        onDisplayLogsChange={props.onDisplayLogsChange ?? (() => undefined)}
      />
    </aside>
  );
}

function StreamToggle(props: {
  isSelected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`stream-toggle ${props.isSelected ? "is-selected" : ""}`}
      onClick={props.onClick}
    >
      <span className="stream-name">{props.label}</span>
    </button>
  );
}

function formatShaTooltip(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
