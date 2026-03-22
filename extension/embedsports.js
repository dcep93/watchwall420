(() => {
  const APP_MESSAGE_SOURCE = "watchwall420-app";
  const TOGGLE_MUTE = "watchwall420:toggle-mute";
  const dontfoid = document.querySelector("#dontfoid");

  if (dontfoid instanceof HTMLElement) {
    dontfoid.style.display = "none";
  }

  window.addEventListener("message", (event) => {
    if (event.data?.source !== APP_MESSAGE_SOURCE || event.data?.type !== TOGGLE_MUTE) {
      return;
    }

    console.log("watchwall:toggle-mute:received-in-embedsports", event.data);

    document.querySelectorAll("iframe").forEach((iframe) => {
      iframe.contentWindow?.postMessage(event.data, "*");
    });
  });
})();
