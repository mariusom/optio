import type { FieldKind } from "../livestore/schema";

// FieldKind metadata for the five field types.

export const FIELD_KINDS: ReadonlyArray<FieldKind> = [
  "radio",
  "checkbox",
  "textInput",
  "textArea",
  "boolean",
];

export const fieldDisplayName = (kind: FieldKind): string => {
  switch (kind) {
    case "radio":
      return "Single Choice";
    case "checkbox":
      return "Multiple Choice";
    case "textInput":
      return "Text Field";
    case "textArea":
      return "Text Area";
    case "boolean":
      return "Toggle";
  }
};

export const supportsRequired = (kind: FieldKind): boolean => kind !== "boolean";

export const hasOptions = (kind: FieldKind): boolean => kind === "radio" || kind === "checkbox";

export const parseJsonArray = (json: string): ReadonlyArray<string> => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

/**
 * CheckboxSelectionLogic — port of CheckboxSelectionTests-encoded semantics.
 * Value is a comma-joined string; output order ALWAYS follows the option
 * order of the group regardless of tap sequence.
 */
export const toggleCheckboxOption = (
  currentValue: string,
  option: string,
  options: ReadonlyArray<string>,
  exclusiveOptions: ReadonlyArray<string>,
): string => {
  const current = currentValue.split(",").filter((item) => item !== "");
  const isSelected = current.includes(option);
  const exclusives = new Set(exclusiveOptions);

  let next: string[];
  if (!isSelected && exclusives.has(option)) {
    // Selecting an exclusive clears everything else
    next = [option];
  } else if (!isSelected && current.some((item) => exclusives.has(item))) {
    // Selecting a normal option while an exclusive is held replaces it
    next = [option];
  } else if (isSelected) {
    next = current.filter((item) => item !== option);
  } else {
    next = [...current, option];
  }

  // Reorder to template option order, drop unknowns/duplicates
  const nextSet = new Set(next);
  return options.filter((candidate) => nextSet.has(candidate)).join(",");
};
