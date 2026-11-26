import { Schema } from "effect";

import { EnsureTemplatesSeeded } from "./web/features/templates/commands";
import { parseRoute } from "./web/routes";
import { GeneratePlaceholderName } from "./app/commands";
import { AssistantAccess, initialModel } from "./app/model";
import { Accent, ControlSize, Font, IconLibrary, Look, Theme } from "./web/theme";
import { FoldcnStyle } from "./web/style";

export { Model } from "./app/model";
export { subscriptions } from "./app/subscriptions";
export { update } from "./app/update";
export { view } from "./app/view";

/** Startup input read by the browser entry: saved preferences and the boot time. */
export const Flags = Schema.Struct({
  assistantAccess: AssistantAccess,
  theme: Theme,
  style: FoldcnStyle,
  font: Font,
  iconLibrary: IconLibrary,
  accent: Accent,
  look: Look,
  controlSize: ControlSize,
  /** From Effect's Clock, never Date.now(), so the first render has a real time. */
  now: Schema.Finite,
  /** Random per boot, so IDs that update derives from it are unique (see `takeId`). */
  idSeed: Schema.String,
});
export type Flags = typeof Flags.Type;

/** Initial state with default preferences for a URL fragment; tests start here. */
export const init = (hash: string) => ({
  model: initialModel(parseRoute(hash)),
  commands: [EnsureTemplatesSeeded.make({}), GeneratePlaceholderName.make({})],
});

/** Runtime init: the default state with the decoded startup Flags applied. */
export const initWithFlags = (flags: Flags, hash: string) => {
  const initial = init(hash);
  return { ...initial, model: { ...initial.model, ...flags } };
};
