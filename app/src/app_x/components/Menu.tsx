import shaDetailsRaw from "../config/sha.json?raw";
import { STREAMS } from "../config/data";
import type { StreamSlug } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import Guide from "./Guide";
import Options from "./Options";

const ISTREAMEAST_URL = "https://istreameast.is/";
const WATCHWALL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export default function Menu(props: {
  selectedSlugs: StreamSlug[];
  onToggle: (streamSlug: StreamSlug) => void;
  displayLogs?: boolean;
  onDisplayLogsChange?: (value: boolean) => void;
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

async function handleTitleClick() {
  try {
    const text = await fetchTextThroughProxy({
      url: ISTREAMEAST_URL,
      options: {
        headers: {
          "user-agent": WATCHWALL_USER_AGENT,
        },
      },
    });
    console.log(text);
  } catch (error) {
    console.error(error);
  }
}
