// Duplicate naming: "{name} copy", "{name} copy 2", … skipping taken names
// Matching the duplicate-template naming behavior.

export const nextDuplicateName = (
  originalName: string,
  takenNames: ReadonlyArray<string>,
): string => {
  const taken = new Set(takenNames);
  if (!taken.has(`${originalName} copy`)) return `${originalName} copy`;
  let counter = 2;
  while (taken.has(`${originalName} copy ${counter}`)) counter += 1;
  return `${originalName} copy ${counter}`;
};

/** Summary line under a template row: "5 questions · 3 required". */
export const questionSummaryLine = (fieldCount: number, requiredCount: number): string => {
  if (fieldCount === 0) return "No questions yet";
  const questions = `${fieldCount} question${fieldCount === 1 ? "" : "s"}`;
  return requiredCount > 0 ? `${questions} · ${requiredCount} required` : questions;
};
