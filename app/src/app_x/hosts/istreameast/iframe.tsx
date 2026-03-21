import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastPlayerDocument(iframeParams: IframeParams): ReactElement {
  return (
    <html lang="en">
      <head>
        <base href={iframeParams._embedPageUrl} />
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body style="margin: 0; padding: 0; overflow-y: hidden; background: #000">
        <iframe
          src={iframeParams._iframeSourcePageUrl}
          frameborder="0"
          style="
        overflow: hidden;
        overflow-x: hidden;
        overflow-y: hidden;
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      "
          height="100%"
          width="100%"
          allowfullscreen
          scrolling="no"
          allowtransparency
        ></iframe>
      </body>
    </html>
  );
}
