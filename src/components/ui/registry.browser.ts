import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Option, Schema } from "effect";
import { Runtime } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as RadioGroup from "./radio-group";
import { notice } from "../app/feedback";
import { input } from "./input";
import { checkbox } from "./checkbox";
import { fieldset } from "./fieldset";
import { spinner } from "./spinner";
import { setCurrentStyle } from "@/web/style";
import "../../index.css";

const Model = Schema.Struct({ radio: RadioGroup.Model, selected: Schema.String });
type Model = typeof Model.Type;
const group = RadioGroup.create();
let handle: ReturnType<typeof Runtime.embed> | undefined;
let container: HTMLDivElement | undefined;
const update = (model: Model, message: RadioGroup.Message) => {
  const next = group.update(model.radio, message);
  return {
    model: { radio: next.model, selected: next.outMessage?.value ?? model.selected },
    commands: next.commands,
  };
};
const mount = (view: (model: Model, h: HtmlBuilder<RadioGroup.Message>) => Html) => {
  container = document.createElement("div");
  container.id = `registry-${crypto.randomUUID()}`;
  container.className = "p-4";
  document.body.append(container);
  const target = document.createElement("div");
  target.id = `${container.id}-root`;
  container.append(target);
  handle = Runtime.embed(
    Runtime.makeElement({
      Model,
      container: target,
      init: () => ({ model: { radio: RadioGroup.init({ id: "choices" }), selected: "Observe" } }),
      update,
      view,
    }),
  );
};

afterEach(async () => {
  handle?.dispose();
  container?.remove();
  document.documentElement.classList.remove("dark");
  await setCurrentStyle("nova");
});

it.each(["default", "field", "choice-card"] as const)(
  "%s radios preserve descriptions, invalid/disabled states and keyboard selection",
  async (optionLayout) => {
    await page.viewport(390, 844);
    mount((model, h) =>
      h.submodel({
        slotId: "choices",
        model: model.radio,
        view: group.view,
        toParentMessage: (message) => message,
        viewInputs: RadioGroup.styledViewInputs(
          {
            options: ["Unavailable", "Observe", "Assist"],
            selectedValue: Option.some(model.selected),
            ariaLabel: "Activity",
            name: "activity",
            optionLayout,
            isInvalid: true,
            isOptionDisabled: (value) => value === "Unavailable",
            optionDescription: (value) => `${value} description`,
          },
          h,
        ),
      }),
    );
    const disabled = page.getByRole("radio", { name: "Unavailable", exact: true });
    const observe = page.getByRole("radio", { name: "Observe", exact: true });
    const assist = page.getByRole("radio", { name: "Assist", exact: true });
    await expect.element(disabled).toBeDisabled();
    await expect.element(disabled).toHaveAttribute("tabindex", "-1");
    await expect.element(observe).toHaveAccessibleDescription("Observe description");
    await expect.element(observe).toHaveAttribute("aria-invalid", "true");
    await expect.element(observe).toBeChecked();
    (observe.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(assist).toBeChecked();
    await expect.element(assist).toHaveFocus();
    expect(container!.querySelector<HTMLInputElement>('input[name="activity"]')!.value).toBe(
      "Assist",
    );
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(observe).toHaveFocus();
    expect(container!.scrollWidth).toBeLessThanOrEqual(390);
  },
);

it.each([
  [390, "nova", false],
  [820, "lyra", true],
  [1440, "maia", false],
] as const)("renders notices and described controls at %ipx in %s", async (width, style, dark) => {
  await page.viewport(width, 900);
  await setCurrentStyle(style);
  document.documentElement.classList.toggle("dark", dark);
  mount((_, h) =>
    h.div(
      [h.Class("mx-auto max-w-xl space-y-6 bg-background p-4 text-foreground")],
      [
        notice({ tone: "info", text: "Observations stay on this device." }, h),
        notice(
          {
            tone: "error",
            text: "Could not save this observation. Check available storage and try again.",
            onDismiss: RadioGroup.Message.CompletedFocusOption(),
          },
          h,
        ),
        input(
          { id: "observer", label: "Observer", description: "Use an anonymous observer code." },
          h,
        ),
        fieldset(
          {
            id: "options",
            legend: "Options",
            description: "Choose how to record.",
            children: [
              checkbox(
                {
                  id: "required",
                  label: "Required",
                  description: "Answer before recording.",
                  isChecked: true,
                  onToggle: () => RadioGroup.Message.CompletedFocusOption(),
                },
                h,
              ),
            ],
          },
          h,
        ),
        h.p(
          [h.Role("status"), h.Class("flex items-center gap-2")],
          [spinner({}, h), "Loading session…"],
        ),
      ],
    ),
  );
  await expect
    .element(page.getByRole("textbox", { name: "Observer" }))
    .toHaveAccessibleDescription("Use an anonymous observer code.");
  await expect
    .element(page.getByRole("checkbox", { name: "Required" }))
    .toHaveAccessibleDescription("Answer before recording.");
  const error = page.getByRole("alert").element();
  const text = error.querySelector('[data-slot="alert-description"]')!.getBoundingClientRect();
  const dismiss = page.getByRole("button", { name: "Dismiss" });
  await expect.element(dismiss).toBeVisible();
  const bounds = dismiss.element().getBoundingClientRect();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(text.right).toBeLessThanOrEqual(bounds.left);
  (dismiss.element() as HTMLElement).focus();
  await expect.element(dismiss).toHaveFocus();
  expect(container!.querySelector('[data-slot="spinner"]')!.getAttribute("aria-hidden")).toBe(
    "true",
  );
  expect(container!.scrollWidth).toBeLessThanOrEqual(width);
});
