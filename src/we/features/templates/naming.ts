// Duplicate naming: "{name} copy", "{name} copy 2", … skipping taken names
// (Swift TemplatesTab.duplicateTemplate).

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

/** Summary line under a template row (spec §3.9). */
export const fieldSummaryLine = (fieldCount: number, requiredCount: number): string => {
  if (fieldCount === 0) return "No fields";
  const fields = `${fieldCount} field${fieldCount === 1 ? "" : "(s)"}`;
  return requiredCount > 0 ? `${fields}, ${requiredCount} required` : fields;
};
