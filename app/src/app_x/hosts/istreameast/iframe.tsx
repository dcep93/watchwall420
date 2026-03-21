import type { ReactElement } from "react";
import type { IframeParams } from "./types";

export function renderIstreameastDocElement(params: IframeParams): ReactElement {
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
          <a href={params.playback_url}>Open stream</a>
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(${bootIstreameastPlayer.toString()})(${JSON.stringify(params)});`,
          }}
        />
      </body>
    </html>
  );
}

function bootIstreameastPlayer(params: IframeParams) {
  const playbackUrl = params.playback_url;
  const video = document.getElementById("player") as HTMLVideoElement | null;
  const status = document.getElementById("status") as HTMLDivElement | null;
  const HLS_JS_CDN_URL = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
  const sourceIsHls = /\.m3u8(?:$|[?#])/i.test(playbackUrl);
  let hasStartedPlayback = false;

  function log(event: string, details: Record<string, unknown> = {}) {
    const payload = {
      playbackUrl,
      title: params.title,
      ...details,
    };

    console.log(`renderStream:${event}`, payload);

    try {
      const parentWindow = window.parent as Window & {
        console?: Pick<Console, "log">;
      };
      parentWindow.console?.log(`renderStream:${event}`, payload);
    } catch {
      // Ignore parent-console access failures.
    }
  }

  function showStatus(message: string) {
    log("status", { message });
    if (!status) return;
    status.textContent = message;
    status.style.display = "grid";
  }

  function hideStatus() {
    if (!status) return;
    status.style.display = "none";
  }

  function attemptPlayback() {
    if (!video) return;
    const playResult = video.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((error: unknown) => {
        log("video:play-rejected", {
          error: error instanceof Error ? error.message : String(error),
        });
        showStatus("Press play to start the stream.");
      });
    }
  }

  function handlePlaybackReady(event: string) {
    hasStartedPlayback = true;
    log(event, {
      currentSrc: video?.currentSrc,
      readyState: video?.readyState,
    });
    hideStatus();
    attemptPlayback();
  }

  function attachSource() {
    if (!playbackUrl || !video) {
      showStatus("Missing stream source.");
      return;
    }

    video.crossOrigin = "anonymous";
    video.preload = "auto";

    if (sourceIsHls) {
      log("attach:hls");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        log("hls:native");
        video.src = playbackUrl;
        showStatus("Loading stream...");
        attemptPlayback();
        return;
      }

      loadHlsScript()
        .then(() => {
          const HlsConstructor = (window as Window & {
            Hls?: {
              new (): {
                loadSource: (source: string) => void;
                attachMedia: (media: HTMLMediaElement) => void;
                on: (event: string, cb: (...args: unknown[]) => void) => void;
              };
              isSupported: () => boolean;
              Events: {
                MANIFEST_PARSED: string;
                ERROR: string;
              };
            };
          }).Hls;

          log("hls:script-loaded", { hasHls: Boolean(HlsConstructor) });

          if (!HlsConstructor || !HlsConstructor.isSupported()) {
            showStatus("HLS is not supported here.");
            return;
          }

          const hls = new HlsConstructor();
          log("hls:created");
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          hls.on(HlsConstructor.Events.MANIFEST_PARSED, function () {
            handlePlaybackReady("hls:manifest-parsed");
          });
          hls.on(HlsConstructor.Events.ERROR, function (_event, data) {
            log("hls:error", { data });
            showStatus("Unable to load stream.");
          });
        })
        .catch(() => {
          log("hls:script-error");
          showStatus("Unable to load player library.");
        });
      return;
    }

    log("attach:direct");
    video.src = playbackUrl;
    showStatus("Loading stream...");
    attemptPlayback();
  }

  function loadHlsScript() {
    const windowWithHls = window as Window & {
      Hls?: unknown;
      __watchwallHlsScriptPromise__?: Promise<void>;
    };

    if (windowWithHls.Hls) {
      return Promise.resolve();
    }

    if (windowWithHls.__watchwallHlsScriptPromise__) {
      return windowWithHls.__watchwallHlsScriptPromise__;
    }

    windowWithHls.__watchwallHlsScriptPromise__ = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[data-watchwall-hls="true"]`,
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("HLS script failed.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = HLS_JS_CDN_URL;
      script.async = true;
      script.dataset.watchwallHls = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("HLS script failed."));
      document.head.appendChild(script);
    }).catch((error) => {
      delete windowWithHls.__watchwallHlsScriptPromise__;
      log("hls:script-load-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });

    return windowWithHls.__watchwallHlsScriptPromise__;
  }

  if (!video) {
    showStatus("Missing player element.");
    return;
  }

  video.addEventListener("loadstart", function () {
    log("video:loadstart", {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      readyState: video.readyState,
    });
  });

  video.addEventListener("loadedmetadata", function () {
    log("video:loadedmetadata", {
      currentSrc: video.currentSrc,
      duration: video.duration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });
  });

  video.addEventListener("canplay", function () {
    handlePlaybackReady("video:canplay");
  });

  video.addEventListener("playing", function () {
    handlePlaybackReady("video:playing");
  });

  video.addEventListener("waiting", function () {
    if (!hasStartedPlayback) {
      showStatus("Loading stream...");
      return;
    }
    showStatus("Buffering stream...");
  });

  video.addEventListener("stalled", function () {
    showStatus("Stream stalled. Retrying...");
  });

  video.addEventListener("error", function () {
    const error = video.error;
    log("video:error", {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      readyState: video.readyState,
      code: error ? error.code : null,
      message: error ? error.message : null,
    });
    showStatus("Unable to play stream.");
  });

  log("init");
  attachSource();
}
