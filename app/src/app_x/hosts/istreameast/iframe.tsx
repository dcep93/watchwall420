import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastPlayerDocument(iframeParams: IframeParams): ReactElement {
  return (
    <html lang="en">
      <head>
        <base href={iframeParams._1_rawUrl} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          overflowY: "hidden",
          background: "#000",
        }}
      >
        <iframe
          src={iframeParams._2_embedPageUrl}
          tabIndex={-1}
          frameBorder="0"
          style={{
            overflow: "hidden",
            overflowX: "hidden",
            overflowY: "hidden",
            height: "100%",
            width: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          height="100%"
          width="100%"
          allowFullScreen
          scrolling="no"
          allowTransparency
        />
      </body>
    </html>
  );
}
