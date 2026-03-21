import type { ReactNode } from "react";
import type { Stream } from "../config/types";

export function renderLog(stream: Stream): ReactNode {
  return <pre>{JSON.stringify(stream, null, 2)}</pre>;
}

export function renderStreamDocElement(params: {
  source_url: string;
  title: string;
}) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <title>{params.title}</title>
        <style>{`
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
          }

          body {
            position: relative;
          }

          #player {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
          }

          #status {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: #fff;
            font: 16px sans-serif;
            background: #000;
          }
        `}</style>
      </head>
      <body>
        <video id="player" controls playsInline autoPlay />
        <div id="status">Loading stream...</div>
        <noscript>
          <a href={params.source_url}>Open stream</a>
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                const sourceUrl = ${JSON.stringify(params.source_url)};
                const video = document.getElementById("player");
                const status = document.getElementById("status");

                if (!sourceUrl || !video || !status) {
                  if (status) {
                    status.textContent = "Missing stream source.";
                  }
                  return;
                }

                function showStatus(message) {
                  status.textContent = message;
                  status.style.display = "grid";
                }

                function hideStatus() {
                  status.style.display = "none";
                }

                function attachSource() {
                  if (sourceUrl.includes(".m3u8")) {
                    if (video.canPlayType("application/vnd.apple.mpegurl")) {
                      video.src = sourceUrl;
                      hideStatus();
                      return;
                    }

                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
                    script.onload = function () {
                      if (!window.Hls || !window.Hls.isSupported()) {
                        showStatus("HLS is not supported here.");
                        return;
                      }

                      const hls = new window.Hls();
                      hls.loadSource(sourceUrl);
                      hls.attachMedia(video);
                      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
                        hideStatus();
                      });
                      hls.on(window.Hls.Events.ERROR, function () {
                        showStatus("Unable to load stream.");
                      });
                    };
                    script.onerror = function () {
                      showStatus("Unable to load player library.");
                    };
                    document.head.appendChild(script);
                    return;
                  }

                  video.src = sourceUrl;
                  hideStatus();
                }

                video.addEventListener("error", function () {
                  showStatus("Unable to play stream.");
                });

                attachSource();
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
