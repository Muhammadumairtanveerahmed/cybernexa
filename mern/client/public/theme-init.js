// Runs before the app so the saved theme is applied without a flash.
// Kept as an external file (not inline) so the SPA can use a strict
// `script-src 'self'` Content-Security-Policy.
(function () {
  try {
    var saved = localStorage.getItem("technexa_theme");
    var theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f6f8fc" : "#060912");
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
})();
