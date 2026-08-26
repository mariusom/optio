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
  const byId = templates.find((t) => t.id === selectedTemplateId);
  return byId ?? null;
};

/** Spec: template lookup by id then name fallback (resume path). */
export const resolveTemplateByIdOrName = (
  templates: ReadonlyArray<TemplateSummary>,
  templateId: string | null,
  templateName: string,
): TemplateSummary | null => {
  if (templateId !== null) {
    const byId = templates.find((t) => t.id === templateId);
    if (byId !== undefined) return byId;
  }
  if (templateName !== "") {
    const byName = templates.find((t) => t.name === templateName);
    if (byName !== undefined) return byName;
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
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0] ?? null;
  return defaultTemplate?.id ?? null;
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
