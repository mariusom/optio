import type { AppServices } from "./services";
import { Array, Option, Order, String } from "effect";
import type { FieldDef, FieldKind } from "../domain/fields";
import { SaveTemplate } from "../web/features/templates/editorCommands";
import {
  addOptionToDraft,
  deleteField,
  deleteOptionFromDraft,
  draftFromField,
  draftToFieldDef,
  fieldDiffers,
  hasChanges,
  isDraftValid,
  isTemplateValid,
  makeEmptyDraft,
  moveField,
  moveOptionInDraft,
  renumberFields,
  toggleExclusiveOption,
  withKindChanged,
} from "../web/features/templates/editor";
import { templatesRouter } from "../web/routes";
import { NavigateInternal } from "./commands";
import type { Update } from "foldkit";
import { Message, type MessageHandlers } from "../messages";
import { ClearNewChoice } from "../web/features/templates/choiceInput";
import { takeId, type Model } from "./model";

const bySortOrder = Order.mapInput(
  Order.Number,
  (field: { readonly sortOrder: number }) => field.sortOrder,
);

type Result = Update.Return<Model, Message, AppServices>;
type AllHandlers = MessageHandlers<Result>;

type EditorLoadHandlers = Pick<
  AllHandlers,
  | "GotTemplateDetail"
  | "ChangedEditorName"
  | "ToggledEditorDefault"
  | "ClickedAddField"
  | "CanceledAddField"
  | "ClickedBackFromField"
  | "ClickedEditField"
>;
export const editorLoadHandlers = (model: Model): EditorLoadHandlers => ({
  GotTemplateDetail: ({ template }) => {
    if (template === null) {
      return {
        model: { ...model, editor: null, lastError: "Template not found." },
        commands: [NavigateInternal({ url: `#${templatesRouter()}` })],
      };
    }
    if (model.editor !== null && model.editor.id === template.id) {
      const sorted = Array.sort(template.fields, bySortOrder);
      const dense = renumberFields(sorted as ReadonlyArray<FieldDef>);
      const nextEditor = {
        ...model.editor,
        name: template.name,
        isDefault: template.isDefault,
        fields: dense,
        original: {
          name: template.name,
          isDefault: template.isDefault,
          fields: dense,
        },
      };
      return { model: { ...model, editor: nextEditor } };
    }
    const sorted = Array.sort(template.fields, bySortOrder);
    const dense = renumberFields(sorted as ReadonlyArray<FieldDef>);
    return {
      model: {
        ...model,
        editor: {
          id: template.id,
          name: template.name,
          isDefault: template.isDefault,
          fields: dense,
          original: {
            name: template.name,
            isDefault: template.isDefault,
            fields: dense,
          },
          isSaving: false,
          showAddField: false,
          editingFieldId: null,
          draft: null,
          pendingDiscard: false,
        },
        lastError: null,
      },
    };
  },
  ChangedEditorName: ({ text }) => {
    if (model.editor === null) return { model };
    return { model: { ...model, editor: { ...model.editor, name: text } } };
  },
  ToggledEditorDefault: () => {
    if (model.editor === null) return { model };
    return {
      model: { ...model, editor: { ...model.editor, isDefault: !model.editor.isDefault } },
    };
  },
  ClickedAddField: () => {
    if (model.editor === null || model.editor.draft !== null || model.editor.isSaving)
      return { model };
    const [id, next] = takeId(model);
    const draft = makeEmptyDraft(id, model.editor.fields.length);
    return {
      model: {
        ...next,
        editor: { ...model.editor, showAddField: true, editingFieldId: null, draft },
      },
    };
  },
  CanceledAddField: () => {
    if (model.editor === null) return { model };
    return {
      model: {
        ...model,
        editor: {
          ...model.editor,
          showAddField: false,
          editingFieldId: null,
          draft: null,
          pendingDiscard: false,
        },
      },
    };
  },
  ClickedBackFromField: () => {
    if (model.editor === null) return { model };
    const draft = model.editor.draft;
    const editedField = Array.findFirst(
      model.editor.fields,
      (field) => field.id === model.editor?.editingFieldId,
    );
    const isDraftDirty =
      draft !== null &&
      (model.editor.editingFieldId === null
        ? String.trim(draft.name) !== "" ||
          draft.kind !== "textInput" ||
          draft.isRequired ||
          draft.defaultValue !== "" ||
          draft.options.length > 0 ||
          draft.newOptionText !== ""
        : draft.newOptionText !== "" ||
          Option.isNone(editedField) ||
          fieldDiffers(draftToFieldDef(draft), draftToFieldDef(draftFromField(editedField.value))));
    if (isDraftDirty) {
      return { model: { ...model, editor: { ...model.editor, pendingDiscard: true } } };
    }
    return {
      model: {
        ...model,
        editor: { ...model.editor, showAddField: false, editingFieldId: null, draft: null },
      },
    };
  },
  ClickedEditField: ({ id }) => {
    if (model.editor === null || model.editor.draft !== null || model.editor.isSaving)
      return { model };
    const field = Array.findFirst(model.editor.fields, (entry) => entry.id === id);
    if (Option.isNone(field)) return { model };
    return {
      model: {
        ...model,
        editor: {
          ...model.editor,
          editingFieldId: id,
          showAddField: false,
          draft: draftFromField(field.value),
        },
      },
    };
  },
});

type EditorFieldHandlers = Pick<
  AllHandlers,
  | "ChangedFieldName"
  | "ChangedFieldKind"
  | "ToggledFieldRequired"
  | "ChangedFieldDefaultValue"
  | "ToggledFieldDefaultBoolean"
  | "ChangedNewOptionText"
  | "ConfirmedAddOption"
  | "ClearedNewChoice"
  | "ClickedMoveOption"
  | "ClickedDeleteOption"
  | "ToggledExclusiveOption"
  | "ClickedDeleteField"
  | "ClickedMoveFieldUp"
  | "ClickedMoveFieldDown"
  | "ConfirmedSaveField"
>;

const saveField = (model: Model): Result => {
  if (model.editor === null || model.editor.draft === null) return { model };
  if (!isDraftValid(model.editor.draft)) return { model };
  const fieldDef = draftToFieldDef(model.editor.draft);
  const nextFields: ReadonlyArray<FieldDef> =
    model.editor.editingFieldId === null
      ? [...model.editor.fields, { ...fieldDef, sortOrder: model.editor.fields.length }]
      : Array.map(model.editor.fields, (entry) =>
          entry.id === model.editor?.editingFieldId
            ? { ...fieldDef, sortOrder: entry.sortOrder }
            : entry,
        );
  return {
    model: {
      ...model,
      editor: {
        ...model.editor,
        fields: renumberFields(nextFields),
        showAddField: false,
        editingFieldId: null,
        draft: null,
      },
    },
  };
};

export const editorFieldHandlers = (model: Model): EditorFieldHandlers => ({
  ChangedFieldName: ({ text }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: { ...model.editor.draft, name: text } },
      },
    };
  },
  ChangedFieldKind: ({ kind }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    const draft = withKindChanged(model.editor.draft, kind as FieldKind);
    return { model: { ...model, editor: { ...model.editor, draft } } };
  },
  ToggledFieldRequired: () => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: {
          ...model.editor,
          draft: { ...model.editor.draft, isRequired: !model.editor.draft.isRequired },
        },
      },
    };
  },
  ChangedFieldDefaultValue: ({ text }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: { ...model.editor.draft, defaultValue: text } },
      },
    };
  },
  ToggledFieldDefaultBoolean: () => {
    if (model.editor === null || model.editor.draft === null) return { model };
    const current = model.editor.draft.defaultValue;
    const next = current === "true" ? "false" : "true";
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: { ...model.editor.draft, defaultValue: next } },
      },
    };
  },
  ChangedNewOptionText: ({ text }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: { ...model.editor.draft, newOptionText: text } },
      },
    };
  },
  ConfirmedAddOption: () => {
    if (model.editor === null || model.editor.draft === null) return { model };
    const nextDraft = addOptionToDraft(model.editor.draft);
    if (nextDraft === model.editor.draft) return { model };
    return {
      model: { ...model, editor: { ...model.editor, draft: nextDraft } },
      commands: [ClearNewChoice({ added: String.trim(model.editor.draft.newOptionText) })],
    };
  },
  ClearedNewChoice: () => ({ model }),
  ClickedMoveOption: ({ index, direction }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: {
          ...model.editor,
          draft: moveOptionInDraft(model.editor.draft, index, direction),
        },
      },
    };
  },
  ClickedDeleteOption: ({ index }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: deleteOptionFromDraft(model.editor.draft, index) },
      },
    };
  },
  ToggledExclusiveOption: ({ index }) => {
    if (model.editor === null || model.editor.draft === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, draft: toggleExclusiveOption(model.editor.draft, index) },
      },
    };
  },
  ClickedDeleteField: ({ id }) => {
    if (model.editor === null) return { model };
    const nextFields = deleteField(model.editor.fields, id);
    const isEditingDeleted = model.editor.editingFieldId === id;
    return {
      model: {
        ...model,
        editor: {
          ...model.editor,
          fields: nextFields,
          ...(isEditingDeleted ? { editingFieldId: null, showAddField: false, draft: null } : {}),
        },
      },
    };
  },
  ClickedMoveFieldUp: ({ id }) => {
    if (model.editor === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, fields: moveField(model.editor.fields, id, -1) },
      },
    };
  },
  ClickedMoveFieldDown: ({ id }) => {
    if (model.editor === null) return { model };
    return {
      model: {
        ...model,
        editor: { ...model.editor, fields: moveField(model.editor.fields, id, 1) },
      },
    };
  },
  ConfirmedSaveField: () => saveField(model),
});

type EditorSaveHandlers = Pick<
  AllHandlers,
  | "ClickedSaveTemplate"
  | "ClickedCancelEditTemplate"
  | "TemplateSaved"
  | "ShowDiscardConfirm"
  | "CanceledDiscard"
  | "ConfirmedDiscard"
>;
export const editorSaveHandlers = (model: Model): EditorSaveHandlers => ({
  ClickedSaveTemplate: () => {
    if (model.editor === null || model.editor.isSaving || model.editor.draft !== null)
      return { model };
    if (!isTemplateValid(model.editor)) return { model };
    if (!hasChanges(model.editor)) return { model };
    const { id, name, isDefault, fields } = model.editor;
    return {
      model: { ...model, editor: { ...model.editor, isSaving: true } },
      commands: [
        SaveTemplate({
          id,
          name,
          isDefault,
          isNew: model.showCreate,
          fields: [...fields],
        }),
      ],
    };
  },
  ClickedCancelEditTemplate: () => {
    if (model.editor === null) return { model };
    if (!hasChanges(model.editor) && model.editor.draft === null) {
      if (model.showCreate) return { model: { ...model, showCreate: false, editor: null } };
      return { model, commands: [NavigateInternal({ url: `#${templatesRouter()}` })] };
    }
    return {
      model: {
        ...model,
        pendingNavigationUrl: `#${templatesRouter()}`,
        editor: { ...model.editor, pendingDiscard: true },
      },
    };
  },
  TemplateSaved: () => {
    if (model.editor === null)
      return { model, commands: [NavigateInternal({ url: `#${templatesRouter()}` })] };
    return {
      model: { ...model, showCreate: false, editor: null },
      commands: [NavigateInternal({ url: `#${templatesRouter()}` })],
    };
  },
  ShowDiscardConfirm: () => {
    if (model.editor === null) return { model };
    return { model: { ...model, editor: { ...model.editor, pendingDiscard: true } } };
  },
  CanceledDiscard: () => {
    if (model.editor === null) return { model };
    return {
      model: {
        ...model,
        pendingNavigationUrl: null,
        editor: { ...model.editor, pendingDiscard: false },
      },
    };
  },
  ConfirmedDiscard: () => {
    if (model.editor === null) return { model };
    const isFieldDiscard =
      model.pendingNavigationUrl === null &&
      model.editor.draft !== null &&
      (model.editor.showAddField || model.editor.editingFieldId !== null);
    if (isFieldDiscard) {
      return {
        model: {
          ...model,
          editor: {
            ...model.editor,
            pendingDiscard: false,
            showAddField: false,
            editingFieldId: null,
            draft: null,
          },
        },
      };
    }
    return {
      model: {
        ...model,
        pendingNavigationUrl: null,
        showCreate: false,
        editor: null,
      },
      commands: [NavigateInternal({ url: model.pendingNavigationUrl ?? `#${templatesRouter()}` })],
    };
  },
});
