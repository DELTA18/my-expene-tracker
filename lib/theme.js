// Applies an explicit light/dark override by toggling a class on <html> (see
// the .dark/:not(.light) rules in globals.css), or clears it for "system" to
// fall back to prefers-color-scheme. Also mirrors the choice into
// localStorage so the next load on *this* device can apply it before
// Firestore/auth resolve — see the inline script in layout.js.
export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("light", "dark");
  if (theme === "light" || theme === "dark") {
    document.documentElement.classList.add(theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  } else {
    try {
      localStorage.removeItem("theme");
    } catch {}
  }
}
