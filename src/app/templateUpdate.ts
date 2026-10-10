import {
  AddSampleTemplates,
  CreateTemplate,
  DeleteTemplate,
  DuplicateTemplate,
  SetDefaultTemplate,
} from "../web/features/templates/commands";
import { StartSession } from "../web/features/session/startCommands";
import { effectiveTemplateId } from "../web/features/session/startHelpers";
import { sessionRunnerRouter, templateEditorRouter } from "../web/routes";
import { GeneratePlaceholderName, NavigateInternal } from "./commands";
import type { Update } from "foldkit";
import { Message, type MessageHandlers } from "../messages";
import { AsyncData } from "foldkit";
import { activeSessionOf, takeId, templatesOf, type Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = MessageHandlers<Result>;

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
  | "ClickedStartTemplateSession"
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
    const needsPlaceholder = model.route._tag === "StartTab" && model.placeholderName === "";
    return {
      model: {
        ...model,
        templates: AsyncData.succeed(templates),
        selectedTemplateId: nextSelected,
      },
      commands: needsPlaceholder ? [GeneratePlaceholderName()] : [],
    };
  },
  ClickedNewTemplate: () => {
    const [id, next] = takeId(model);
    return {
      model: {
        ...next,
        showCreate: true,
        newName: "",
        lastError: null,
        editor: {
          id,
          name: "",
          isDefault: templatesOf(model).length === 0,
          fields: [],
          original: { name: "", isDefault: templatesOf(model).length === 0, fields: [] },
          isSaving: false,
          showAddField: false,
          editingFieldId: null,
          draft: null,
          pendingDiscard: false,
        },
      },
    };
  },
  ChangedNewName: ({ text }) => ({ model: { ...model, newName: text } }),
  ConfirmedCreateTemplate: () => {
    if (model.newName.trim() === "") return { model };
    const [id, next] = takeId(model);
    return { model: next, commands: [CreateTemplate({ id, name: model.newName.trim() })] };
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
    const template = templatesOf(model).find((candidate) => candidate.id === id);
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
  // The sheet's "Start session" names the session like the Session tab does.
  OpenedTemplateActions: ({ id }) => ({
    model: { ...model, templateActionsFor: id },
    commands: model.placeholderName === "" ? [GeneratePlaceholderName()] : [],
  }),
  ClosedTemplateActions: () => ({ model: { ...model, templateActionsFor: null } }),
  ClickedStartTemplateSession: ({ id }) => {
    const closed = { ...model, templateActionsFor: null };
    const template = templatesOf(model).find((candidate) => candidate.id === id);
    if (template === undefined) return { model: closed };
    // One live session at a time: like the Session tab, offer to resume it instead.
    const active = activeSessionOf(model);
    if (active !== null) {
      return {
        model: closed,
        commands: [NavigateInternal({ url: `#${sessionRunnerRouter({ sessionId: active.id })}` })],
      };
    }
    const [sessionId, next] = takeId(closed);
    return {
      model: { ...next, selectedTemplateId: id },
      commands: [
        StartSession({
          id: sessionId,
          templateId: id,
          templateName: template.name,
          sessionName: model.placeholderName,
          fields: [],
        }),
      ],
    };
  },
  ClickedAddSampleTemplates: () => ({
    model: { ...model, lastError: null },
    commands: [AddSampleTemplates()],
  }),
  SampleTemplatesAdded: () => ({ model }),
  TemplateOpDone: () => ({ model }),
  TemplatesSeededCheck: () => ({ model: { ...model, templatesSeedChecked: true } }),
  FailedTemplateOp: ({ error }) => {
    // A failed startup seed must not keep the templates subscription waiting.
    const base = { ...model, templatesSeedChecked: true, lastError: error };
    if (model.editor !== null && model.editor.isSaving) {
      return { model: { ...base, editor: { ...model.editor, isSaving: false } } };
    }
    return { model: { ...base, pendingDelete: null } };
  },
});
