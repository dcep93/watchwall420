function clearCache() {
  if (!window.confirm("Are you sure?")) return;
  localStorage.clear();
  window.location.reload();
}

const CATEGORY_OPTIONS = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "CFL",
  "CFB",
  "NCAAB",
  "UFC",
  "BOXING",
  "SOCCER",
  "F1",
] as const;

export default function Options(props: {
  displayLogs: boolean;
  onDisplayLogsChange: (value: boolean) => void;
}) {
  return (
    <section className="menu-card">
      <div className="menu-card-header">
        <h2>Options</h2>
        <select aria-label="categories" className="option-input option-input-inline" defaultValue="NCAAB">
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button
          className="secondary-button secondary-button-inline"
          type="button"
          onClick={clearCache}
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
          onChange={props.onChange ? (event) => props.onChange?.(event.target.checked) : undefined}
        />
        <span> {props.label}</span>
      </label>
    </div>
  );
}
