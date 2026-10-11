/**
 * Saves text as a file with a Safari-compatible Blob URL and `a[download]`.
 * Outside a browser it does nothing; it throws if the browser refuses.
 */
export const saveTextFile = (content: string, filename: string, type: string): void => {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};
