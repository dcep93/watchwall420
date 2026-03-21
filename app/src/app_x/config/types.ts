import type { ReactElement } from "react";

export const Categories = [
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

export type Category = (typeof Categories)[number];

export type Stream = {
  espn_id: number;
  raw_url: string;
  title: string;
  slug: string;
};

export type StreamSlug = Stream["slug"];

export type Host<T> = {
  getStreams: (category: Category) => Promise<Stream[]>;
  getIframeParams: (stream: Stream) => Promise<T>;
  getIframeDocStrElement: (params: T) => ReactElement;
};
