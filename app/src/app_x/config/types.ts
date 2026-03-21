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
  title: string;
  slug: string;
};

export type StreamSlug = Stream["slug"];

export type Host = {
  getStreams: (category: Category) => Promise<Stream[]>;
  getIframeDocStr: (stream: Stream) => string;
};
