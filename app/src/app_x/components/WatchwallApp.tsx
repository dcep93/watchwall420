import { useEffect, useRef, useState } from "react";
import PasswordGate from "./PasswordGate";
import Menu from "./Menu";
import Multiscreen from "./Multiscreen";
import { getInitialAuthorized, unlock } from "../lib/auth";
import useSelectedStreamIds from "../hooks/useSelectedStreamIds";
import { STREAMS } from "../config/data";
import type { StreamSlug } from "../config/types";

const IS_DEV = import.meta.env.DEV;

function removeSlug(slugs: StreamSlug[], streamSlug: StreamSlug) {
  return slugs.filter((slug) => slug !== streamSlug);
}

export default function WatchwallApp() {
  const [isAuthorized, setIsAuthorized] = useState(() => (IS_DEV ? true : getInitialAuthorized()));
  const [focusedSlug, setFocusedSlug] = useState(STREAMS[0]?.slug ?? "");
  const [displayLogs, setDisplayLogs] = useState(true);
  const { hadHashSelectionOnLoad, selectedSlugs, selectedStreams, setSelectedSlugs } =
    useSelectedStreamIds();
  const [hasResumedFromHashSelection, setHasResumedFromHashSelection] = useState(
    !hadHashSelectionOnLoad,
  );
  const multiscreenRef = useRef<HTMLElement | null>(null);

  const resolvedFocusedSlug =
    selectedStreams.find((stream) => stream.slug === focusedSlug)?.slug ?? selectedStreams[0]?.slug;
  const shouldShowResumePrompt =
    !IS_DEV &&
    isAuthorized &&
    !hasResumedFromHashSelection &&
    hadHashSelectionOnLoad &&
    selectedStreams.length > 0;
  const shouldScrollToMultiscreenOnLoad =
    hadHashSelectionOnLoad &&
    selectedStreams.length > 0 &&
    (shouldShowResumePrompt || IS_DEV);

  useEffect(() => {
    if (!shouldScrollToMultiscreenOnLoad) return;

    multiscreenRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "start",
    });

    if (!shouldShowResumePrompt) return;

    const resume = () => setHasResumedFromHashSelection(true);

    window.addEventListener("keydown", resume, { once: true });
    window.addEventListener("click", resume, { once: true });

    return () => {
      window.removeEventListener("keydown", resume);
      window.removeEventListener("click", resume);
    };
  }, [shouldScrollToMultiscreenOnLoad, shouldShowResumePrompt]);

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
        shouldShowResumePrompt ? (
          <section ref={multiscreenRef} className="multiscreen-column resume-column">
            <div className="resume-message">
              <p>Press any key or click to resume.</p>
            </div>
          </section>
        ) : (
          <Multiscreen
            containerRef={multiscreenRef}
            streams={selectedStreams}
            displayLogs={displayLogs}
            focusedSlug={resolvedFocusedSlug}
            onRemove={handleRemove}
            onFocus={setFocusedSlug}
          />
        )
      ) : null}
    </main>
  );
}
