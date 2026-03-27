(() => {
  const HOST_HOSTNAMES = new Set(["localhost", "watchwall420.web.app"]);
  const APP_MESSAGE_SOURCE = "watchwall420-app";
  const SET_MUTED = "watchwall420:set-muted";
  const TOGGLE_MUTE = "watchwall420:toggle-mute";
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const isDescendantOfWatchwallHost = ancestorOrigins.some((origin) =>
    HOST_HOSTNAMES.has(new URL(origin).hostname),
  );
  let hasUserInteracted = false;
  let currentVideo = null;
  let requestedMutedState = true;
  let didMute = null;

  if (!isDescendantOfWatchwallHost) {
    return;
  }

  const markUserInteraction = () => {
    hasUserInteracted = true;
  };

  window.addEventListener("pointerdown", markUserInteraction, { capture: true });
  window.addEventListener("keydown", markUserInteraction, { capture: true });
  window.addEventListener("touchstart", markUserInteraction, { capture: true });
  window.addEventListener("click", markUserInteraction, { capture: true });

  window.addEventListener("message", (event) => {
    if (event.data?.source !== APP_MESSAGE_SOURCE) {
      return;
    }

    if (event.data?.type === SET_MUTED) {
      requestedMutedState = event.data.muted !== false;
      applyRequestedMutedState();
      return;
    }

    if (event.data?.type !== TOGGLE_MUTE) {
      return;
    }

    if (!hasUserInteracted || !(currentVideo instanceof HTMLVideoElement)) {
      return;
    }

    currentVideo.muted = !currentVideo.muted;
    requestedMutedState = currentVideo.muted;
    didMute = false;
  });

  waitForVideoElement();

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
    currentVideo = video;
    didMute = null;
    video.autoplay = true;
    video.playsInline = true;
    applyRequestedMutedState();
    const playResult = video.play();

    if (!playResult || typeof playResult.then !== "function") {
      return;
    }

    void playResult.catch((error) => {
      console.log("watchwall:pooembed:play-error", error);
    });
  }

  function applyRequestedMutedState() {
    if (!(currentVideo instanceof HTMLVideoElement)) {
      return;
    }

    if (requestedMutedState) {
      didMute = didMute ?? !currentVideo.muted;
      currentVideo.muted = true;
      return;
    }

    if (hasUserInteracted && didMute) {
      currentVideo.muted = false;
    }

    didMute = false;
  }

})();
