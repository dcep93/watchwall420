import shaDetailsRaw from "../config/sha.json?raw";
import type { Category, Stream, StreamCategory, StreamSlug } from "../config/types";
import Guide from "./Guide";
import Options from "./Options";

export default function Menu(props: {
  category: Category;
  categories: readonly StreamCategory[];
  streams: Stream[];
  selectedSlugs: StreamSlug[];
  onToggle: (streamSlug: StreamSlug) => void;
  onCategoryChange: (value: Category) => void;
  displayLogs: boolean;
  logDelayMs: number;
  onDisplayLogsChange: (value: boolean) => void;
  onLogDelayMsChange: (value: number) => void;
  onClearCache: () => void;
}) {
  const shaTooltip = formatShaTooltip(shaDetailsRaw);

  return (
    <aside className="menu-column">
      <div className="menu-title-wrap">
        <h1
          className="menu-title"
          title={shaTooltip}
        >
          watchwall420
        </h1>
        <button
          type="button"
          className="menu-title-overlay-button"
          aria-label="Show build details"
          onClick={() => alert(shaTooltip)}
        />
      </div>

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
        categories={props.categories}
        displayLogs={props.displayLogs}
        logDelayMs={props.logDelayMs}
        onCategoryChange={props.onCategoryChange}
        onDisplayLogsChange={props.onDisplayLogsChange}
        onLogDelayMsChange={props.onLogDelayMsChange}
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
      window.open(props.rawUrl, "_blank", "noopener,noreferrer");
      return;
    }

    props.onClick();
  }

  return (
    <div className="stream-toggle-row">
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
      <button
        type="button"
        className="stream-raw-link-button"
        aria-label={`Open raw stream URL for ${props.label}`}
        title={`Open raw stream URL for ${props.label}`}
        onClick={() => window.location.assign(props.rawUrl)}
      >
        🔗
      </button>
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
