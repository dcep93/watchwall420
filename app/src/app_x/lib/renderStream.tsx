import type { ReactNode } from "react";
import type { Stream } from "../config/types";

export function renderLog(stream: Stream): ReactNode {
  return <pre>{JSON.stringify(stream)}</pre>;
}

export function renderStreamJsonHtml(stream: Stream) {
  return `<pre>${escapeHtml(JSON.stringify(stream))}</pre>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
