import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastPlayerDocument(iframeParams: IframeParams): ReactElement {
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
        `}</style>
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.fid = ${JSON.stringify(iframeParams.fid)};
              window.v_width = "100%";
              window.v_height = "100%";
            `,
          }}
        />
        <script src="https://exposestrat.com/maestrohd1.js" />
      </body>
    </html>
  );
}
