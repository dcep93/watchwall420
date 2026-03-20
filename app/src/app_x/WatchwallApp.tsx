import { useMemo, useState } from "react";
import { STREAMS } from "./data";
import PasswordGate from "./PasswordGate";
import StreamControls from "./StreamControls";
import Wall from "./Wall";
import { getInitialAuthorized, unlock } from "./auth";
import type { StreamId } from "./types";

function getInitialSelection() {
  return STREAMS.map((stream) => stream.id);
}

export default function WatchwallApp() {
  const [isAuthorized, setIsAuthorized] = useState(getInitialAuthorized);
  const [selectedIds, setSelectedIds] = useState<StreamId[]>(getInitialSelection);
  const [focusedId, setFocusedId] = useState<StreamId>("A");

  const selectedStreams = useMemo(
    () => STREAMS.filter((stream) => selectedIds.includes(stream.id)),
    [selectedIds],
  );
  const resolvedFocusedId =
    selectedStreams.find((stream) => stream.id === focusedId)?.id ?? selectedStreams[0]?.id;

  function handleToggle(streamId: StreamId) {
    setSelectedIds((current) => {
      if (current.includes(streamId)) {
        return current.length === 1 ? current : current.filter((id) => id !== streamId);
      }
      return current.concat(streamId);
    });
    setFocusedId(streamId);
  }

  if (!isAuthorized) {
    return (
      <PasswordGate
        onUnlock={() => {
          unlock();
          setIsAuthorized(true);
        }}
      />
    );
  }

  return (
    <main className="watchwall">
      <section className="hero">
        <p className="eyebrow">watchwall420</p>
      </section>

      <section className="layout">
        <StreamControls
          streams={STREAMS}
          selectedIds={selectedIds}
          onToggle={handleToggle}
        />
        <Wall
          streams={selectedStreams}
          focusedId={resolvedFocusedId}
          onFocus={setFocusedId}
        />
      </section>
    </main>
  );
}
