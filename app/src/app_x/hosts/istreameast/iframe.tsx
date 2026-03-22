import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastPlayerDocument(iframeParams: IframeParams): ReactElement {
  const scrollGuardScript = `
    (() => {
      const MESSAGE_SOURCE = "watchwall420-extension";
      const POOEMBED_LOADED = "watchwall420:pooembed-loaded";
      let releaseHorizontalScrollGuard = null;

      window.addEventListener("message", (event) => {
        if (event.data?.source !== MESSAGE_SOURCE || event.data?.type !== POOEMBED_LOADED) {
          return;
        }

        releaseHorizontalScrollGuard?.();
        releaseHorizontalScrollGuard = holdTopHorizontalScrollPosition();
      });

      function holdTopHorizontalScrollPosition() {
        const scrollWindow = window.top ?? window;
        const lockedX = scrollWindow.scrollX;
        let frameId = 0;
        let released = false;

        const restoreScrollX = () => {
          if (released) {
            return;
          }

          if (scrollWindow.scrollX !== lockedX) {
            scrollWindow.scrollTo(lockedX, scrollWindow.scrollY);
          }

          frameId = window.requestAnimationFrame(restoreScrollX);
        };

        restoreScrollX();

        function release() {
          if (released) {
            return;
          }

          released = true;
          window.cancelAnimationFrame(frameId);

          if (scrollWindow.scrollX !== lockedX) {
            scrollWindow.scrollTo(lockedX, scrollWindow.scrollY);
          }
        }

        return release;
      }
    })();
  `;

  return (
    <html lang="en">
      <head>
        <base href={iframeParams._1_rawUrl} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: scrollGuardScript }} />
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
