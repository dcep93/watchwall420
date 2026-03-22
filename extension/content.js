(() => {
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const ancestorHostnames = ancestorOrigins.map((origin) => new URL(origin).hostname);

  if (ancestorHostnames.includes("localhost")) {
    alert("rendered as a descendant of localhost");
    return;
  }

  if (ancestorHostnames.includes("watchwall420.web.app")) {
    alert("rendered as a descendant of watchwall420.web.app");
    return;
  }
})();
