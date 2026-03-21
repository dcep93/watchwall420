import type { ReactNode } from "react";
import type { Stream } from "../config/types";

export function renderLog(stream: Stream): ReactNode {
  return <pre>{JSON.stringify(stream, null, 2)}</pre>;
}

export function renderStreamDocElement(params: { html_str: string }) {
  return (
    <html>
      <head>
        <style>{`
          body {
            margin: 0;
            padding: 16px;
            color: white;
            background: #081018;
            font-family: sans-serif;
          }

          pre {
            white-space: pre-wrap;
          }

          video {
            display: block;
            width: 100%;
            max-width: 960px;
            margin-top: 16px;
          }
        `}</style>
      </head>
      <body>
        <pre>{params.html_str}</pre>
        <video
          controls
          src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        />
      </body>
    </html>
  );
}
