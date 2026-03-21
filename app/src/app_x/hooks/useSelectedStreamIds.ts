import { useEffect, useMemo, useState } from "react";
import type { Stream, StreamSlug } from "../config/types";

function parseHash(hash: string, validSlugs: Set<StreamSlug>): StreamSlug[] {
  return hash
    .replace(/^#/, "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug, index, array): slug is StreamSlug => isUniqueValidSlug(slug, index, array, validSlugs));
}

function isUniqueValidSlug(
  slug: string,
  index: number,
  array: string[],
  validSlugs: Set<StreamSlug>,
): slug is StreamSlug {
  return validSlugs.has(slug as StreamSlug) && array.indexOf(slug) === index;
}

function writeHash(slugs: StreamSlug[]) {
  const hash = getHashValue(slugs);
  const url = new URL(window.location.href);

  if (hash) {
    url.hash = hash;
  } else {
    url.hash = "";
  }

  window.history.replaceState(null, "", url);
}

function getHashValue(slugs: StreamSlug[]) {
  return slugs.join(",");
}

function hasCanonicalHash(slugs: StreamSlug[]) {
  return window.location.hash.replace(/^#/, "") === getHashValue(slugs);
}

export default function useSelectedStreamIds(streams: Stream[]) {
  const validSlugs = useMemo(() => new Set<StreamSlug>(streams.map((stream) => stream.slug)), [streams]);
  const [initialHash] = useState(() => window.location.hash);
  const initialSelectedSlugs = useMemo(
    () => parseHash(initialHash, validSlugs),
    [initialHash, validSlugs],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<StreamSlug[]>(() =>
    parseHash(window.location.hash, validSlugs),
  );

  useEffect(() => {
    const onHashChange = () => {
      setSelectedSlugs(parseHash(window.location.hash, validSlugs));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [validSlugs]);

  useEffect(() => {
    setSelectedSlugs(parseHash(window.location.hash, validSlugs));
  }, [validSlugs]);

  useEffect(() => {
    if (!hasCanonicalHash(selectedSlugs)) {
      writeHash(selectedSlugs);
    }
  }, [selectedSlugs]);

  const selectedStreams = useMemo(
    () => streams.filter((stream) => selectedSlugs.includes(stream.slug)),
    [selectedSlugs, streams],
  );

  return {
    hadHashSelectionOnLoad: initialSelectedSlugs.length > 0,
    selectedSlugs,
    selectedStreams,
    setSelectedSlugs,
  };
}
