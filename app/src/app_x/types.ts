export type StreamId = "A" | "B" | "C";

export type Stream = {
  id: StreamId;
  label: StreamId;
  log: Lowercase<StreamId>;
};
