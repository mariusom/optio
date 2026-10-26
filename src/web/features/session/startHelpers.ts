import { Array, Option, pipe } from "effect";

import type { TemplateSummary } from "../../types";

// Pure derivations for Start tab — tested in isolation.

export type ActiveSession = {
  readonly id: string;
  readonly templateId: string | null;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number;
  readonly completedCount: number;
};

export const resolveSelectedTemplate = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
): TemplateSummary | null => {
  if (selectedTemplateId === null) return null;
  return Option.getOrNull(Array.findFirst(templates, (t) => t.id === selectedTemplateId));
};

/** Spec: template lookup by id then name fallback (resume path). */
export const resolveTemplateByIdOrName = (
  templates: ReadonlyArray<TemplateSummary>,
  templateId: string | null,
  templateName: string,
): TemplateSummary | null => {
  if (templateId !== null) {
    const byId = Array.findFirst(templates, (t) => t.id === templateId);
    if (Option.isSome(byId)) return byId.value;
  }
  if (templateName !== "") {
    const byName = Array.findFirst(templates, (t) => t.name === templateName);
    if (Option.isSome(byName)) return byName.value;
  }
  return null;
};

export const effectiveTemplateId = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
): string | null => {
  if (templates.length === 0) return null;
  const selected = resolveSelectedTemplate(templates, selectedTemplateId);
  if (selected !== null) return selected.id;
  const defaultTemplate = pipe(
    Array.findFirst(templates, (t) => t.isDefault),
    Option.orElse(() => Array.head(templates)),
  );
  return Option.match(defaultTemplate, { onNone: () => null, onSome: (template) => template.id });
};

export const canStart = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
): boolean => {
  if (templates.length === 0) return false;
  return resolveSelectedTemplate(templates, selectedTemplateId) !== null;
};

export const displaySessionName = (sessionName: string, templateName: string): string =>
  sessionName !== "" ? sessionName : templateName;

/** Returns true when template missing (id exists but not in templates). */
export const isTemplateMissing = (
  templates: ReadonlyArray<TemplateSummary>,
  activeSession: ActiveSession | null,
): boolean => {
  if (activeSession === null) return false;
  return (
    resolveTemplateByIdOrName(templates, activeSession.templateId, activeSession.templateName) ===
    null
  );
};
