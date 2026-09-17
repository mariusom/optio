import type { FieldDef, FieldKind } from "../../../livestore/schema";

export const ANSWER_TYPES: ReadonlyArray<FieldKind> = [
  "textInput",
  "textArea",
  "radio",
  "checkbox",
  "boolean",
];

export const answerTypeName = (kind: FieldKind): string => {
  switch (kind) {
    case "textInput":
      return "Text";
    case "textArea":
      return "Long text";
    case "radio":
      return "Single choice";
    case "checkbox":
      return "Multiple choice";
    case "boolean":
      return "Yes/No";
  }
};

export type EditorModel = {
  readonly showCreate?: boolean;
  readonly editor: {
    readonly id: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly fields: ReadonlyArray<FieldDef>;
    readonly original: {
      readonly name: string;
      readonly isDefault: boolean;
      readonly fields: ReadonlyArray<FieldDef>;
    };
    readonly isSaving: boolean;
    readonly showAddField: boolean;
    readonly editingFieldId: string | null;
    readonly draft: {
      readonly id: string;
      readonly name: string;
      readonly kind: string;
      readonly isRequired: boolean;
      readonly defaultValue: string;
      readonly sortOrder: number;
      readonly options: ReadonlyArray<string>;
      readonly exclusiveOptions: ReadonlyArray<string>;
      readonly newOptionText: string;
    } | null;
    readonly pendingDiscard: boolean;
  } | null;
  readonly lastError: string | null;
};

export type Editor = NonNullable<EditorModel["editor"]>;
