// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { afterEach, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { BrowserHost, Html } from "@effect/ui/html";
import { Effect, Exit, Option, Schema, Scope } from "effect";
import type { H, Ui } from "@/lib/view";
import { radioGroup } from "./radio-group";
import { notice } from "../app/feedback";
import { input } from "./input";
import { checkbox } from "./checkbox";
import { fieldset, label, fieldLabel } from "./fieldset";
import { spinner } from "./spinner";
import { foldcnStyles, setCurrentStyle } from "@/web/style";
import "../../index.css";

/** Messages are the selected radio value, or "noop" for inert actions. */
type Model = Readonly<{ selected: string }>;
let scope: Scope.Closeable | undefined;
let container: HTMLDivElement | undefined;

const mount = async (view: (model: Model, h: H<string>) => Ui) => {
  container = document.createElement("div");
  container.className = "p-4";
  document.body.append(container);
  const target = document.createElement("div");
  container.append(target);
  const Registry = Html.component({
    name: "Registry",
    model: Schema.Struct({ selected: Schema.String }),
    message: Schema.String,
  }).make({
    init: () => ({ selected: "Observe" }),
    update: ($, message) => (message === "noop" ? $.model : { selected: message }),
    view: (h, model) => h.div.children(view(model, h)),
  });
  const opened = Scope.makeUnsafe();
  scope = opened;
  await Effect.runPromise(
    BrowserHost.mountEffect(Registry, {}, target).pipe(Scope.provide(opened)),
  );
};

afterEach(async () => {
  if (scope !== undefined) await Effect.runPromise(Scope.close(scope, Exit.void));
  scope = undefined;
  container?.remove();
  document.documentElement.classList.remove("dark");
  await setCurrentStyle("nova");
});

it.each(foldcnStyles)("%s fieldset labels reflect native disabled state", async (style) => {
  await page.viewport(390, 844);
  await setCurrentStyle(style);
  await mount((_, h) =>
    h.div.class("space-y-6").children(
      [false, true].map((isDisabled) =>
        fieldset(
          {
            id: `fields-${isDisabled}`,
            legend: isDisabled ? "Disabled fields" : "Enabled fields",
            isDisabled,
            children: [
              label({}, ["Observer", h.input.attr("type", "text")], h),
              fieldLabel({}, ["Notes", h.input.attr("type", "text")], h),
            ],
          },
          h,
        ),
      ),
    ),
  );
  for (const isDisabled of [false, true]) {
    const fields = page.getByRole("group", {
      name: isDisabled ? "Disabled fields" : "Enabled fields",
    });
    await expect.element(fields).toBeVisible();
    for (const name of ["Observer", "Notes"]) {
      const control = fields.getByRole("textbox", { name });
      if (isDisabled) await expect.element(control).toBeDisabled();
      else await expect.element(control).toBeEnabled();
      const styles = getComputedStyle(control.element().closest("label")!);
      expect(styles.opacity).toBe(isDisabled ? "0.5" : "1");
      expect(styles.pointerEvents).toBe(isDisabled ? "none" : "auto");
      if (isDisabled) expect(styles.cursor).toBe("not-allowed");
      else expect(styles.cursor).not.toBe("not-allowed");
    }
  }
});

it.each(["default", "field", "choice-card"] as const)(
  "%s radios preserve descriptions, invalid/disabled states and keyboard selection",
  async (optionLayout) => {
    await page.viewport(390, 844);
    await mount((model, h) =>
      radioGroup(
        {
          id: "choices",
          options: ["Unavailable", "Observe", "Assist"],
          selectedValue: Option.some(model.selected),
          onSelect: (value) => value,
          ariaLabel: "Activity",
          name: "activity",
          optionLayout,
          isInvalid: true,
          isOptionDisabled: (value) => value === "Unavailable",
          optionDescription: (value) => `${value} description`,
        },
        h,
      ),
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
    expect(
      container!.querySelector<HTMLInputElement>('input[name="activity"]:checked')!.value,
    ).toBe("Assist");
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
  await mount((_, h) =>
    h.div.class("mx-auto max-w-xl space-y-6 bg-background p-4 text-foreground").children([
      notice({ tone: "info", text: "Observations stay on this device." }, h),
      notice(
        {
          tone: "error",
          text: "Could not save this observation. Check available storage and try again.",
          onDismiss: "noop",
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
                onToggle: () => "noop",
              },
              h,
            ),
          ],
        },
        h,
      ),
      h.p
        .attr("role", "status")
        .class("flex items-center gap-2")
        .children(spinner({}, h), "Loading session…"),
    ]),
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
