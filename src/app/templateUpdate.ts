import {
  AddSampleTemplates,
  CreateTemplate,
  DeleteTemplate,
  DuplicateTemplate,
  SetDefaultTemplate,
} from "../web/features/templates/commands";
import { effectiveTemplateId } from "../web/features/session/startHelpers";
import { generateSessionName } from "../web/random-name";
import { templateEditorRouter } from "../web/routes";
import { NavigateInternal } from "./commands";
import type { Update } from "foldkit";
import { Message } from "../messages";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = Parameters<typeof Message.match<Result>>[1];

type TemplateHandlers = Pick<
  AllHandlers,
  | "GotTemplates"
  | "ClickedNewTemplate"
  | "ChangedNewName"
  | "ConfirmedCreateTemplate"
  | "TemplateCreated"
  | "CanceledCreateTemplate"
  | "ClickedTemplateRow"
  | "DuplicatedTemplate"
  | "RequestedDeleteTemplate"
  | "CanceledDeleteTemplate"
  | "ConfirmedDeleteTemplate"
  | "ClickedSetDefaultTemplate"
  | "ClickedDuplicateTemplate"
  | "OpenedTemplateActions"
  | "ClosedTemplateActions"
  | "ClickedAddSampleTemplates"
  | "SampleTemplatesAdded"
  | "TemplateOpDone"
  | "TemplatesSeededCheck"
  | "FailedTemplateOp"
>;
export const templateHandlers = (model: Model): TemplateHandlers => ({
  GotTemplates: ({ templates }) => {
    let nextSelected = model.selectedTemplateId;
    if (templates.length === 0) {
      nextSelected = null;
    } else if (nextSelected === null || !templates.some((t) => t.id === nextSelected)) {
      const prioritized = effectiveTemplateId(templates, nextSelected);
      nextSelected = prioritized;
    }
    // Ensure placeholder exists when on Start tab
    let nextPlaceholder = model.placeholderName;
    if (model.route._tag === "StartTab" && (nextPlaceholder === "" || nextPlaceholder === null)) {
      nextPlaceholder = generateSessionName();
    }
    return {
      model: {
        ...model,
        templates,
        selectedTemplateId: nextSelected,
        placeholderName: nextPlaceholder,
      },
    };
  },
  ClickedNewTemplate: () => ({
    model: {
      ...model,
      showCreate: true,
      newName: "",
      lastError: null,
      editor: {
        id: crypto.randomUUID(),
        name: "",
        isDefault: model.templates.length === 0,
        fields: [],
        original: { name: "", isDefault: model.templates.length === 0, fields: [] },
        isSaving: false,
        showAddField: false,
        editingFieldId: null,
        draft: null,
        pendingDiscard: false,
      },
    },
  }),
  ChangedNewName: ({ text }) => ({ model: { ...model, newName: text } }),
  ConfirmedCreateTemplate: () =>
    model.newName.trim() === ""
      ? { model }
      : {
          model,
          commands: [CreateTemplate({ id: crypto.randomUUID(), name: model.newName.trim() })],
        },
  TemplateCreated: () => ({ model: { ...model, showCreate: false, newName: "", editor: null } }),
  CanceledCreateTemplate: () => ({
    model: { ...model, showCreate: false, newName: "", editor: null },
  }),
  ClickedTemplateRow: ({ id }) => ({
    model,
    commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
  }),
  DuplicatedTemplate: ({ id }) => ({
    model,
    commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
  }),
  RequestedDeleteTemplate: ({ id }) => {
    const template = model.templates.find((candidate) => candidate.id === id);
    return {
      model: {
        ...model,
        templateActionsFor: null,
        pendingDelete: template ? { id, name: template.name } : null,
      },
    };
  },
  CanceledDeleteTemplate: () => ({ model: { ...model, pendingDelete: null } }),
  ConfirmedDeleteTemplate: () =>
    model.pendingDelete === null
      ? { model }
      : {
          model: { ...model, pendingDelete: null },
          commands: [DeleteTemplate({ id: model.pendingDelete.id })],
        },
  ClickedSetDefaultTemplate: ({ id }) => ({
    model: { ...model, templateActionsFor: null },
    commands: [SetDefaultTemplate({ id })],
  }),
  ClickedDuplicateTemplate: ({ id }) => ({
    model: { ...model, templateActionsFor: null },
    commands: [DuplicateTemplate({ id })],
  }),
  OpenedTemplateActions: ({ id }) => ({ model: { ...model, templateActionsFor: id } }),
  ClosedTemplateActions: () => ({ model: { ...model, templateActionsFor: null } }),
  ClickedAddSampleTemplates: () => ({
    model: { ...model, lastError: null },
    commands: [AddSampleTemplates({})],
  }),
  SampleTemplatesAdded: () => ({ model }),
  TemplateOpDone: () => ({ model }),
  TemplatesSeededCheck: () => ({ model }),
  FailedTemplateOp: ({ error }) => {
    if (model.editor !== null && model.editor.isSaving) {
      return {
        model: { ...model, editor: { ...model.editor, isSaving: false }, lastError: error },
      };
    }
    return { model: { ...model, lastError: error, pendingDelete: null } };
  },
});
