import { Html } from "@effect/ui/html";
import { HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { H, Ui } from "@/lib/view";
import { input } from "./input";
import { textarea } from "./textarea";
import { checkbox } from "./checkbox";
import { switch_ } from "./switch";
import { nativeSelect } from "./native-select";
import { fieldset, fieldError } from "./fieldset";
import * as Dialog from "./dialog";
import * as AlertDialog from "./alert-dialog";
import * as Sheet from "./sheet";

/** Renders a view function inside a throwaway component and returns the
 *  scene's structural tree. */
const render = (view: (h: H<string>) => Ui | null) =>
  Effect.gen(function* () {
    const Host = Html.component({
      name: "RegistryHost",
      model: Schema.Null,
      message: Schema.String,
    }).make({
      init: () => null,
      update: ($) => $.model,
      view: (h) => h.div.children(view(h)),
    });
    const s = yield* HtmlScene.make(Host, {});
    return Locator.elements(s.root);
  });

const config = { id: "answer", label: "Answer", isChecked: false, onToggle: () => "toggle" };
const controls: Record<string, (description: string | undefined, h: H<string>) => Ui> = {
  input: (description, h) => input({ ...config, description }, h),
  textarea: (description, h) => textarea({ ...config, description }, h),
  checkbox: (description, h) => checkbox({ ...config, description }, h),
  switch: (description, h) => switch_({ ...config, description }, h),
  select: (description, h) => nativeSelect({ ...config, description, options: [] }, h),
  fieldset: (description, h) =>
    fieldset({ ...config, description, legend: "Answers", children: [] }, h),
};

describe("Foldcn description contracts", () => {
  for (const [name, control] of Object.entries(controls)) {
    it.effect(`${name} connects only rendered descriptions`, () =>
      Effect.gen(function* () {
        for (const description of [undefined, "Answer from direct observation."]) {
          const all = yield* render((h) => control(description, h));
          const described = all.filter((node) => node.attrs?.["aria-describedby"] !== undefined);
          assert.lengthOf(described, description === undefined ? 0 : 1);
          if (description !== undefined) {
            const id = described[0]!.attrs!["aria-describedby"];
            const target = all.find((node) => node.attrs?.id === id);
            assert.strictEqual(target && Locator.textOf(target), description);
          }
        }
      }),
    );
  }

  for (const [name, component] of Object.entries({ Dialog, AlertDialog, Sheet })) {
    it.effect(`${name} describes itself only with an explicit description flag`, () =>
      Effect.gen(function* () {
        for (const hasDescription of [undefined, false, true]) {
          const all = yield* render((h) =>
            component.view(
              {
                id: "confirm",
                isOpen: true,
                hasDescription,
                content: (ids) => [
                  component.title({ attrs: { id: ids.titleId } }, ["Title"], h),
                  ...(hasDescription === true
                    ? [component.description({ attrs: { id: ids.descriptionId } }, ["Body"], h)]
                    : []),
                ],
              },
              h,
            ),
          );
          const dialog = all.find((node) => node.tag === "dialog")!;
          assert.strictEqual(dialog.attrs?.["aria-labelledby"], component.titleId("confirm"));
          assert.strictEqual(
            dialog.attrs?.["aria-describedby"],
            hasDescription === true ? component.descriptionId("confirm") : undefined,
          );
        }
      }),
    );

    it.effect(`${name} closes once when the browser forces a close`, () =>
      Effect.gen(function* () {
        for (const isOpen of [true, false]) {
          const Host = Html.component({
            name: "RegistryModalHost",
            model: Schema.Null,
            message: Schema.String,
            events: Schema.String,
          }).make({
            init: () => null,
            // Every message comes out as an event, so the scene reports it.
            update: ($, message) => $.emit(message),
            view: (h) =>
              h.div.children(
                component.view({ id: "confirm", isOpen, onClose: "close", content: () => [] }, h),
              ),
          });
          const s = yield* HtmlScene.make(Host, {});
          const sent = (event: string, payload: object) => {
            const before = s.current.emitted.length;
            s.fire(Locator.tag("dialog"), event, payload);
            const message = s.current.emitted[before];
            if (message === undefined) s.expectIgnored();
            else s.emitted(message);
            return message;
          };
          // Escape on an open modal asks to close; one the browser won't let be
          // cancelled closes it anyway and reports only through `close`.
          if (isOpen) assert.strictEqual(sent("cancel", { cancelable: true }), "close");
          assert.isUndefined(sent("cancel", { cancelable: false }));
          // A `close` after the Model closed the dialog is the Model's own.
          assert.strictEqual(sent("close", { returnValue: "" }), isOpen ? "close" : undefined);
        }
      }),
    );
  }
});

it.effect(
  "omits empty field errors and deduplicates messages without dropping distinct errors",
  () =>
    Effect.gen(function* () {
      const empty = yield* render((h) => {
        assert.isNull(fieldError({ errors: [undefined, {}] }, h));
        return null;
      });
      assert.isUndefined(empty.find((node) => node.attrs?.["data-slot"] === "field-error"));
      const all = yield* render((h) =>
        fieldError(
          { errors: [{ message: "Required" }, { message: "Required" }, { message: "Invalid" }] },
          h,
        )!,
      );
      assert.deepStrictEqual(
        all.filter((node) => node.tag === "li").map((node) => Locator.textOf(node)),
        ["Required", "Invalid"],
      );
    }),
);
