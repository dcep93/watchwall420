(() => {
  const HOST_HOSTNAMES = new Set(["localhost", "watchwall420.web.app"]);
  const MESSAGE_SOURCE = "watchwall420-extension";
  const POOEMBED_LOADED = "watchwall420:pooembed-loaded";
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const isDescendantOfWatchwallHost = ancestorOrigins.some((origin) =>
    HOST_HOSTNAMES.has(new URL(origin).hostname),
  );

  if (!isDescendantOfWatchwallHost) {
    return;
  }

  waitForVideoElement();
  notifyParents(POOEMBED_LOADED);

  function waitForVideoElement() {
    const checkForVideo = () => {
      const video = document.querySelector("video");

      if (video instanceof HTMLVideoElement) {
        if (isVideoReady(video)) {
          init(video);
          return;
        }
      }

      window.requestAnimationFrame(checkForVideo);
    };

    checkForVideo();
  }

  function init(video) {
    void video.play();
  }

  function isVideoReady(video) {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  function notifyParents(type) {
    let currentWindow = window;

    while (currentWindow.parent && currentWindow.parent !== currentWindow) {
      currentWindow = currentWindow.parent;
      currentWindow.postMessage({ source: MESSAGE_SOURCE, type }, "*");
    }
  }
})();
