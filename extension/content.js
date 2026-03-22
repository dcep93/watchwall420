(() => {
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const ancestorHostnames = ancestorOrigins.map((origin) => new URL(origin).hostname);

  if (!["localhost", "watchwall420.web.app"].some((hostname) => ancestorHostnames.includes(hostname))) {
    return;
  }

  alert("content.js")
})();
