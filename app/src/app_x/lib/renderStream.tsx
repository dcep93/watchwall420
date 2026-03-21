import type { ReactNode } from "react";
import type { Stream } from "../config/types";

export function renderLog(stream: Stream): ReactNode {
  return <pre>{JSON.stringify(stream, null, 2)}</pre>;
}

export function renderStreamDocElement(params: {
  iframe_src: string;
  title: string;
}) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <style>{`
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
          }

          iframe {
            display: block;
            width: 100%;
            height: 100%;
            border: 0;
          }
        `}</style>
      </head>
      <body>
        <iframe
          allow="autoplay; fullscreen"
          allowFullScreen
          src={params.iframe_src}
          title={params.title}
        />
      </body>
    </html>
  );
}
