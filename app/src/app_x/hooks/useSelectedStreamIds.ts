import { useEffect, useMemo, useState } from "react";
import { STREAMS } from "../config/data";
import type { StreamSlug } from "../config/types";

const VALID_SLUGS = new Set<StreamSlug>(STREAMS.map((stream) => stream.slug));

function parseHash(hash: string): StreamSlug[] {
  return hash
    .replace(/^#/, "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(isUniqueValidSlug);
}

function isUniqueValidSlug(
  slug: string,
  index: number,
  array: string[],
): slug is StreamSlug {
  return VALID_SLUGS.has(slug as StreamSlug) && array.indexOf(slug) === index;
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

export default function useSelectedStreamIds() {
  const [initialSelectedSlugs] = useState<StreamSlug[]>(() => parseHash(window.location.hash));
  const [selectedSlugs, setSelectedSlugs] = useState<StreamSlug[]>(initialSelectedSlugs);

  useEffect(() => {
    const onHashChange = () => {
      setSelectedSlugs(parseHash(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!hasCanonicalHash(selectedSlugs)) {
      writeHash(selectedSlugs);
    }
  }, [selectedSlugs]);

  const selectedStreams = useMemo(
    () => STREAMS.filter((stream) => selectedSlugs.includes(stream.slug)),
    [selectedSlugs],
  );

  return {
    hadHashSelectionOnLoad: initialSelectedSlugs.length > 0,
    selectedSlugs,
    selectedStreams,
    setSelectedSlugs,
  };
}
