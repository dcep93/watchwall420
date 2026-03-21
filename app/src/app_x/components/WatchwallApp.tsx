import { useEffect, useRef, useState } from "react";
import PasswordGate from "./PasswordGate";
import Menu from "./Menu";
import Multiscreen from "./Multiscreen";
import { getDefaultCategory } from "./Options";
import { getInitialAuthorized, unlock } from "../lib/auth";
import useSelectedStreamIds from "../hooks/useSelectedStreamIds";
import { HOST } from "../config/data";
import type { Category, Stream, StreamSlug } from "../config/types";

const IS_DEV = import.meta.env.DEV;

function removeSlug(slugs: StreamSlug[], streamSlug: StreamSlug) {
  return slugs.filter((slug) => slug !== streamSlug);
}

export default function WatchwallApp() {
  const hostCategories = HOST.getLeagueCategories();
  const defaultCategory = getDefaultCategory(hostCategories);
  const [isAuthorized, setIsAuthorized] = useState(() => (IS_DEV ? true : getInitialAuthorized()));
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [streamsState, setStreamsState] = useState<{
    category: Category;
    streams: Stream[] | null;
  }>({
    category: defaultCategory,
    streams: null,
  });
  const [focusedSlug, setFocusedSlug] = useState<StreamSlug>("");
  const [displayLogs, setDisplayLogs] = useState(true);
  const streams = streamsState.category === category ? streamsState.streams : null;
  const { hadHashSelectionOnLoad, selectedSlugs, selectedStreams, setSelectedSlugs } =
    useSelectedStreamIds(streams);
  const [hasResumedFromHashSelection, setHasResumedFromHashSelection] = useState(
    !hadHashSelectionOnLoad,
  );
  const multiscreenRef = useRef<HTMLElement | null>(null);
  const hasScrolledFromInitialHashRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    HOST.getStreams(category)
      .then((nextStreams) => {
        if (!isActive) return;
        setStreamsState({ category, streams: nextStreams });
      })
      .catch((error) => {
        console.error(error);
        if (!isActive) return;
        setStreamsState({ category, streams: [] });
      });

    return () => {
      isActive = false;
    };
  }, [category]);

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

    multiscreenRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "start",
    });

    hasScrolledFromInitialHashRef.current = true;
  }, [shouldScrollToMultiscreenOnLoad]);

  useEffect(() => {
    if (!shouldShowResumePrompt) return;

    const resume = () => setHasResumedFromHashSelection(true);

    window.addEventListener("keydown", resume, { once: true });
    window.addEventListener("click", resume, { once: true });

    return () => {
      window.removeEventListener("keydown", resume);
      window.removeEventListener("click", resume);
    };
  }, [shouldShowResumePrompt]);

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

  function handleClearCache() {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);

    setIsAuthorized(IS_DEV);
    setCategory(defaultCategory);
    setStreamsState({
      category: defaultCategory,
      streams: null,
    });
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
        streams={streams ?? []}
        selectedSlugs={selectedSlugs}
        onCategoryChange={setCategory}
        onToggle={handleToggle}
        onDisplayLogsChange={setDisplayLogs}
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
            focusedSlug={resolvedFocusedSlug}
            onRemove={handleRemove}
            onFocus={setFocusedSlug}
          />
        )
      ) : null}
    </main>
  );
}
