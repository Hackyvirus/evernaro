// Runs before paint (inlined in <head>) to set data-theme on <html> without
// a flash of the wrong theme. Falls back to OS preference when the user
// hasn't explicitly chosen a theme yet.
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;
