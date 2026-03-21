import type { ReactElement } from "react";

export type StreamCategory = string;
export type Category = string;

export type Stream = {
  category: StreamCategory;
  espn_id: number;
  raw_url: string;
  title: string;
  slug: string;
};

export type StreamSlug = Stream["slug"];

export type Host<T> = {
  getLeagueCategories: () => readonly string[];
  getStreams: () => Promise<Stream[]>;
  getIframeParams: (stream: Stream) => Promise<T>;
  getIframeDocStrElement: (params: T) => ReactElement;
};
