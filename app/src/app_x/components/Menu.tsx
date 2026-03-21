import shaDetailsRaw from "../config/sha.json?raw";
import type { Category, Stream, StreamSlug } from "../config/types";
import Guide from "./Guide";
import Options from "./Options";

export default function Menu(props: {
  category: Category;
  streams: Stream[];
  selectedSlugs: StreamSlug[];
  onToggle: (streamSlug: StreamSlug) => void;
  onCategoryChange: (value: Category) => void;
  displayLogs: boolean;
  onDisplayLogsChange: (value: boolean) => void;
  onClearCache: () => void;
}) {
  return (
    <aside className="menu-column">
      <h1
        className="menu-title"
        title={formatShaTooltip(shaDetailsRaw)}
      >
        watchwall420
      </h1>

      <div className="stream-list">
        {props.streams.map((stream) => (
          <StreamToggle
            key={stream.slug}
            isSelected={props.selectedSlugs.includes(stream.slug)}
            label={stream.title}
            rawUrl={stream.raw_url}
            onClick={() => props.onToggle(stream.slug)}
          />
        ))}
      </div>

      <Guide />
      <Options
        category={props.category}
        displayLogs={props.displayLogs}
        onCategoryChange={props.onCategoryChange}
        onDisplayLogsChange={props.onDisplayLogsChange}
        onClearCache={props.onClearCache}
      />
    </aside>
  );
}

function StreamToggle(props: {
  isSelected: boolean;
  label: string;
  rawUrl: string;
  onClick: () => void;
}) {
  function handleActivate(event: { metaKey?: boolean; preventDefault?: () => void }) {
    if (event.metaKey) {
      event.preventDefault?.();
      const url = new URL(props.rawUrl, "https://istreameast.is").toString();
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    props.onClick();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`stream-toggle ${props.isSelected ? "is-selected" : ""}`}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate(event);
        }
      }}
    >
      <span className="stream-name">{props.label}</span>
    </div>
  );
}

function formatShaTooltip(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
