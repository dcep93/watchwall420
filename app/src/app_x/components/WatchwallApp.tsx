import { useState } from "react";
import PasswordGate from "./PasswordGate";
import Menu from "./Menu";
import Multiscreen from "./Multiscreen";
import { getInitialAuthorized, unlock } from "../lib/auth";
import useSelectedStreamIds from "../hooks/useSelectedStreamIds";
import { STREAMS } from "../config/data";
import type { StreamSlug } from "../config/types";

function removeSlug(slugs: StreamSlug[], streamSlug: StreamSlug) {
  return slugs.filter((slug) => slug !== streamSlug);
}

export default function WatchwallApp() {
  const [isAuthorized, setIsAuthorized] = useState(getInitialAuthorized);
  const [focusedSlug, setFocusedSlug] = useState(STREAMS[0]?.slug ?? "");
  const [displayLogs, setDisplayLogs] = useState(true);
  const { selectedSlugs, selectedStreams, setSelectedSlugs } = useSelectedStreamIds();

  const resolvedFocusedSlug =
    selectedStreams.find((stream) => stream.slug === focusedSlug)?.slug ?? selectedStreams[0]?.slug;

  function handleToggle(streamSlug: StreamSlug) {
    if (selectedSlugs.includes(streamSlug)) {
      const remainingSlugs = removeSlug(selectedSlugs, streamSlug);
      setSelectedSlugs(remainingSlugs);
      if (resolvedFocusedSlug === streamSlug) {
        setFocusedSlug(remainingSlugs[0] ?? "");
      }
      return;
    }

    setSelectedSlugs(selectedSlugs.concat(streamSlug));
    if (!resolvedFocusedSlug) {
      setFocusedSlug(streamSlug);
    }
  }

  function handleRemove(streamSlug: StreamSlug) {
    const remainingSlugs = removeSlug(selectedSlugs, streamSlug);
    setSelectedSlugs(remainingSlugs);
    if (resolvedFocusedSlug === streamSlug) {
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
