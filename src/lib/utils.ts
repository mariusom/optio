import { cn as mergeClasses } from "cn";
import { getCurrentStyleClasses } from "@/we/style";

/** Resolve foldcn's upstream per-style component classes before merging any
 * app-owned sizing/customization classes. */
export const cn = (...classes: Parameters<typeof mergeClasses>): string => {
  const replacements = getCurrentStyleClasses();
  return mergeClasses(
    ...classes.map((value) => (typeof value === "string" ? (replacements[value] ?? value) : value)),
  );
};
