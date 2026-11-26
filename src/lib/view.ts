import type { View } from "@effect/ui";
import type { Html } from "@effect/ui/html";

/** The element helper every view function takes. */
export type H<M> = Html.H<M>;

/** What a view function renders, whatever messages it sends. */
export type Ui = View.Content<any>;
