import type { ReactNode } from "react";

export type Stream = {
  slug: string;
  label: string;
  content: string;
  log: string;
};

export type StreamSlug = Stream["slug"];

export type Host = {
  getStreams: () => Promise<Stream[]>;
  renderContent: (stream: Stream) => ReactNode;
};
