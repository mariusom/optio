import { BrowserHost, Html } from "@effect/ui/html";
import { Array, Effect, Exit, Scope } from "effect";

import { App } from "../application";
import { CurrentAgentBridge, makeAgentBridge, type AgentBridge } from "../agents/bridge";
import type { Flags } from "../main";
import { Message, type UpdateResult } from "../messages";
import type { H, Ui } from "@/lib/view";
import { Model } from "./model";
import { subscriptions } from "./subscriptions";
import { update } from "./update";

/** A root mounted by a browser test; `dispose` unmounts it and stops its Commands. */
export interface Mounted {
  readonly bridge: AgentBridge;
  readonly dispose: () => Promise<void>;
}

const mountIn = <E>(
  container: Element,
  mount: (container: Element) => Effect.Effect<unknown, E, Scope.Scope>,
): Promise<Mounted> => {
  const bridge = makeAgentBridge();
  const scope = Scope.makeUnsafe();
  return Effect.runPromise(
    mount(container).pipe(
      Effect.provideService(CurrentAgentBridge, bridge),
      Scope.provide(scope),
      Effect.as({ bridge, dispose: () => Effect.runPromise(Scope.close(scope, Exit.void)) }),
    ),
  );
};

/** The whole app, as entry.ts mounts it, with its own agent bridge. */
export const mountApp = (flags: Flags, container: Element) =>
  mountIn(container, (target) => BrowserHost.mountEffect(App, flags, target));

/** What `mountView` shows, where, and its overrides: a wrapped update and the subscriptions to run. */
export interface ViewOptions {
  readonly model: Model;
  readonly view: (model: Model, h: H<Message>) => Ui;
  readonly container: Element;
  readonly update?: (model: Model, message: Message) => UpdateResult<Model>;
  readonly subscriptions?: ReadonlyArray<string>;
}

/**
 * One view of the app Model, running the app's update and Commands. It runs
 * only the named app subscriptions (none by default), so a test controls
 * which store data arrives.
 */
export const mountView = ({ model, view, container, ...options }: ViewOptions) =>
  mountIn(container, (target) =>
    BrowserHost.mountEffect(
      Html.component({ name: "OptioView", props: Model, model: Model, message: Message }).make({
        init: ($) => $.props,
        update: ($, message) => {
          const result = (options.update ?? update)($.model, message);
          return $.set(result.model).run(...(result.commands ?? []));
        },
        subscriptions: ({ model: current }) =>
          Array.filter(
            subscriptions(current),
            (subscription) =>
              subscription !== false && (options.subscriptions ?? []).includes(subscription.name),
          ),
        view: (h, current) => view(current, h),
      }),
      model,
      target,
    ),
  );
