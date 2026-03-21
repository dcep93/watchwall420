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
  const hash = slugs.join(",");
  const url = new URL(window.location.href);

  if (hash) {
    url.hash = hash;
  } else {
    url.hash = "";
  }

  window.history.replaceState(null, "", url);
}

function haveSameOrder(left: StreamSlug[], right: StreamSlug[]) {
  return left.length === right.length && left.every((slug, index) => slug === right[index]);
}

export default function useSelectedStreamIds() {
  const [selectedSlugs, setSelectedSlugs] = useState<StreamSlug[]>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => {
      setSelectedSlugs(parseHash(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!haveSameOrder(parseHash(window.location.hash), selectedSlugs)) {
      writeHash(selectedSlugs);
    }
  }, [selectedSlugs]);

  const selectedStreams = useMemo(
    () => STREAMS.filter((stream) => selectedSlugs.includes(stream.slug)),
    [selectedSlugs],
  );

  return {
    selectedSlugs,
    selectedStreams,
    setSelectedSlugs,
  };
}
