(() => {
  const HOST_HOSTNAMES = new Set(["localhost", "watchwall420.web.app"]);
  const MESSAGE_SOURCE = "watchwall420-extension";
  const POOEMBED_LOADED = "watchwall420:pooembed-loaded";
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const isDescendantOfWatchwallHost = ancestorOrigins.some((origin) =>
    HOST_HOSTNAMES.has(new URL(origin).hostname),
  );

  console.log("watchwall:pooembed:init", {
    href: window.location.href,
    ancestorOrigins,
    isDescendantOfWatchwallHost,
  });

  if (!isDescendantOfWatchwallHost) {
    return;
  }

  waitForVideoElement();
  notifyParents(POOEMBED_LOADED);

  function waitForVideoElement() {
    let stopped = false;

    const checkForVideo = () => {
      if (stopped) {
        return;
      }

      const video = document.querySelector("video");

      if (video instanceof HTMLVideoElement) {
        stopped = true;
        init(video);
        return;
      }

      window.requestAnimationFrame(checkForVideo);
    };

    checkForVideo();
  }

  function init(video) {
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    console.log("watchwall:pooembed:play-attempt");
    const playResult = video.play();

    if (!playResult || typeof playResult.then !== "function") {
      return;
    }

    void playResult.catch((error) => {
      console.log("watchwall:pooembed:play-error", error);
    });
  }

  function notifyParents(type) {
    let currentWindow = window;

    while (currentWindow.parent && currentWindow.parent !== currentWindow) {
      currentWindow = currentWindow.parent;
      currentWindow.postMessage({ source: MESSAGE_SOURCE, type }, "*");
    }
  }
})();
