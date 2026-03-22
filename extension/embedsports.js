(() => {
  const APP_MESSAGE_SOURCE = "watchwall420-app";
  const SET_MUTED = "watchwall420:set-muted";
  const TOGGLE_MUTE = "watchwall420:toggle-mute";
  const hideDontfoid = () => {
    const dontfoid = document.querySelector("#dontfoid");

    if (dontfoid instanceof HTMLElement) {
      dontfoid.style.display = "none";
      return;
    }

    window.requestAnimationFrame(hideDontfoid);
  };

  hideDontfoid();

  window.addEventListener("message", (event) => {
    if (
      event.data?.source !== APP_MESSAGE_SOURCE ||
      ![TOGGLE_MUTE, SET_MUTED].includes(event.data?.type)
    ) {
      return;
    }

    document.querySelectorAll("iframe").forEach((iframe) => {
      iframe.contentWindow?.postMessage(event.data, "*");
    });
  });
})();
