import type { FieldKind } from "../livestore/schema";

// FieldKind metadata shared by templates and observations.

export const FIELD_KINDS: ReadonlyArray<FieldKind> = [
  "radio",
  "checkbox",
  "textInput",
  "textArea",
  "boolean",
  "number",
  "counter",
  "rating",
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
      return "Yes/No";
    case "number":
      return "Number";
    case "counter":
      return "Counter";
    case "rating":
      return "Rating";
  }
};

/** Empty is unanswered; requiredness is checked separately. */
export const isScalarAnswerValid = (kind: string, value: string): boolean => {
  if (value === "") return true;
  if (kind === "boolean") return value === "true" || value === "false";
  if (kind === "rating") return /^[1-5]$/.test(value);
  if (kind === "counter") return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
  if (kind === "number")
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value));
  return true;
};

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
  {
    options,
    exclusiveOptions,
  }: Readonly<{
    options: ReadonlyArray<string>;
    exclusiveOptions: ReadonlyArray<string>;
  }>,
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

export const isBooleanTrue = (value: string): boolean => value.trim().toLowerCase() === "true";

export const formatBooleanDisplay = (value: string): string =>
  value === "" ? "Unanswered" : isBooleanTrue(value) ? "Yes" : "No";
