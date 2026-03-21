import type { ReactElement } from "react";

export const LeagueCategories = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "CFL",
  "CFB",
  "NCAAB",
  "UFC",
  "BOXING",
  "SOCCER",
  "F1",
] as const;

export const Categories = ["ALL", ...LeagueCategories] as const;

export type Category = (typeof Categories)[number];
export type StreamCategory = (typeof LeagueCategories)[number];

export type Stream = {
  category: StreamCategory;
  espn_id: number;
  raw_url: string;
  title: string;
  slug: string;
};

export type StreamSlug = Stream["slug"];

export type Host<T> = {
  getLeagueCategories: () => readonly StreamCategory[];
  getStreams: (category: Category) => Promise<Stream[]>;
  getIframeParams: (stream: Stream) => Promise<T>;
  getIframeDocStrElement: (params: T) => ReactElement;
};
