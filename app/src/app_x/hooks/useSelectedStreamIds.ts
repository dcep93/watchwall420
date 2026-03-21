import { useEffect, useMemo, useState } from "react";
import type { Stream, StreamSlug } from "../config/types";

function parseSelectedSlugsFromHash(
  hash: string,
  allowedSlugs: Set<StreamSlug> | null,
): StreamSlug[] {
  return hash
    .replace(/^#/, "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug, index, array): slug is StreamSlug =>
      isAllowedUniqueSlug(slug, index, array, allowedSlugs),
    );
}

function isAllowedUniqueSlug(
  slug: string,
  index: number,
  array: string[],
  allowedSlugs: Set<StreamSlug> | null,
): slug is StreamSlug {
  if (!slug || array.indexOf(slug) !== index) {
    return false;
  }

  return allowedSlugs ? allowedSlugs.has(slug as StreamSlug) : true;
}

function writeSelectedSlugsToHash(slugs: StreamSlug[]) {
  const hash = serializeSelectedSlugs(slugs);
  const url = new URL(window.location.href);

  if (hash) {
    url.hash = hash;
  } else {
    url.hash = "";
  }

  window.history.replaceState(null, "", url);
}

function serializeSelectedSlugs(slugs: StreamSlug[]) {
  return slugs.join(",");
}

function hashMatchesSelectedSlugs(slugs: StreamSlug[]) {
  return window.location.hash.replace(/^#/, "") === serializeSelectedSlugs(slugs);
}

export default function useSelectedStreamIds(streams: Stream[] | null) {
  const allowedSlugs = useMemo(
    () => (streams ? new Set<StreamSlug>(streams.map((stream) => stream.slug)) : null),
    [streams],
  );
  const [initialHash] = useState(() => window.location.hash);
  const initialSelectedSlugs = useMemo(
    () => parseSelectedSlugsFromHash(initialHash, allowedSlugs),
    [initialHash, allowedSlugs],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<StreamSlug[]>(() =>
    parseSelectedSlugsFromHash(window.location.hash, allowedSlugs),
  );

  useEffect(() => {
    const onHashChange = () => {
      setSelectedSlugs(parseSelectedSlugsFromHash(window.location.hash, allowedSlugs));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [allowedSlugs]);

  useEffect(() => {
    setSelectedSlugs(parseSelectedSlugsFromHash(window.location.hash, allowedSlugs));
  }, [allowedSlugs]);

  useEffect(() => {
    if (!allowedSlugs) return;
    if (!hashMatchesSelectedSlugs(selectedSlugs)) {
      writeSelectedSlugsToHash(selectedSlugs);
    }
  }, [selectedSlugs, allowedSlugs]);

  const selectedStreams = useMemo(
    () => {
      if (!streams) {
        return [];
      }

      const streamsBySlug = new Map(streams.map((stream) => [stream.slug, stream] as const));
      return selectedSlugs
        .map((slug) => streamsBySlug.get(slug))
        .filter((stream): stream is Stream => stream !== undefined);
    },
    [selectedSlugs, streams],
  );

  return {
    hadHashSelectionOnLoad: initialSelectedSlugs.length > 0,
    selectedSlugs,
    selectedStreams,
    setSelectedSlugs,
  };
}
