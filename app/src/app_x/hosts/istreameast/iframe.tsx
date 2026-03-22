import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastPlayerDocument(iframeParams: IframeParams): ReactElement {
  const scrollLockScript = `
    (() => {
      const topWindow = window.top ?? window;
      const lockCurrentHorizontalScroll = () => {
        const lockedX = topWindow.scrollX;

        const restoreScrollX = () => {
          if (topWindow.scrollX !== lockedX) {
            topWindow.scrollTo(lockedX, topWindow.scrollY);
            return;
          }

          topWindow.requestAnimationFrame(restoreScrollX);
        };

        restoreScrollX();
      };

      const attachLoadListener = () => {
        const playerFrame = document.getElementById("watchwall-player-frame");

        if (playerFrame) {
          playerFrame.addEventListener(
            "load",
            () => {
              lockCurrentHorizontalScroll();
            },
            { once: true },
          );
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", attachLoadListener, { once: true });
      } else {
        attachLoadListener();
      }
    })();
  `;

  return (
    <html lang="en">
      <head>
        <base href={iframeParams._1_rawUrl} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: scrollLockScript }} />
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
          id="watchwall-player-frame"
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
