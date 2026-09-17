import { Effect, Stream } from "effect";

const afterRender = (action: () => void): Stream.Stream<never> =>
  Stream.fromEffect(
    Effect.sync(() => {
      setTimeout(action, 0);
    }),
  ).pipe(Stream.drain);

const visibleElement = (ids: ReadonlyArray<string>) => {
  if (typeof document === "undefined") return undefined;
  return ids
    .map((id) => document.getElementById(id))
    .find((element) => element !== null && element.getClientRects().length > 0);
};

export const focusEditorDraft = (draftId: string | null): Stream.Stream<never> => {
  if (draftId === null) return Stream.empty;
  return afterRender(() => {
    if (typeof document === "undefined") return;
    document.getElementById("question-name")?.focus({ preventScroll: true });
    document.getElementById("question-editor")?.scrollIntoView({ block: "start" });
  });
};

export const scrollToSection = (sectionId: string | null): Stream.Stream<never> => {
  if (sectionId === null) return Stream.empty;
  return afterRender(() => {
    visibleElement([`mobile-${sectionId}`, `tablet-${sectionId}`])?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
};

export const scrollToCurrentTask = (taskId: string | null): Stream.Stream<never> => {
  if (taskId === null) return Stream.empty;
  return afterRender(() => {
    visibleElement(["mobile-formTop", "tablet-formTop"])?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
};

export const focusHelpPage = (page: "AgentHelp" | "About" | null): Stream.Stream<never> => {
  if (page === null) return Stream.empty;
  return Stream.fromEffect(
    Effect.callback<void>((resume) => {
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const content = document.querySelector(`[data-help-page="${page}"]`);
          const main = content?.closest("main");
          const heading = content?.querySelector("h1");
          if (main && heading) {
            main.scrollTop = 0;
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
          resume(Effect.void);
        });
      });
      return Effect.sync(() => cancelAnimationFrame(frame));
    }),
  ).pipe(Stream.drain);
};
