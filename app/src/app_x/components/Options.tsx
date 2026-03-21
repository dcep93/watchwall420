import { Categories, type Category } from "../config/types";
import {
  clearProxyCache,
  getApproximateProxyCacheSizeBytes,
} from "../lib/proxy420";

export const DEFAULT_CATEGORY: Category = "NCAAB";

async function clearCache() {
  const approximateSizeBytes = await getApproximateProxyCacheSizeBytes().catch(
    () => 0,
  );
  const approximateSizeLabel = formatApproximateSize(approximateSizeBytes);

  if (
    !window.confirm(
      `Are you sure? This will clear about ${approximateSizeLabel} from IndexedDB.`,
    )
  ) {
    return false;
  }

  await clearProxyCache().catch(() => undefined);
  localStorage.clear();
  return true;
}

function formatApproximateSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Options(props: {
  category: Category;
  onCategoryChange: (value: Category) => void;
  displayLogs: boolean;
  onDisplayLogsChange: (value: boolean) => void;
  onClearCache: () => void;
}) {
  return (
    <section className="menu-card">
      <div className="menu-card-header">
        <h2>Options</h2>
        <select
          aria-label="categories"
          className="option-input option-input-inline"
          value={props.category}
          onChange={(event) =>
            props.onCategoryChange(event.target.value as Category)
          }
        >
          {Categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button
          className="secondary-button secondary-button-inline"
          type="button"
          onClick={async () => {
            const didClearCache = await clearCache();
            if (!didClearCache) return;
            props.onClearCache();
          }}
        >
          clear cache
        </button>
      </div>
      <OptionCheckbox defaultChecked label="autorefresh" />
      <OptionCheckbox label="follow remote" />
      <OptionCheckbox
        checked={props.displayLogs}
        label="display logs"
        onChange={props.onDisplayLogsChange}
      />
      <div className="option-row">
        <span>log delay ms</span>
        <input
          className="option-input"
          aria-label="log delay ms"
          defaultValue="40,000"
          inputMode="numeric"
        />
      </div>
    </section>
  );
}

function OptionCheckbox(props: {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <div className="option-row">
      <label>
        <input
          checked={props.checked}
          defaultChecked={props.defaultChecked}
          type="checkbox"
          onChange={
            props.onChange
              ? (event) => props.onChange?.(event.target.checked)
              : undefined
          }
        />
        <span> {props.label}</span>
      </label>
    </div>
  );
}
