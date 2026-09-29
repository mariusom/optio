import { Schema as S } from "effect";
import type { Url } from "foldkit/url";

import { EnsureTemplatesSeeded } from "./web/features/templates/commands";
import { parseRoute } from "./web/routes";
import { GeneratePlaceholderName } from "./app/commands";
import { initialModel } from "./app/model";
import { Accent, Font, IconLibrary, Theme } from "./web/theme";
import { FoldcnStyle } from "./web/style";

export { Model } from "./app/model";
export { subscriptions } from "./app/subscriptions";
export { update } from "./app/update";
export { view } from "./app/view";

/** Startup input read by the browser entry: saved preferences and the boot time. */
export const Flags = S.Struct({
  theme: Theme,
  style: FoldcnStyle,
  font: Font,
  iconLibrary: IconLibrary,
  accent: Accent,
  /** From Effect's Clock, never Date.now(), so the first render has a real time. */
  now: S.Number,
});
export type Flags = typeof Flags.Type;

/** Initial state with default preferences; tests start here. */
export const init = (url: Url) => ({
  model: initialModel(parseRoute(url)),
  commands: [EnsureTemplatesSeeded({}), GeneratePlaceholderName({})],
});

/** Runtime init: the default state with the decoded startup Flags applied. */
export const initWithFlags = (flags: Flags, url: Url) => {
  const initial = init(url);
  return { ...initial, model: { ...initial.model, ...flags } };
};
