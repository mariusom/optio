import { cn as mergeClasses } from "cn";
import { foldcnComponentStyles } from "@/we/componentStyles.generated";
import { getCurrentStyle } from "@/we/style";

/** Resolve foldcn's upstream per-style component classes before merging any
 * app-owned sizing/customization classes. `default` is foldcn's Nova alias. */
export const cn = (...classes: Parameters<typeof mergeClasses>): string => {
  const style = getCurrentStyle();
  const replacements = foldcnComponentStyles[style === "default" ? "nova" : style] ?? {};
  return mergeClasses(
    ...classes.map((value) => (typeof value === "string" ? (replacements[value] ?? value) : value)),
  );
};
