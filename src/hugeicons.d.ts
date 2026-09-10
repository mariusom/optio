// Hugeicons 4.3.2 exports per-icon JS but omits the matching per-icon declarations.
// Use the package's own node type while retaining small, direct runtime imports.
declare module "@hugeicons/core-free-icons/*" {
  const icon: typeof import("@hugeicons/core-free-icons").Alert01Icon;
  export default icon;
}
