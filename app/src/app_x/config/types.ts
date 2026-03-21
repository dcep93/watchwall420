export type Stream = {
  title: string;
  slug: string;
  renderContent: string;
};

export type StreamSlug = Stream["slug"];

export type Host = {
  getStreams: () => Promise<Stream[]>;
};
