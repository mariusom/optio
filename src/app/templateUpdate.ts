import { Array, Option, String } from "effect";
import {
  AddSampleTemplates,
  CreateTemplate,
  DeleteTemplate,
  DuplicateTemplate,
  SetDefaultTemplate,
} from "../web/features/templates/commands";
import { StartSession } from "../web/features/session/startCommands";
import { effectiveTemplateId } from "../web/features/session/startHelpers";
import { hrefFor, SessionRunner, TemplateEditor } from "../web/routes";
import { GeneratePlaceholderName, NavigateInternal } from "./commands";
import type { MessageHandlers, UpdateResult } from "../messages";
import * as AsyncData from "@/lib/asyncData";
import { activeSessionOf, takeId, templatesOf, type Model } from "./model";

type Result = UpdateResult<Model>;
type AllHandlers = MessageHandlers<Result>;

type TemplateHandlers = Pick<
  AllHandlers,
  | "GotTemplates"
  | "ClickedNewTemplate"
  | "ChangedNewName"
  | "ConfirmedCreateTemplate"
  | "SucceededCreateTemplate"
  | "CanceledCreateTemplate"
  | "ClickedTemplateRow"
  | "SucceededDuplicateTemplate"
  | "RequestedDeleteTemplate"
  | "CanceledDeleteTemplate"
  | "ConfirmedDeleteTemplate"
  | "ClickedSetDefaultTemplate"
  | "ClickedDuplicateTemplate"
  | "OpenedTemplateActions"
  | "ClosedTemplateActions"
  | "ClickedStartTemplateSession"
  | "OpenedTemplateReport"
  | "ClosedTemplateReport"
  | "GotTemplateReport"
  | "FailedTemplateReport"
  | "ClickedAddSampleTemplates"
  | "SucceededAddSampleTemplates"
  | "SucceededSetDefaultTemplate"
  | "SucceededDeleteTemplate"
  | "SucceededEnsureTemplatesSeeded"
  | "FailedTemplateOp"
>;
type ReportMessage =
  | "OpenedTemplateReport"
  | "ClosedTemplateReport"
  | "GotTemplateReport"
  | "FailedTemplateReport";

/** A template's time report sheet: open while `templateReportFor` is set. */
const reportHandlers = (model: Model): Pick<AllHandlers, ReportMessage> => ({
  // The report replaces the action sheet; data for another template is dropped.
  OpenedTemplateReport: ({ id }) => ({
    model: {
      ...model,
      templateActionsFor: null,
      templateReportFor: id,
      templateReport: model.templateReport?.templateId === id ? model.templateReport : null,
      templateReportFailed: false,
    },
  }),
  ClosedTemplateReport: () => ({ model: { ...model, templateReportFor: null } }),
  GotTemplateReport: ({ report }) => ({
    model:
      report.templateId === model.templateReportFor
        ? { ...model, templateReport: report, templateReportFailed: false }
        : model,
  }),
  FailedTemplateReport: ({ templateId }) => ({
    model:
      templateId === model.templateReportFor ? { ...model, templateReportFailed: true } : model,
  }),
});

export const templateHandlers = (model: Model): TemplateHandlers => ({
  GotTemplates: ({ templates }) => {
    let nextSelected = model.selectedTemplateId;
    if (templates.length === 0) {
      nextSelected = null;
    } else if (nextSelected === null || !Array.some(templates, (t) => t.id === nextSelected)) {
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
      commands: needsPlaceholder ? [GeneratePlaceholderName.make({})] : [],
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
    const name = String.trim(model.newName);
    if (name === "") return { model };
    const [id, next] = takeId(model);
    return { model: next, commands: [CreateTemplate.make({ id, name })] };
  },
  SucceededCreateTemplate: () => ({
    model: { ...model, showCreate: false, newName: "", editor: null },
  }),
  CanceledCreateTemplate: () => ({
    model: { ...model, showCreate: false, newName: "", editor: null },
  }),
  ClickedTemplateRow: ({ id }) => ({
    model,
    commands: [NavigateInternal.make({ url: hrefFor(TemplateEditor({ templateId: id })) })],
  }),
  SucceededDuplicateTemplate: ({ id }) => ({
    model,
    commands: [NavigateInternal.make({ url: hrefFor(TemplateEditor({ templateId: id })) })],
  }),
  RequestedDeleteTemplate: ({ id }) => {
    const template = Array.findFirst(templatesOf(model), (candidate) => candidate.id === id);
    return {
      model: {
        ...model,
        templateActionsFor: null,
        pendingDelete: Option.match(template, {
          onNone: () => null,
          onSome: ({ name }) => ({ id, name }),
        }),
      },
    };
  },
  CanceledDeleteTemplate: () => ({ model: { ...model, pendingDelete: null } }),
  ConfirmedDeleteTemplate: () =>
    model.pendingDelete === null
      ? { model }
      : {
          model: { ...model, pendingDelete: null },
          commands: [DeleteTemplate.make({ id: model.pendingDelete.id })],
        },
  ClickedSetDefaultTemplate: ({ id }) => ({
    model: { ...model, templateActionsFor: null },
    commands: [SetDefaultTemplate.make({ id })],
  }),
  ClickedDuplicateTemplate: ({ id }) => ({
    model: { ...model, templateActionsFor: null },
    commands: [DuplicateTemplate.make({ id })],
  }),
  // The sheet's "Start session" names the session like the Session tab does.
  OpenedTemplateActions: ({ id }) => ({
    model: { ...model, templateActionsFor: id },
    commands: model.placeholderName === "" ? [GeneratePlaceholderName.make({})] : [],
  }),
  ClosedTemplateActions: () => ({ model: { ...model, templateActionsFor: null } }),
  ...reportHandlers(model),
  ClickedStartTemplateSession: ({ id }) => {
    const closed = { ...model, templateActionsFor: null };
    const found = Array.findFirst(templatesOf(model), (candidate) => candidate.id === id);
    if (Option.isNone(found)) return { model: closed };
    const template = found.value;
    // One live session at a time: like the Session tab, offer to resume it instead.
    const active = activeSessionOf(model);
    if (active !== null) {
      return {
        model: closed,
        commands: [
          NavigateInternal.make({ url: hrefFor(SessionRunner({ sessionId: active.id })) }),
        ],
      };
    }
    const [sessionId, next] = takeId(closed);
    return {
      model: { ...next, selectedTemplateId: id },
      commands: [
        StartSession.make({
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
    commands: [AddSampleTemplates.make({})],
  }),
  SucceededAddSampleTemplates: () => ({ model }),
  SucceededSetDefaultTemplate: () => ({ model }),
  SucceededDeleteTemplate: () => ({ model }),
  SucceededEnsureTemplatesSeeded: () => ({ model: { ...model, templatesSeedChecked: true } }),
  FailedTemplateOp: ({ error }) => {
    // A failed startup seed must not keep the templates subscription waiting.
    const base = { ...model, templatesSeedChecked: true, lastError: error };
    if (model.editor !== null && model.editor.isSaving) {
      return { model: { ...base, editor: { ...model.editor, isSaving: false } } };
    }
    return { model: { ...base, pendingDelete: null } };
  },
});
