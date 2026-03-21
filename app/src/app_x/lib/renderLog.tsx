import type { ReactNode } from "react";
import type { Stream } from "../config/types";

export default function renderLog(stream: Stream): ReactNode {
  return <pre>{JSON.stringify(stream, null, 2)}</pre>;
}
