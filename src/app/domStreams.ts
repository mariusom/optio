import { Effect, Stream } from "effect";
import { Render } from "foldkit";

/** Runs a DOM effect once the render that caused it has committed. */
const afterCommit = (action: () => void): Stream.Stream<never> =>
  Stream.fromEffect(Effect.andThen(Render.afterCommit, Effect.sync(action))).pipe(Stream.drain);

/** Responsive copies share content under different IDs; target the rendered one. */
const visibleElement = (ids: ReadonlyArray<string>) =>
  ids
    .map((id) => document.getElementById(id))
    .find((element) => element !== null && element.getClientRects().length > 0);

/** Scripted smooth scrolling is not covered by the CSS reduced-motion rule. */
const scrollBehavior = (): ScrollBehavior =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

export const focusEditorDraft = (draftId: string | null): Stream.Stream<never> => {
  if (draftId === null) return Stream.empty;
  return afterCommit(() => {
    document.getElementById("question-name")?.focus({ preventScroll: true });
    document.getElementById("question-editor")?.scrollIntoView({ block: "start" });
  });
};

export const scrollToSection = (sectionId: string | null): Stream.Stream<never> => {
  if (sectionId === null) return Stream.empty;
  return afterCommit(() => {
    visibleElement([`mobile-${sectionId}`, `tablet-${sectionId}`])?.scrollIntoView({
      behavior: scrollBehavior(),
      block: "center",
    });
  });
};

export const scrollToCurrentTask = (taskId: string | null): Stream.Stream<never> => {
  if (taskId === null) return Stream.empty;
  return afterCommit(() => {
    visibleElement(["mobile-formTop", "tablet-formTop"])?.scrollIntoView({
      behavior: scrollBehavior(),
      block: "start",
    });
  });
};

/**
 * Moves screen-reader and keyboard focus to a help page's title once the page
 * has painted. The heading becomes focusable without joining the tab order.
 */
export const focusHelpPage = (page: "AgentHelp" | "About" | null): Stream.Stream<never> => {
  if (page === null) return Stream.empty;
  return Stream.fromEffect(
    Effect.andThen(
      Render.afterPaint,
      Effect.sync(() => {
        const content = document.querySelector(`[data-help-page="${page}"]`);
        const main = content?.closest("main");
        const heading = content?.querySelector("h1");
        if (main && heading) {
          main.scrollTop = 0;
          if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }),
    ),
  ).pipe(Stream.drain);
};
