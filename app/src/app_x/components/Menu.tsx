import shaDetailsRaw from "../config/sha.json?raw";
import type { Category, Stream, StreamSlug } from "../config/types";
import { fetchIstreameastHtml } from "../hosts/istreameast";
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
}) {
  return (
    <aside className="menu-column">
      <h1
        className="menu-title"
        title={formatShaTooltip(shaDetailsRaw)}
        onClick={handleTitleClick}
      >
        watchwall420
      </h1>

      <div className="stream-list">
        {props.streams.map((stream) => (
          <StreamToggle
            key={stream.slug}
            isSelected={props.selectedSlugs.includes(stream.slug)}
            label={stream.title}
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

async function handleTitleClick() {
  try {
    const text = await fetchIstreameastHtml();
    console.log(text);
  } catch (error) {
    console.error(error);
  }
}
