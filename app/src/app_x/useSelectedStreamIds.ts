import { useEffect, useMemo, useState } from "react";
import { STREAMS } from "./data";

const VALID_SLUGS = new Set(STREAMS.map((stream) => stream.slug));

function parseHash(hash: string) {
  const slugs = hash
    .replace(/^#/, "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug, index, array) => VALID_SLUGS.has(slug) && array.indexOf(slug) === index);

  return slugs;
}

function writeHash(slugs: string[]) {
  const hash = slugs.join(",");
  const url = new URL(window.location.href);

  if (hash) {
    url.hash = hash;
  } else {
    url.hash = "";
  }

  window.history.replaceState(null, "", url);
}

export default function useSelectedStreamIds() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
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
    const currentHashIds = parseHash(window.location.hash);
    const same =
      currentHashIds.length === selectedSlugs.length &&
      currentHashIds.every((slug, index) => slug === selectedSlugs[index]);

    if (!same) {
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
