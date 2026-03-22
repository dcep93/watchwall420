import { useEffect, useRef, useState } from "react";
import { HOST } from "../config/data";
import type { Category, Stream, StreamSlug } from "../config/types";
import useSelectedStreamIds from "../hooks/useSelectedStreamIds";
import { getInitialAuthorized, unlock } from "../lib/auth";
import Menu from "./Menu";
import Multiscreen from "./Multiscreen";
import { filterStreamsByCategory, getDefaultCategory } from "./optionsShared";
import PasswordGate from "./PasswordGate";

const IS_DEV = import.meta.env.DEV;

function removeStreamSlug(slugs: StreamSlug[], streamSlug: StreamSlug) {
  return slugs.filter((slug) => slug !== streamSlug);
}

export default function WatchwallApp() {
  const hostCategories = HOST.getLeagueCategories();
  const defaultCategory = getDefaultCategory(hostCategories);
  const [isAuthorized, setIsAuthorized] = useState(() => (IS_DEV ? true : getInitialAuthorized()));
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [allStreams, setAllStreams] = useState<Stream[] | null>(null);
  const [streamReloadKey, setStreamReloadKey] = useState(0);
  const [focusedSlug, setFocusedSlug] = useState<StreamSlug>("");
  const [muteToggleSlug, setMuteToggleSlug] = useState<StreamSlug>("");
  const [muteToggleRequestId, setMuteToggleRequestId] = useState(0);
  const [displayLogs, setDisplayLogs] = useState(true);
  const [logDelayMs, setLogDelayMs] = useState(120_000);
  const streams = filterStreamsByCategory(allStreams, category);
  const { hadHashSelectionOnLoad, selectedSlugs, selectedStreams, setSelectedSlugs } =
    useSelectedStreamIds(allStreams);
  const [hasResumedFromHashSelection, setHasResumedFromHashSelection] = useState(
    !hadHashSelectionOnLoad,
  );
  const multiscreenRef = useRef<HTMLElement | null>(null);
  const hasScrolledFromInitialHashRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    HOST.getStreams()
      .then((fetchedStreams) => {
        if (!isActive) return;
        setAllStreams(fetchedStreams);
      })
      .catch((error) => {
        console.error(error);
        if (!isActive) return;
        setAllStreams([]);
      });

    return () => {
      isActive = false;
    };
  }, [streamReloadKey]);

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
    if (!shouldScrollToMultiscreenOnLoad || hasScrolledFromInitialHashRef.current) {
      return;
    }

    const multiscreenRect = multiscreenRef.current?.getBoundingClientRect();
    if (multiscreenRect) {
      window.scrollTo({
        top: window.scrollY + multiscreenRect.top,
        left: window.scrollX + multiscreenRect.left,
        behavior: "smooth",
      });
    }

    hasScrolledFromInitialHashRef.current = true;
  }, [shouldScrollToMultiscreenOnLoad]);

  useEffect(() => {
    if (!shouldShowResumePrompt) return;

    const resumeFromHashSelection = () => setHasResumedFromHashSelection(true);

    window.addEventListener("keydown", resumeFromHashSelection, { once: true });
    window.addEventListener("click", resumeFromHashSelection, { once: true });

    return () => {
      window.removeEventListener("keydown", resumeFromHashSelection);
      window.removeEventListener("click", resumeFromHashSelection);
    };
  }, [shouldShowResumePrompt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const match = event.code.match(/^(?:Digit|Numpad)([1-9])$/);
      if (!match) {
        return;
      }

      const nextIndex = Number(match[1]) - 1;
      const nextStream = selectedStreams[nextIndex];
      if (!nextStream) {
        return;
      }

      if (nextStream.slug === resolvedFocusedSlug) {
        setMuteToggleSlug(nextStream.slug);
        setMuteToggleRequestId((current) => current + 1);
        return;
      }

      setFocusedSlug(nextStream.slug);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolvedFocusedSlug, selectedStreams]);

  function handleToggle(streamSlug: StreamSlug) {
    if (selectedSlugs.includes(streamSlug)) {
      const remainingSlugs = removeStreamSlug(selectedSlugs, streamSlug);
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
    const remainingSlugs = removeStreamSlug(selectedSlugs, streamSlug);
    setSelectedSlugs(remainingSlugs);
    if (resolvedFocusedSlug === streamSlug) {
      setFocusedSlug(remainingSlugs[0] ?? "");
    }
  }

  async function handleRefreshStream(streamSlug: StreamSlug) {
    const fetchedStreams = await HOST.getStreams();
    setAllStreams(fetchedStreams);
    return fetchedStreams.find((stream) => stream.slug === streamSlug) ?? null;
  }

  function handleClearCache() {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);

    setIsAuthorized(IS_DEV);
    setCategory(defaultCategory);
    setAllStreams(null);
    setStreamReloadKey((current) => current + 1);
    setFocusedSlug("");
    setDisplayLogs(true);
    setSelectedSlugs([]);
    setHasResumedFromHashSelection(true);
    hasScrolledFromInitialHashRef.current = false;
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
        category={category}
        categories={hostCategories}
        displayLogs={displayLogs}
        logDelayMs={logDelayMs}
        streams={streams ?? []}
        selectedSlugs={selectedSlugs}
        onCategoryChange={setCategory}
        onToggle={handleToggle}
        onDisplayLogsChange={setDisplayLogs}
        onLogDelayMsChange={setLogDelayMs}
        onClearCache={handleClearCache}
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
            host={HOST}
            streams={selectedStreams}
            displayLogs={displayLogs}
            logDelayMs={logDelayMs}
            focusedSlug={resolvedFocusedSlug}
            muteToggleSlug={muteToggleSlug}
            muteToggleRequestId={muteToggleRequestId}
            onRefreshStream={handleRefreshStream}
            onRemove={handleRemove}
            onFocus={setFocusedSlug}
          />
        )
      ) : null}
    </main>
  );
}
