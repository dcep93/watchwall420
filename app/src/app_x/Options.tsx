export default function Options(props: {
  displayLogs: boolean;
  onDisplayLogsChange: (value: boolean) => void;
}) {
  return (
    <section className="menu-card">
      <div className="menu-card-header">
        <h2>Options</h2>
        <button
          className="secondary-button secondary-button-inline"
          type="button"
          onClick={() => {
            if (!window.confirm("Are you sure?")) return;
            localStorage.clear();
            window.location.reload();
          }}
        >
          clear cache
        </button>
      </div>
      <div className="option-row">
        <label>
          <input defaultChecked type="checkbox" />
          <span> autorefresh</span>
        </label>
      </div>
      <div className="option-row">
        <label>
          <input type="checkbox" />
          <span> follow remote</span>
        </label>
      </div>
      <div className="option-row">
        <label>
          <input
            checked={props.displayLogs}
            type="checkbox"
            onChange={(event) => props.onDisplayLogsChange(event.target.checked)}
          />
          <span> display logs</span>
        </label>
      </div>
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
