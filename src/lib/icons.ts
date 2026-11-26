import { Array, Record, String, pipe } from "effect";
import type { IconNode } from "lucide";
import type { H } from "@/lib/view";
import { iconNodeForCurrentLibrary, type HugeIconNode } from "./iconPreference";

const svgShapes = new Set(["path", "circle", "rect", "line", "polyline", "polygon"]);

/** Icon-node attributes as SVG attributes: ASCII camelCase becomes kebab-case. */
const shapeAttributes = (attrs: Readonly<Record<string, string | number>>) =>
  Record.fromEntries(
    Array.flatMap(Record.toEntries(attrs), ([name, value]) =>
      name === "key"
        ? []
        : [
            [
              pipe(name, String.replace(/[A-Z]/g, "-$&"), String.toLowerCase),
              globalThis.String(value),
            ],
          ],
    ),
  );

const defaultIconClass = "size-4 shrink-0";

type IconPosition = "inline-start" | "inline-end";
type IconOptions = Readonly<{ className?: string; position?: IconPosition }>;

/** Decorative SVG icon from a lucide node, in the preferred icon library. */
export const icon = <M>(
  h: H<M>,
  node: IconNode,
  options: string | IconOptions = defaultIconClass,
) => {
  const className = typeof options === "string" ? options : (options.className ?? defaultIconClass);
  const position = typeof options === "string" ? undefined : options.position;
  // Effect UI creates SVG tags in the SVG namespace by name.
  return h
    .el("svg")
    .attrs({
      "aria-hidden": "true",
      class: className,
      fill: "none",
      viewBox: "0 0 24 24",
      "stroke-width": "2",
      stroke: "currentColor",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "data-icon": position,
    })
    .children(
      Array.map(iconNodeForCurrentLibrary(node) as HugeIconNode, ([tag, attrs]) =>
        h.el(svgShapes.has(tag) ? tag : "path").attrs(shapeAttributes(attrs)),
      ),
    );
};
