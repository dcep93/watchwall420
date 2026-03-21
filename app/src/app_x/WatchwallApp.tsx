import { useState } from "react";
import PasswordGate from "./PasswordGate";
import Menu from "./Menu";
import Multiscreen from "./Multiscreen";
import { getInitialAuthorized, unlock } from "./auth";
import useSelectedStreamIds from "./useSelectedStreamIds";
import { STREAMS } from "./data";

export default function WatchwallApp() {
  const [isAuthorized, setIsAuthorized] = useState(getInitialAuthorized);
  const [focusedSlug, setFocusedSlug] = useState(STREAMS[0]?.slug ?? "");
  const [displayLogs, setDisplayLogs] = useState(true);
  const { selectedSlugs, selectedStreams, setSelectedSlugs } = useSelectedStreamIds();

  const resolvedFocusedSlug =
    selectedStreams.find((stream) => stream.slug === focusedSlug)?.slug ?? selectedStreams[0]?.slug;

  function handleToggle(streamSlug: string) {
    if (selectedSlugs.includes(streamSlug)) {
      const remainingSlugs = selectedSlugs.filter((slug) => slug !== streamSlug);
      setSelectedSlugs(remainingSlugs);
      if (focusedSlug === streamSlug) {
        setFocusedSlug(remainingSlugs[0] ?? "");
      }
      return;
    }

    setSelectedSlugs(selectedSlugs.concat(streamSlug));
    if (!resolvedFocusedSlug) {
      setFocusedSlug(streamSlug);
    }
  }

  function handleRemove(streamSlug: string) {
    const remainingSlugs = selectedSlugs.filter((slug) => slug !== streamSlug);
    setSelectedSlugs(remainingSlugs);
    if (focusedSlug === streamSlug) {
      setFocusedSlug(remainingSlugs[0] ?? "");
    }
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
    <main className="watchwall-shell">
      <Menu
        displayLogs={displayLogs}
        selectedSlugs={selectedSlugs}
        onToggle={handleToggle}
        onDisplayLogsChange={setDisplayLogs}
      />
      {selectedStreams.length > 0 ? (
        <Multiscreen
          streams={selectedStreams}
          displayLogs={displayLogs}
          focusedSlug={resolvedFocusedSlug}
          onRemove={handleRemove}
          onFocus={setFocusedSlug}
        />
      ) : null}
    </main>
  );
}
