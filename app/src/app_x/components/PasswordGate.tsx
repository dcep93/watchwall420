import { useState } from "react";
import type { FormEvent } from "react";
import { isValidPasswordInput } from "../lib/auth";

export default function PasswordGate(props: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isValidPasswordInput(value)) {
      props.onUnlock();
      return;
    }
    setError("Incorrect password");
  }

  return (
    <main className="password-shell">
      <form className="password-card" onSubmit={onSubmit}>
        <h1>watchwall420</h1>
        <div className="password-row">
          <input
            id="watchwall-password"
            className="password-input"
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            autoFocus
          />
          <button className="primary-button" type="submit">
            Unlock
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </main>
  );
}
