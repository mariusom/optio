import { Array, Record, String, pipe } from "effect";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";
import type { IconNode, SVGProps } from "lucide";
import { iconNodeForCurrentLibrary, type HugeIconNode } from "./iconPreference";

const svgElement =
  <M>(tag: string, h: HtmlBuilder<M>) =>
  (attributes: ReadonlyArray<Attribute<M> | ChildAttribute>): Html => {
    switch (tag) {
      case "path":
        return h.path(attributes);
      case "circle":
        return h.circle(attributes);
      case "rect":
        return h.rect(attributes);
      case "line":
        return h.line(attributes);
      case "polyline":
        return h.polyline(attributes);
      case "polygon":
        return h.polygon(attributes);
      default:
        return h.path(attributes);
    }
  };

const svgAttributes = <M>(
  className: string,
  h: HtmlBuilder<M>,
): ReadonlyArray<Attribute<M> | ChildAttribute> => [
  h.AriaHidden(true),
  h.Class(className),
  h.Xmlns("http://www.w3.org/2000/svg"),
  h.Fill("none"),
  h.ViewBox("0 0 24 24"),
  h.StrokeWidth("2"),
  h.Stroke("currentColor"),
  h.StrokeLinecap("round"),
  h.StrokeLinejoin("round"),
];

const nodeToAttributes = <M>(
  attrs: SVGProps | { readonly [name: string]: string | number },
  h: HtmlBuilder<M>,
): ReadonlyArray<Attribute<M> | ChildAttribute> =>
  Array.flatMap(Record.toEntries(attrs), ([name, value]) =>
    name === "key"
      ? []
      : [
          h.Attribute(
            // SVG attribute names are ASCII camelCase: strokeWidth -> stroke-width.
            pipe(name, String.replace(/[A-Z]/g, "-$&"), String.toLowerCase),
            globalThis.String(value),
          ),
        ],
  );

const defaultIconClass = "size-4 shrink-0";

type IconPosition = "inline-start" | "inline-end";
type IconOptions = Readonly<{ className?: string; position?: IconPosition }>;

export const icon = <M>(
  h: HtmlBuilder<M>,
  node: IconNode,
  options: string | IconOptions = defaultIconClass,
): Html => {
  const className = typeof options === "string" ? options : (options.className ?? defaultIconClass);
  const position = typeof options === "string" ? undefined : options.position;
  return h.svg(
    [
      ...svgAttributes(className, h),
      ...(position === undefined ? [] : [h.DataAttribute("icon", position)]),
    ],
    Array.map(iconNodeForCurrentLibrary(node) as HugeIconNode, ([tag, attrs]) =>
      svgElement(tag, h)(nodeToAttributes(attrs, h)),
    ),
  );
};
