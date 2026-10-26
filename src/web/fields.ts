import { Array, String, pipe } from "effect";
import type { FieldKind } from "../domain/fields";

// FieldKind metadata shared by templates and observations.

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
  const current = Array.filter(String.split(currentValue, ","), (item) => item !== "");
  const isSelected = current.includes(option);
  const exclusives = new Set(exclusiveOptions);

  let next: string[];
  if (!isSelected && exclusives.has(option)) {
    // Selecting an exclusive clears everything else
    next = [option];
  } else if (!isSelected && Array.some(current, (item) => exclusives.has(item))) {
    // Selecting a normal option while an exclusive is held replaces it
    next = [option];
  } else if (isSelected) {
    next = Array.filter(current, (item) => item !== option);
  } else {
    next = [...current, option];
  }

  // Reorder to template option order, drop unknowns/duplicates
  const nextSet = new Set(next);
  return pipe(
    options,
    Array.filter((candidate) => nextSet.has(candidate)),
    Array.join(","),
  );
};

export const isBooleanTrue = (value: string): boolean =>
  String.toLowerCase(String.trim(value)) === "true";

export const formatBooleanDisplay = (value: string): string =>
  value === "" ? "Unanswered" : isBooleanTrue(value) ? "Yes" : "No";
