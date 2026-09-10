import { Duration, Effect, Queue, Result, Schema as S, Stream } from "effect";
import { Command, Navigation, Port, Subscription, Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { toString as urlToString, type Url } from "foldkit/url";

import { Message } from "./messages";
import {
  AgentAction,
  AgentReply,
  actionError,
  agentPorts,
  confirmationState,
  confirmationTarget,
  requiresConfirmation,
} from "./agents/actions";
import { hrefFor } from "./we/routes";
import { Accent, Font, HexColour, IconLibrary, Theme } from "./we/theme";
import { changeAccent, changeFont, changeIconLibrary, changeTheme } from "./we/browserTheme";
import { FoldcnStyle } from "./we/style";
import { changeStyle } from "./we/browserTheme";
import { settingsPage } from "./we/features/settings/view";
import { getStore } from "./livestore/client";
import { FieldDef, FieldKind, tables } from "./livestore/schema";
import { generateSessionName } from "./we/random-name";
import {
  CancelEdit,
  EndSession,
  RecordTask,
  SaveEdit,
  SelectTask,
  UpdateFieldValue,
} from "./we/features/session/runnerCommands";
import { sessionView } from "./we/features/session/sessionView";
import { planSession, type SessionEmission } from "./machine/session/plan";
import { safeArray } from "./we/fieldRows";
import type { SessionEvent } from "./machine/session/sessionMachine";
import {
  AddSampleTemplates,
  CreateTemplate,
  DeleteTemplate,
  DuplicateTemplate,
  EnsureTemplatesSeeded,
  SetDefaultTemplate,
} from "./we/features/templates/commands";
import { SaveTemplate } from "./we/features/templates/editorCommands";
import {
  addOptionToDraft,
  deleteField,
  deleteOptionFromDraft,
  draftFromField,
  draftToFieldDef,
  fieldDiffers,
  hasChanges,
  withKindChanged,
  isDraftValid,
  isTemplateValid,
  makeEmptyDraft,
  moveField,
  moveOptionInDraft,
  renumberFields,
  toggleExclusiveOption,
} from "./we/features/templates/editor";
import { templateEditorPage } from "./we/features/templates/editorView";
import { templatesPage } from "./we/features/templates/view";
import { DiscardLiveSession, StartSession } from "./we/features/session/startCommands";
import { effectiveTemplateId, resolveSelectedTemplate } from "./we/features/session/startHelpers";
import { startView } from "./we/features/session/startView";
import { supportsRequired } from "./we/fields";
import {
  historyRouter,
  isFullScreenRoute,
  parseRoute,
  RouteSchema,
  sessionDetailRouter,
  sessionRunnerRouter,
  templateEditorRouter,
  templatesRouter,
  type Route,
} from "./we/routes";
import { button } from "@/components/ui/button";
import { Plus, icon, pageHeader, sidebar, tabBar } from "@/components/app";
import {
  DeleteHistorySession,
  ExportSessionCsv,
  RenameHistorySession,
} from "./we/features/history/historyCommands";
import { historyPage } from "./we/features/history/historyView";
import { sessionDetailPage } from "./we/features/history/sessionDetailView";

// MODEL — shell state + feature slices

export const Model = S.Struct({
  agentConfirmationVersion: S.Number,
  route: RouteSchema,
  theme: Theme,
  themeSaveFailed: S.Boolean,
  style: FoldcnStyle,
  styleSaveFailed: S.Boolean,
  font: Font,
  fontSaveFailed: S.Boolean,
  iconLibrary: IconLibrary,
  iconLibrarySaveFailed: S.Boolean,
  accent: Accent,
  accentSaveFailed: S.Boolean,
  accentDraft: S.NullOr(S.String),
  // Templates tab slice
  templates: S.Array(
    S.Struct({
      id: S.String,
      name: S.String,
      isDefault: S.Boolean,
      createdAt: S.Number,
      updatedAt: S.Number,
      fieldCount: S.Number,
      requiredCount: S.Number,
    }),
  ),
  showCreate: S.Boolean,
  newName: S.String,
  pendingDelete: S.Union([S.Null, S.Struct({ id: S.String, name: S.String })]),
  /** Template whose "⋯" action sheet is open, if any. */
  templateActionsFor: S.Union([S.Null, S.String]),
  lastError: S.Union([S.Null, S.String]),
  editor: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      name: S.String,
      isDefault: S.Boolean,
      fields: S.Array(FieldDef),
      original: S.Struct({
        name: S.String,
        isDefault: S.Boolean,
        fields: S.Array(FieldDef),
      }),
      isSaving: S.Boolean,
      showAddField: S.Boolean,
      editingFieldId: S.Union([S.Null, S.String]),
      draft: S.Union([
        S.Null,
        S.Struct({
          id: S.String,
          name: S.String,
          kind: FieldKind,
          isRequired: S.Boolean,
          defaultValue: S.String,
          sortOrder: S.Number,
          options: S.Array(S.String),
          exclusiveOptions: S.Array(S.String),
          newOptionText: S.String,
        }),
      ]),
      pendingDiscard: S.Boolean,
    }),
  ]),
  // Start tab slice (S3)
  selectedTemplateId: S.Union([S.Null, S.String]),
  sessionNameInput: S.String,
  placeholderName: S.String,
  activeSession: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      templateId: S.Union([S.Null, S.String]),
      templateName: S.String,
      sessionName: S.String,
      startedAt: S.Number,
      completedCount: S.Number,
    }),
  ]),
  pendingDiscardSession: S.Boolean,
  // Runner slice (S4) — live session form canvas
  runner: S.Union([
    S.Null,
    S.Struct({
      sessionId: S.String,
      templateName: S.String,
      sessionName: S.String,
      startedAt: S.Number,
      tasks: S.Array(
        S.Struct({
          id: S.String,
          orderIndex: S.Number,
          endDate: S.Union([S.Null, S.Number]),
          isBeingEdited: S.Boolean,
          sections: S.Array(
            S.Struct({
              id: S.String,
              taskId: S.String,
              name: S.String,
              kind: S.String,
              isRequired: S.Boolean,
              defaultValue: S.String,
              sortOrder: S.Number,
              options: S.Array(S.String),
              exclusiveOptions: S.Array(S.String),
              value: S.String,
              startDate: S.Union([S.Null, S.Number]),
            }),
          ),
        }),
      ),
      currentTaskId: S.Union([S.Null, S.String]),
      completedCount: S.Number,
      focusedSectionId: S.Union([S.Null, S.String]),
      showTaskList: S.Boolean,
      showEndConfirm: S.Boolean,
      showSidebar: S.Boolean,
      lastError: S.Union([S.Null, S.String]),
      now: S.Number,
      editBackup: S.Union([
        S.Null,
        S.Struct({ taskId: S.String, values: S.Record(S.String, S.String) }),
      ]),
    }),
  ]),
  // Machine phase for the live Session statechart (Idle ⇔ runner === null)
  runnerPhase: S.Union([S.Literal("collecting"), S.Literal("confirming")]),
  // History slice (S6)
  history: S.Array(
    S.Struct({
      id: S.String,
      displayName: S.String,
      templateName: S.String,
      sessionName: S.String,
      startedAt: S.Number,
      endedAt: S.Number,
      taskCount: S.Number,
    }),
  ),
  selectedHistorySession: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      sessionName: S.String,
      templateName: S.String,
      startedAt: S.Number,
      endedAt: S.Union([S.Null, S.Number]),
      taskCount: S.Number,
      tasks: S.Array(
        S.Struct({
          id: S.String,
          taskId: S.Number,
          startedAt: S.Union([S.Null, S.Number]),
          endedAt: S.Union([S.Null, S.Number]),
          sections: S.Array(
            S.Struct({
              sectionName: S.String,
              value: S.String,
              sectionType: S.String,
              isRequired: S.Boolean,
              startedAt: S.Union([S.Null, S.Number]),
            }),
          ),
        }),
      ),
    }),
  ]),
  pendingHistoryDelete: S.Union([S.Null, S.Struct({ id: S.String, displayName: S.String })]),
  showEditHistoryName: S.Boolean,
  editHistoryNameInput: S.String,
  selectedHistoryTaskId: S.Union([S.Null, S.String]),
  historyActionsFor: S.Union([S.Null, S.String]),
  /** Where an internal link wanted to go while the editor had unsaved changes. */
  pendingNavigationUrl: S.Union([S.Null, S.String]),
  csvError: S.Union([S.Null, S.String]),
});
export type Model = typeof Model.Type;

const initialModel = (route: Route): Model => ({
  agentConfirmationVersion: 0,
  route,
  theme: "auto",
  themeSaveFailed: false,
  style: "nova",
  styleSaveFailed: false,
  font: "sans",
  fontSaveFailed: false,
  iconLibrary: "hugeicons",
  iconLibrarySaveFailed: false,
  accent: "default",
  accentSaveFailed: false,
  accentDraft: null,
  templates: [],
  showCreate: false,
  newName: "",
  pendingDelete: null,
  templateActionsFor: null,
  lastError: null,
  editor: null,
  selectedTemplateId: null,
  sessionNameInput: "",
  placeholderName: generateSessionName(),
  activeSession: null,
  pendingDiscardSession: false,
  runner: null,
  runnerPhase: "collecting",
  history: [],
  selectedHistorySession: null,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  historyActionsFor: null,
  pendingNavigationUrl: null,
  csvError: null,
});

// INIT — first paint parses the URL and seeds sample content if the store is
// empty (seeded once at container init; a session can't start without a template)

export const init = (url: Url) => ({
  model: initialModel(parseRoute(url)),
  commands: [EnsureTemplatesSeeded({})],
});

// COMMANDS — navigation per foldkit contract: the runtime preventDefaults
// same-origin anchors and hands us the UrlRequest; only pushUrl/load touch
// history, and GotRoute arrives afterwards via onUrlChange.

const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: S.String },
  messages: [Message.Navigated],
  execute: ({ url }) => Effect.map(Navigation.pushUrl(url), () => Message.Navigated()),
});

const SaveTheme = Command.define("SaveTheme", {
  args: { theme: Theme },
  messages: [Message.ThemeSaveFinished],
  execute: ({ theme }) =>
    Effect.map(changeTheme(theme), (saved) => Message.ThemeSaveFinished({ theme, saved })),
});

const SaveStyle = Command.define("SaveStyle", {
  args: { style: FoldcnStyle },
  messages: [Message.StyleSaveFinished],
  execute: ({ style }) =>
    Effect.map(changeStyle(style), (saved) => Message.StyleSaveFinished({ style, saved })),
});

const SaveFont = Command.define("SaveFont", {
  args: { font: Font },
  messages: [Message.FontSaveFinished],
  execute: ({ font }) =>
    Effect.map(changeFont(font), (saved) => Message.FontSaveFinished({ font, saved })),
});

const SaveIconLibrary = Command.define("SaveIconLibrary", {
  args: { library: IconLibrary },
  messages: [Message.IconLibrarySaveFinished],
  execute: ({ library }) =>
    Effect.map(changeIconLibrary(library), (saved) =>
      Message.IconLibrarySaveFinished({ library, saved }),
    ),
});

const SaveAccent = Command.define("SaveAccent", {
  args: { accent: Accent },
  messages: [Message.AccentSaveFinished],
  execute: ({ accent }) =>
    Effect.map(changeAccent(accent), (saved) => Message.AccentSaveFinished({ accent, saved })),
});

const NavigateExternal = Command.define("NavigateExternal", {
  args: { href: S.String },
  messages: [Message.Navigated],
  execute: ({ href }) => Effect.map(Navigation.load(href), () => Message.Navigated()),
});

// ── Runner state machine bridge (effect-machine → FoldKit) ───────────────

const emissionToCommand = (emission: SessionEmission): Update.Commands<Message> => {
  switch (emission._tag) {
    case "CommitFieldValue":
      return [UpdateFieldValue({ taskFieldId: emission.taskFieldId, value: emission.value })];
    case "CommitRecord":
      return [RecordTask({ sessionId: emission.sessionId, currentTaskId: emission.taskId })];
    case "CommitSelectTask":
      return [SelectTask({ sessionId: emission.sessionId, taskId: emission.taskId })];
    case "CommitCancelEdit":
      return [CancelEdit({ taskId: emission.taskId, backup: emission.backup })];
    case "CommitSaveEdit":
      return [SaveEdit({ taskId: emission.taskId })];
    case "CommitEndSession":
      return [EndSession({ sessionId: emission.sessionId })];
  }
};

/** Plan a Session-machine event; merge the result into model + commands. */
const applyPlan = (model: Model, event: SessionEvent) => {
  const plan = planSession(model.runner, model.runnerPhase, event);
  const changed =
    plan.runner !== model.runner || plan.phase !== model.runnerPhase || plan.emissions.length > 0;
  return changed
    ? {
        model: { ...model, runner: plan.runner, runnerPhase: plan.phase },
        commands: plan.emissions.flatMap(emissionToCommand),
      }
    : { model };
};

// UPDATE — pure state transitions

const ReplyToAgent = Command.define("ReplyToAgent", {
  args: { reply: AgentReply },
  messages: [Message.Navigated],
  execute: ({ reply }) =>
    Port.emit(agentPorts.outbound.agentReply, reply).pipe(Effect.as(Message.Navigated())),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const result = updateInternal(model, message);
  // AgentRequest delegates to this function, so its reply already includes the
  // new version. Other sources (including UI events) invalidate approvals too.
  if (message._tag === "AgentRequest") return result;
  if (
    confirmationState(model) !== confirmationState(result.model) ||
    message._tag === "ConfirmedDeleteTemplate" ||
    message._tag === "ConfirmedHistoryDelete" ||
    message._tag === "ConfirmedDiscardSession" ||
    message._tag === "ConfirmedEndSession" ||
    message._tag === "ConfirmedDiscard" ||
    message._tag === "RequestedDeleteTemplate" ||
    message._tag === "RequestedHistoryDelete"
  )
    return {
      ...result,
      model: { ...result.model, agentConfirmationVersion: model.agentConfirmationVersion + 1 },
    };
  return result;
};

const updateInternal = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    AgentRequest: ({ requestId, action, confirmationVersion }) => {
      const decoded = action === null ? null : S.decodeUnknownResult(AgentAction)(action);
      const operation = decoded !== null && Result.isSuccess(decoded) ? decoded.success : null;
      const error =
        decoded !== null && Result.isFailure(decoded)
          ? "Unsupported or invalid app action."
          : operation === null
            ? null
            : requiresConfirmation(operation) &&
                (confirmationVersion !== model.agentConfirmationVersion ||
                  confirmationTarget(model, operation) === null)
              ? "Confirmation changed or is missing; request confirmation again."
              : actionError(model, operation);
      const result =
        operation === null || error !== null
          ? { model }
          : operation._tag === "Navigate"
            ? { model, commands: [NavigateInternal({ url: hrefFor(operation.route) })] }
            : update(model, operation);
      const commands = result.commands ?? [];
      return {
        model: result.model,
        commands: [
          ...commands,
          ReplyToAgent({
            reply: {
              requestId,
              state: result.model,
              changed: result.model !== model || commands.length > 0,
              pendingCommands: commands.length,
              error,
            },
          }),
        ],
      };
    },
    SelectedTheme: ({ theme }) => ({
      model: { ...model, theme },
      commands: [SaveTheme({ theme })],
    }),
    ThemeSaveFinished: ({ theme, saved }) => ({
      model: theme === model.theme ? { ...model, themeSaveFailed: !saved } : model,
      commands: [],
    }),
    SelectedStyle: ({ style }) => ({
      model: { ...model, style },
      commands: [SaveStyle({ style })],
    }),
    StyleSaveFinished: ({ style, saved }) => ({
      model: style === model.style ? { ...model, styleSaveFailed: !saved } : model,
      commands: [],
    }),
    SelectedFont: ({ font }) => ({
      model: { ...model, font },
      commands: [SaveFont({ font })],
    }),
    FontSaveFinished: ({ font, saved }) => ({
      model: font === model.font ? { ...model, fontSaveFailed: !saved } : model,
    }),
    SelectedIconLibrary: ({ library }) => ({
      model: { ...model, iconLibrary: library },
      commands: [SaveIconLibrary({ library })],
    }),
    IconLibrarySaveFinished: ({ library, saved }) => ({
      model: library === model.iconLibrary ? { ...model, iconLibrarySaveFailed: !saved } : model,
    }),
    SelectedAccent: ({ accent }) => ({
      model: { ...model, accent, accentDraft: null },
      commands: [SaveAccent({ accent })],
    }),
    OpenedAccentPicker: () => ({
      model: { ...model, accentDraft: model.accent.startsWith("#") ? model.accent : "#2563eb" },
    }),
    ChangedAccentDraft: ({ colour }) => ({
      model: model.accentDraft === null ? model : { ...model, accentDraft: colour },
    }),
    CanceledAccentPicker: () => ({ model: { ...model, accentDraft: null } }),
    ConfirmedAccentPicker: () => {
      if (!S.is(HexColour)(model.accentDraft)) return { model };
      const accent = model.accentDraft.toLowerCase();
      return {
        model: { ...model, accent, accentDraft: null },
        commands: [SaveAccent({ accent })],
      };
    },
    AccentSaveFinished: ({ accent, saved }) => ({
      model: accent === model.accent ? { ...model, accentSaveFailed: !saved } : model,
    }),
    // ── Routing ────────────────────────────────────────────────────────────
    GotRoute: ({ route }) => {
      let base =
        route._tag === "TemplateEditor"
          ? model.editor !== null && model.editor.id === route.templateId
            ? { ...model, route, templateActionsFor: null }
            : { ...model, route, editor: null, templateActionsFor: null }
          : { ...model, route, editor: null, templateActionsFor: null };
      base = { ...base, historyActionsFor: null, showCreate: false, accentDraft: null };
      // Clear history detail when leaving SessionDetail
      if (route._tag !== "SessionDetail" && base.selectedHistorySession !== null) {
        base = {
          ...base,
          selectedHistorySession: null,
          selectedHistoryTaskId: null,
          showEditHistoryName: false,
        };
      }
      // Clear stale task selection when switching detail session
      if (
        route._tag === "SessionDetail" &&
        base.selectedHistorySession !== null &&
        base.selectedHistorySession.id !== route.sessionId
      ) {
        base = {
          ...base,
          selectedHistorySession: null,
          selectedHistoryTaskId: null,
          showEditHistoryName: false,
        };
      }
      // Regenerate placeholder on every entry to Start tab when no active session (spec: onAppear & after start). Preserve typed input via sessionNameInput.
      if (route._tag === "StartTab" && base.activeSession === null) {
        return { model: { ...base, placeholderName: generateSessionName() } };
      }
      return { model: base };
    },
    ClickedLink: ({ request }) => {
      if (request._tag !== "Internal")
        return { model, commands: [NavigateExternal({ href: request.href })] };
      const url = urlToString(request.url);
      // Leaving the template editor with unsaved changes asks first; the
      // requested destination is kept and used once the discard is confirmed.
      if (
        (model.route._tag === "TemplateEditor" || model.showCreate) &&
        model.editor !== null &&
        (hasChanges(model.editor) || model.editor.draft !== null)
      ) {
        return {
          model: {
            ...model,
            pendingNavigationUrl: url,
            editor: { ...model.editor, pendingDiscard: true },
          },
        };
      }
      return { model, commands: [NavigateInternal({ url })] };
    },
    Navigated: () => ({ model }),

    // ── Templates ──────────────────────────────────────────────────────────
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
      const template = model.templates.find((template) => template.id === id);
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

    // ── Template editor ───────────────────────────────────────────────────
    GotTemplateDetail: ({ template }) => {
      if (template === null) {
        return {
          model: { ...model, editor: null, lastError: "Template not found." },
          commands: [NavigateInternal({ url: `#${templatesRouter()}` })],
        };
      }
      if (model.editor !== null && model.editor.id === template.id) {
        const sorted = [...template.fields].sort((a, b) => a.sortOrder - b.sortOrder);
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
      const sorted = [...template.fields].sort((a, b) => a.sortOrder - b.sortOrder);
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
      const draft = makeEmptyDraft(model.editor.fields.length);
      return {
        model: {
          ...model,
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
      const editedField = model.editor.fields.find(
        (field) => field.id === model.editor?.editingFieldId,
      );
      const isDraftDirty =
        draft !== null &&
        (model.editor.editingFieldId === null
          ? draft.name.trim() !== "" ||
            draft.kind !== "textInput" ||
            draft.isRequired ||
            draft.defaultValue !== "" ||
            draft.options.length > 0 ||
            draft.newOptionText !== ""
          : draft.newOptionText !== "" ||
            editedField === undefined ||
            fieldDiffers(draftToFieldDef(draft), draftToFieldDef(draftFromField(editedField))));
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
      const field = model.editor.fields.find((entry) => entry.id === id);
      if (field === undefined) return { model };
      return {
        model: {
          ...model,
          editor: {
            ...model.editor,
            editingFieldId: id,
            showAddField: false,
            draft: draftFromField(field),
          },
        },
      };
    },
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
      if (!supportsRequired(model.editor.draft.kind)) return { model };
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
      return { model: { ...model, editor: { ...model.editor, draft: nextDraft } } };
    },
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
    ConfirmedSaveField: () => {
      if (model.editor === null || model.editor.draft === null) return { model };
      if (!isDraftValid(model.editor.draft)) return { model };
      const fieldDef = draftToFieldDef(model.editor.draft);
      let nextFields: ReadonlyArray<FieldDef>;
      if (model.editor.editingFieldId !== null) {
        nextFields = model.editor.fields.map((entry) =>
          entry.id === model.editor?.editingFieldId
            ? { ...fieldDef, sortOrder: entry.sortOrder }
            : entry,
        );
      } else {
        nextFields = [
          ...model.editor.fields,
          { ...fieldDef, sortOrder: model.editor.fields.length },
        ];
      }
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
    },
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
            fields: [...fields] as unknown as ReadonlyArray<FieldDef>,
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
        commands: [
          NavigateInternal({ url: model.pendingNavigationUrl ?? `#${templatesRouter()}` }),
        ],
      };
    },

    // ── Start tab ─────────────────────────────────────────────────────────
    GotActiveSession: ({ activeSession }) => ({ model: { ...model, activeSession } }),
    ChangedSessionNameInput: ({ text }) => ({ model: { ...model, sessionNameInput: text } }),
    SelectedTemplate: ({ id }) => ({ model: { ...model, selectedTemplateId: id } }),
    ClickedStartSession: () => {
      const selected = resolveSelectedTemplate(model.templates, model.selectedTemplateId);
      if (selected === null) return { model };
      const sessionName =
        model.sessionNameInput.trim() !== ""
          ? model.sessionNameInput.trim()
          : model.placeholderName;
      const id = crypto.randomUUID();
      // Pass empty fields array; StartSession will resolve via store fallback
      return {
        model,
        commands: [
          StartSession({
            id,
            templateId: selected.id,
            templateName: selected.name,
            sessionName,
            fields: [],
          }),
        ],
      };
    },
    SessionStarted: ({ sessionId }) => ({
      model: {
        ...model,
        sessionNameInput: "",
        placeholderName: generateSessionName(),
        lastError: null,
      },
      commands: [NavigateInternal({ url: `#${sessionRunnerRouter({ sessionId })}` })],
    }),
    ClickedResumeSession: () => {
      if (model.activeSession === null) return { model };
      return {
        model,
        commands: [
          NavigateInternal({
            url: `#${sessionRunnerRouter({ sessionId: model.activeSession.id })}`,
          }),
        ],
      };
    },
    ClickedDiscardSession: () => ({ model: { ...model, pendingDiscardSession: true } }),
    CanceledDiscardSession: () => ({ model: { ...model, pendingDiscardSession: false } }),
    ConfirmedDiscardSession: () => {
      if (model.activeSession === null)
        return { model: { ...model, pendingDiscardSession: false } };
      return {
        model: { ...model, pendingDiscardSession: false },
        commands: [DiscardLiveSession({ sessionId: model.activeSession.id })],
      };
    },
    SessionDiscarded: () => ({
      model: {
        ...model,
        activeSession: null,
        pendingDiscardSession: false,
        placeholderName: generateSessionName(),
        lastError: null,
      },
    }),
    FailedSessionOp: ({ error }) => ({
      model: { ...model, lastError: error, pendingDiscardSession: false },
    }),

    // ── Runner (effect-machine state machine) ────────────────────────────
    // Every runner message is planned through the Session machine
    // (src/machine/session/): the machine owns the control logic and emits
    // Commit* effects which become LiveStore commands below.
    GotRunnerData: ({ data }) => {
      const planned = applyPlan(model, { _tag: "DataSynced", data } as SessionEvent);
      // Dead link / store reset mid-session: the runner route has no live
      // session — bounce to Start instead of an infinite "Loading session…".
      if (data === null && model.route._tag === "SessionRunner" && planned.model.runner === null) {
        return {
          model: planned.model,
          commands: [...(planned.commands ?? []), NavigateInternal({ url: "#/start" })],
        };
      }
      return planned;
    },
    Tick: ({ now }) => {
      if (model.runner === null) return { model };
      return { model: { ...model, runner: { ...model.runner, now } } };
    },
    ChangedFieldValue: ({ taskFieldId, value }) =>
      applyPlan(model, { _tag: "FieldChanged", taskFieldId, value } as SessionEvent),
    ClickedRecord: () => applyPlan(model, { _tag: "RecordRequested" }),
    TaskRecorded: () => applyPlan(model, { _tag: "RecordAcked" }),
    ClickedEndSession: () => applyPlan(model, { _tag: "EndRequested" }),
    CanceledEndSession: () => applyPlan(model, { _tag: "EndCancelled" }),
    ConfirmedEndSession: () => applyPlan(model, { _tag: "EndConfirmed" }),
    SessionEnded: () => {
      const planned = applyPlan(model, { _tag: "EndAcked" });
      return {
        model: { ...planned.model, placeholderName: generateSessionName() },
        commands: [...(planned.commands ?? []), NavigateInternal({ url: "#/start" })],
      };
    },
    ClickedSelectTask: ({ taskId }) => applyPlan(model, { _tag: "TaskSelected", taskId }),
    ToggledTaskList: () => applyPlan(model, { _tag: "TaskListToggled" }),
    FocusedSection: ({ fieldId }) => applyPlan(model, { _tag: "SectionFocused", fieldId }),
    ClickedCancelEdit: () => applyPlan(model, { _tag: "EditCancelled" }),
    ClickedSaveEdit: () => applyPlan(model, { _tag: "EditSaved" }),
    TaskEditStarted: () => ({ model }),
    UpdatedFieldValue: () => ({ model }),
    TaskEditFinished: () => applyPlan(model, { _tag: "EditAcked" }),
    FailedRunnerOp: ({ error }) => {
      if (model.runner === null) return { model: { ...model, lastError: error } };
      return { model: { ...model, runner: { ...model.runner, lastError: error } } };
    },
    DismissedRunnerError: () => {
      if (model.runner === null) return { model: { ...model, lastError: null } };
      return { model: { ...model, runner: { ...model.runner, lastError: null } } };
    },
    ToggledSidebar: () => {
      if (model.runner === null) return { model };
      return {
        model: { ...model, runner: { ...model.runner, showSidebar: !model.runner.showSidebar } },
      };
    },

    // ── History ───────────────────────────────────────────────────────────
    GotHistory: ({ history }) => ({ model: { ...model, history } }),
    GotHistoryDetail: ({ detail }) => {
      if (detail === null)
        return {
          model: {
            ...model,
            selectedHistorySession: null,
            selectedHistoryTaskId: null,
            showEditHistoryName: false,
            editHistoryNameInput: "",
          },
          commands:
            model.route._tag === "SessionDetail"
              ? [NavigateInternal({ url: `#${historyRouter()}` })]
              : [],
        };
      // Preserve edit state if already editing? keep showEdit flag
      return {
        model: {
          ...model,
          selectedHistorySession: detail,
          // If entering detail first time, seed edit input with sessionName
          editHistoryNameInput:
            model.selectedHistorySession === null || model.selectedHistorySession.id !== detail.id
              ? detail.sessionName
              : model.editHistoryNameInput,
        },
      };
    },
    ClickedHistoryRow: ({ id }) => ({
      model,
      commands: [NavigateInternal({ url: `#${sessionDetailRouter({ sessionId: id })}` })],
    }),
    RequestedHistoryDelete: ({ id, displayName }) => {
      const session = model.history.find((session) => session.id === id);
      return {
        model: {
          ...model,
          historyActionsFor: null,
          pendingHistoryDelete: { id, displayName: session?.displayName ?? displayName },
        },
      };
    },
    OpenedHistoryActions: ({ id }) => ({ model: { ...model, historyActionsFor: id } }),
    ClosedHistoryActions: () => ({ model: { ...model, historyActionsFor: null } }),
    CanceledHistoryDelete: () => ({ model: { ...model, pendingHistoryDelete: null } }),
    ConfirmedHistoryDelete: () =>
      model.pendingHistoryDelete === null
        ? { model }
        : {
            // Keep pending until HistoryDeleted arrives so we know which was deleted
            model,
            commands: [DeleteHistorySession({ id: model.pendingHistoryDelete.id })],
          },
    HistoryDeleted: () => {
      const deletedId = model.pendingHistoryDelete?.id ?? null;
      const shouldNavigate =
        model.route._tag === "SessionDetail" &&
        (deletedId !== null
          ? model.route.sessionId === deletedId
          : model.selectedHistorySession !== null &&
            model.route.sessionId === model.selectedHistorySession.id);
      if (shouldNavigate) {
        return {
          model: {
            ...model,
            pendingHistoryDelete: null,
            selectedHistorySession: null,
            selectedHistoryTaskId: null,
            showEditHistoryName: false,
            editHistoryNameInput: "",
          },
          commands: [NavigateInternal({ url: "#/history" })],
        };
      }
      return { model: { ...model, pendingHistoryDelete: null } };
    },
    ClickedEditHistoryName: () => {
      if (model.selectedHistorySession === null) return { model };
      return {
        model: {
          ...model,
          showEditHistoryName: true,
          editHistoryNameInput: model.selectedHistorySession.sessionName,
        },
      };
    },
    ChangedEditHistoryName: ({ text }) => ({ model: { ...model, editHistoryNameInput: text } }),
    CanceledEditHistoryName: () => ({
      model: {
        ...model,
        showEditHistoryName: false,
        editHistoryNameInput: model.selectedHistorySession?.sessionName ?? "",
      },
    }),
    ConfirmedEditHistoryName: () => {
      if (model.selectedHistorySession === null)
        return { model: { ...model, showEditHistoryName: false } };
      const trimmed = model.editHistoryNameInput.trim();
      // Allow empty to clear custom name (revert to template)
      return {
        model: { ...model, showEditHistoryName: false },
        commands: [
          RenameHistorySession({ id: model.selectedHistorySession.id, sessionName: trimmed }),
        ],
      };
    },
    HistoryNameUpdated: () => ({ model: { ...model, showEditHistoryName: false } }),
    ClickedHistoryTask: ({ taskId }) => ({ model: { ...model, selectedHistoryTaskId: taskId } }),
    DismissedHistoryTask: () => ({ model: { ...model, selectedHistoryTaskId: null } }),
    ClickedExportHistoryCsv: ({ sessionId }) => ({
      model: { ...model, csvError: null, historyActionsFor: null },
      commands: [ExportSessionCsv({ sessionId })],
    }),
    CsvExported: () => ({ model }),
    FailedCsvExport: ({ error }) => ({ model: { ...model, csvError: error } }),
    DismissedCsvError: () => ({ model: { ...model, csvError: null } }),
  });

// SUBSCRIPTIONS — LiveStore pushes reactive query results into update.
// Two tables merge into one summary payload; either change re-emits.

type TemplateRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};
type FieldRow = { readonly templateId: string; readonly isRequired: number };

const buildSummaries = (
  templateRows: ReadonlyArray<TemplateRow>,
  fieldRows: ReadonlyArray<FieldRow>,
) => {
  const counts = new Map<string, { count: number; required: number }>();
  for (const row of fieldRows) {
    const entry = counts.get(row.templateId) ?? { count: 0, required: 0 };
    counts.set(row.templateId, {
      count: entry.count + 1,
      required: entry.required + (row.isRequired === 1 ? 1 : 0),
    });
  }
  return [...templateRows]
    .map((row) => {
      const c = counts.get(row.id) ?? { count: 0, required: 0 };
      return {
        id: row.id,
        name: row.name,
        isDefault: row.isDefault === 1,
        createdAt: Number(row.createdAt),
        updatedAt: Number(row.updatedAt),
        fieldCount: c.count,
        requiredCount: c.required,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const templatesStream: Stream.Stream<Message> = Stream.callback((queue) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const store = await getStore();
      let latestTemplates: ReadonlyArray<TemplateRow> = [];
      let latestFields: ReadonlyArray<FieldRow> = [];
      const push = () =>
        Queue.offerUnsafe(
          queue,
          Message.GotTemplates({ templates: buildSummaries(latestTemplates, latestFields) }),
        );
      const unsubscribeTemplates = store.subscribe(
        tables.templates.select().orderBy("name", "asc"),
        (rows) => {
          latestTemplates = rows as unknown as ReadonlyArray<TemplateRow>;
          push();
        },
      );
      const unsubscribeFields = store.subscribe(tables.templateFields.select(), (rows) => {
        latestFields = (rows as unknown as Array<{ templateId: string; isRequired: number }>).map(
          (r) => ({
            templateId: r.templateId,
            isRequired: r.isRequired,
          }),
        );
        push();
      });
      return [unsubscribeTemplates, unsubscribeFields] as const;
    }),
    (unsubs) => Effect.sync(() => unsubs.forEach((unsubscribe) => unsubscribe())),
  ).pipe(
    Effect.asVoid,
    Effect.flatMap(() => Effect.never),
  ),
);

type DetailTemplateRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: number;
};

type DetailFieldRow = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
};

const templateDetailStream = (templateId: string): Stream.Stream<Message> =>
  Stream.callback((queue) =>
    Effect.acquireRelease(
      Effect.promise(async () => {
        const store = await getStore();
        let templateLoaded = false;
        let latestTemplate: DetailTemplateRow | null = null;
        let latestFields: ReadonlyArray<DetailFieldRow> = [];

        const push = () => {
          if (!templateLoaded) return;
          if (latestTemplate === null) {
            Queue.offerUnsafe(queue, Message.GotTemplateDetail({ template: null }));
            return;
          }
          const fields = [...latestFields]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((row) => ({
              id: row.id,
              name: row.name,
              kind: row.kind as FieldDef["kind"],
              isRequired: row.isRequired === 1,
              defaultValue: row.defaultValue,
              sortOrder: row.sortOrder,
              options: safeArray(row.optionsJson),
              exclusiveOptions: safeArray(row.exclusiveOptionsJson),
            }));
          Queue.offerUnsafe(
            queue,
            Message.GotTemplateDetail({
              template: {
                id: latestTemplate.id,
                name: latestTemplate.name,
                isDefault: latestTemplate.isDefault === 1,
                fields,
              },
            }),
          );
        };

        const unsubscribeTemplate = store.subscribe(
          tables.templates.select().where({ id: templateId }),
          (rows) => {
            const first = (rows as unknown as ReadonlyArray<DetailTemplateRow>)[0] ?? null;
            latestTemplate = first;
            templateLoaded = true;
            push();
          },
        );

        const unsubscribeFields = store.subscribe(
          tables.templateFields.select().where({ templateId }).orderBy("sortOrder", "asc"),
          (rows) => {
            latestFields = rows as unknown as ReadonlyArray<DetailFieldRow>;
            push();
          },
        );

        return [unsubscribeTemplate, unsubscribeFields] as const;
      }),
      (unsubs) => Effect.sync(() => unsubs.forEach((unsubscribe) => unsubscribe())),
    ).pipe(
      Effect.asVoid,
      Effect.flatMap(() => Effect.never),
    ),
  );

type ActiveSessionRow = {
  readonly id: string;
  readonly templateId: string | null;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type TaskRowLite = { readonly sessionId: string; readonly endDate: number | Date | null };

const toEpoch = (value: number | Date): number =>
  value instanceof Date ? value.getTime() : Number(value);

const activeSessionStream: Stream.Stream<Message> = Stream.callback((queue) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const store = await getStore();
      let latestSessions: ReadonlyArray<ActiveSessionRow> = [];
      let latestTasks: ReadonlyArray<TaskRowLite> = [];

      const push = () => {
        const liveSessions = (latestSessions as ReadonlyArray<ActiveSessionRow>).filter(
          (row) => row.endedAt === null || row.endedAt === undefined,
        );
        if (liveSessions.length === 0) {
          Queue.offerUnsafe(queue, Message.GotActiveSession({ activeSession: null }));
          return;
        }
        // Most recent live session by startedAt desc
        const sorted = [...liveSessions].sort(
          (a, b) => toEpoch(b.startedAt) - toEpoch(a.startedAt),
        );
        const active = sorted[0] as ActiveSessionRow;
        const completedCount = (latestTasks as ReadonlyArray<TaskRowLite>).filter(
          (task) =>
            task.sessionId === active.id && task.endDate !== null && task.endDate !== undefined,
        ).length;
        Queue.offerUnsafe(
          queue,
          Message.GotActiveSession({
            activeSession: {
              id: active.id,
              templateId: active.templateId,
              templateName: active.templateName,
              sessionName: active.sessionName,
              startedAt: toEpoch(active.startedAt),
              completedCount,
            },
          }),
        );
      };

      const unsubscribeSessions = store.subscribe(tables.sessions.select(), (rows) => {
        latestSessions = rows as unknown as ReadonlyArray<ActiveSessionRow>;
        push();
      });
      const unsubscribeTasks = store.subscribe(tables.sessionTasks.select(), (rows) => {
        latestTasks = rows as unknown as ReadonlyArray<TaskRowLite>;
        push();
      });
      return [unsubscribeSessions, unsubscribeTasks] as const;
    }),
    (unsubs) => Effect.sync(() => unsubs.forEach((unsubscribe) => unsubscribe())),
  ).pipe(
    Effect.asVoid,
    Effect.flatMap(() => Effect.never),
  ),
);

type RunnerSessionRow = {
  readonly id: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type RunnerTaskRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly orderIndex: number;
  readonly endDate: number | Date | null;
  readonly isBeingEdited: number;
};
type RunnerFieldRow = {
  readonly id: string;
  readonly taskId: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
  readonly value: string;
  readonly startDate: number | Date | null;
};

const runnerStream = (sessionId: string): Stream.Stream<Message> =>
  Stream.callback((queue) =>
    Effect.acquireRelease(
      Effect.promise(async () => {
        const store = await getStore();
        let latestSessions: ReadonlyArray<RunnerSessionRow> = [];
        let latestTasks: ReadonlyArray<RunnerTaskRow> = [];
        let latestFields: ReadonlyArray<RunnerFieldRow> = [];
        let sessionsLoaded = false;

        const push = () => {
          if (!sessionsLoaded) return;
          const session =
            (latestSessions as ReadonlyArray<RunnerSessionRow>).find((s) => s.id === sessionId) ??
            null;
          if (session === null || (session.endedAt !== null && session.endedAt !== undefined)) {
            Queue.offerUnsafe(queue, Message.GotRunnerData({ data: null }));
            return;
          }
          const tasksForSession = (latestTasks as ReadonlyArray<RunnerTaskRow>).filter(
            (t) => t.sessionId === sessionId,
          );
          const sortedTasks = [...tasksForSession].sort(
            (a, b) => Number(a.orderIndex) - Number(b.orderIndex),
          );
          const taskIds = new Set(sortedTasks.map((t) => t.id));
          const fieldsByTask = new Map<string, ReadonlyArray<RunnerFieldRow>>();
          for (const f of latestFields as ReadonlyArray<RunnerFieldRow>) {
            if (!taskIds.has(f.taskId)) continue;
            const arr = fieldsByTask.get(f.taskId) ?? [];
            (fieldsByTask as Map<string, Array<RunnerFieldRow>>).set(f.taskId, [
              ...(arr as Array<RunnerFieldRow>),
              f,
            ]);
          }
          const tasks = sortedTasks.map((t) => {
            const sections = [...(fieldsByTask.get(t.id) ?? [])]
              .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
              .map((r) => ({
                id: r.id,
                taskId: r.taskId,
                name: r.name,
                kind: r.kind,
                isRequired: r.isRequired === 1,
                defaultValue: r.defaultValue,
                sortOrder: Number(r.sortOrder),
                options: safeArray(r.optionsJson),
                exclusiveOptions: safeArray(r.exclusiveOptionsJson),
                value: r.value,
                startDate:
                  r.startDate === null || r.startDate === undefined
                    ? null
                    : toEpoch(r.startDate as number | Date),
              }));
            return {
              id: t.id,
              orderIndex: Number(t.orderIndex),
              endDate:
                t.endDate === null || t.endDate === undefined
                  ? null
                  : toEpoch(t.endDate as number | Date),
              isBeingEdited: t.isBeingEdited === 1,
              sections,
            };
          });
          // Determine currentTaskId (prefers edited, else unfinished with max orderIndex)
          const edited = tasks.find((t) => t.isBeingEdited);
          let currentTaskId: string | null = null;
          if (edited !== undefined) currentTaskId = edited.id;
          else {
            const unfinished = tasks.filter((t) => t.endDate === null);
            if (unfinished.length > 0) {
              const latest = unfinished.reduce((a, b) => (a.orderIndex > b.orderIndex ? a : b));
              currentTaskId = latest.id;
            } else if (tasks.length > 0) {
              currentTaskId = tasks[tasks.length - 1]?.id ?? null;
            }
          }
          const completedCount = tasks.filter((t) => t.endDate !== null).length;
          Queue.offerUnsafe(
            queue,
            Message.GotRunnerData({
              data: {
                sessionId: session.id,
                templateName: session.templateName,
                sessionName: session.sessionName,
                startedAt: toEpoch(session.startedAt),
                tasks,
                currentTaskId,
                completedCount,
              },
            }),
          );
        };

        const unsubscribeSessions = store.subscribe(
          tables.sessions.select().where({ id: sessionId }),
          (rows) => {
            latestSessions = rows as unknown as ReadonlyArray<RunnerSessionRow>;
            sessionsLoaded = true;
            push();
          },
        );
        const unsubscribeTasks = store.subscribe(
          tables.sessionTasks.select().where({ sessionId }),
          (rows) => {
            latestTasks = rows as unknown as ReadonlyArray<RunnerTaskRow>;
            push();
          },
        );
        const unsubscribeFields = store.subscribe(tables.sessionTaskFields.select(), (rows) => {
          latestFields = rows as unknown as ReadonlyArray<RunnerFieldRow>;
          push();
        });
        // initial push will happen via subscribe callbacks
        return [unsubscribeSessions, unsubscribeTasks, unsubscribeFields] as const;
      }),
      (unsubs) => Effect.sync(() => unsubs.forEach((u) => u())),
    ).pipe(
      Effect.asVoid,
      Effect.flatMap(() => Effect.never),
    ),
  );

type HistorySessionRow = {
  readonly id: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type TaskRecordRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: number;
  readonly startedAt: number | Date | null;
  readonly endedAt: number | Date | null;
};
type TaskSectionRow = {
  readonly id: string;
  readonly taskRecordId: string;
  readonly sectionName: string;
  readonly value: string;
  readonly sectionType: string;
  readonly isRequired: number;
  readonly startedAt: number | Date | null;
};

const historyStream: Stream.Stream<Message> = Stream.callback((queue) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const store = await getStore();
      let latestSessions: ReadonlyArray<HistorySessionRow> = [];
      let latestRecords: ReadonlyArray<TaskRecordRow> = [];

      const push = () => {
        const counts = new Map<string, number>();
        for (const r of latestRecords as ReadonlyArray<TaskRecordRow>) {
          counts.set(r.sessionId, (counts.get(r.sessionId) ?? 0) + 1);
        }
        const history = (latestSessions as ReadonlyArray<HistorySessionRow>)
          .filter((s) => s.endedAt !== null && s.endedAt !== undefined)
          .map((s) => {
            const displayName = s.sessionName !== "" ? s.sessionName : s.templateName;
            return {
              id: s.id,
              displayName,
              templateName: s.templateName,
              sessionName: s.sessionName,
              startedAt: toEpoch(s.startedAt),
              endedAt: toEpoch(s.endedAt as number | Date),
              taskCount: counts.get(s.id) ?? 0,
            };
          })
          .sort((a, b) => b.startedAt - a.startedAt);
        Queue.offerUnsafe(queue, Message.GotHistory({ history }));
      };

      const unsubscribeSessions = store.subscribe(tables.sessions.select(), (rows) => {
        latestSessions = rows as unknown as ReadonlyArray<HistorySessionRow>;
        push();
      });
      const unsubscribeRecords = store.subscribe(tables.taskRecords.select(), (rows) => {
        latestRecords = rows as unknown as ReadonlyArray<TaskRecordRow>;
        push();
      });
      return [unsubscribeSessions, unsubscribeRecords] as const;
    }),
    (unsubs) => Effect.sync(() => unsubs.forEach((u) => u())),
  ).pipe(
    Effect.asVoid,
    Effect.flatMap(() => Effect.never),
  ),
);

const historyDetailStream = (sessionId: string): Stream.Stream<Message> =>
  Stream.callback((queue) =>
    Effect.acquireRelease(
      Effect.promise(async () => {
        const store = await getStore();
        let latestSessions: ReadonlyArray<HistorySessionRow> = [];
        let latestRecords: ReadonlyArray<TaskRecordRow> = [];
        let latestSections: ReadonlyArray<TaskSectionRow> = [];
        let sessionsLoaded = false;

        const push = () => {
          if (!sessionsLoaded) return;
          const session =
            (latestSessions as ReadonlyArray<HistorySessionRow>).find((s) => s.id === sessionId) ??
            null;
          if (session === null || session.endedAt === null || session.endedAt === undefined) {
            Queue.offerUnsafe(queue, Message.GotHistoryDetail({ detail: null }));
            return;
          }
          const recordsForSession = (latestRecords as ReadonlyArray<TaskRecordRow>).filter(
            (r) => r.sessionId === sessionId,
          );
          const sectionsByRecord = new Map<string, ReadonlyArray<TaskSectionRow>>();
          for (const sec of latestSections as ReadonlyArray<TaskSectionRow>) {
            const arr = sectionsByRecord.get(sec.taskRecordId) ?? [];
            (sectionsByRecord as Map<string, Array<TaskSectionRow>>).set(sec.taskRecordId, [
              ...(arr as Array<TaskSectionRow>),
              sec,
            ]);
          }
          const tasks = recordsForSession
            .map((r) => {
              const secs = sectionsByRecord.get(r.id) ?? [];
              return {
                id: r.id,
                taskId: Number(r.taskId),
                startedAt:
                  r.startedAt === null || r.startedAt === undefined
                    ? null
                    : toEpoch(r.startedAt as number | Date),
                endedAt:
                  r.endedAt === null || r.endedAt === undefined
                    ? null
                    : toEpoch(r.endedAt as number | Date),
                sections: secs.map((s) => ({
                  sectionName: s.sectionName,
                  value: s.value,
                  sectionType: s.sectionType,
                  isRequired: s.isRequired === 1,
                  startedAt:
                    s.startedAt === null || s.startedAt === undefined
                      ? null
                      : toEpoch(s.startedAt as number | Date),
                })),
              };
            })
            .sort((a, b) => a.taskId - b.taskId);
          Queue.offerUnsafe(
            queue,
            Message.GotHistoryDetail({
              detail: {
                id: session.id,
                sessionName: session.sessionName,
                templateName: session.templateName,
                startedAt: toEpoch(session.startedAt),
                endedAt:
                  session.endedAt === null || session.endedAt === undefined
                    ? null
                    : toEpoch(session.endedAt as number | Date),
                taskCount: tasks.length,
                tasks,
              },
            }),
          );
        };

        const unsubSessions = store.subscribe(
          tables.sessions.select().where({ id: sessionId }),
          (rows) => {
            latestSessions = rows as unknown as ReadonlyArray<HistorySessionRow>;
            sessionsLoaded = true;
            push();
          },
        );
        const unsubRecords = store.subscribe(
          tables.taskRecords.select().where({ sessionId }),
          (rows) => {
            latestRecords = rows as unknown as ReadonlyArray<TaskRecordRow>;
            push();
          },
        );
        const unsubSections = store.subscribe(tables.taskSectionRecords.select(), (rows) => {
          latestSections = rows as unknown as ReadonlyArray<TaskSectionRow>;
          push();
        });
        return [unsubSessions, unsubRecords, unsubSections] as const;
      }),
      (unsubs) => Effect.sync(() => unsubs.forEach((u) => u())),
    ).pipe(
      Effect.asVoid,
      Effect.flatMap(() => Effect.never),
    ),
  );

const tickStream: Stream.Stream<Message> = Stream.tick(Duration.seconds(1)).pipe(
  Stream.map(() => Message.Tick({ now: Date.now() })),
);

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  agentRequest: Port.subscription(agentPorts.inbound.agentRequest, Message.AgentRequest),
  templates: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          templatesStream,
          Effect.sync(() => true),
        ),
    },
  ),
  history: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          historyStream,
          Effect.sync(() => true),
        ),
    },
  ),
  historyDetail: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionDetail" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null
          ? Stream.empty
          : Stream.when(
              historyDetailStream(sessionId),
              Effect.sync(() => true),
            ),
    },
  ),
  templateDetail: entry(
    { templateId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        templateId: model.route._tag === "TemplateEditor" ? model.route.templateId : null,
      }),
      dependenciesToStream: ({ templateId }) =>
        templateId === null
          ? Stream.empty
          : Stream.when(
              templateDetailStream(templateId),
              Effect.sync(() => true),
            ),
    },
  ),
  activeSession: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          activeSessionStream,
          Effect.sync(() => true),
        ),
    },
  ),
  runner: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionRunner" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null
          ? Stream.empty
          : Stream.when(
              runnerStream(sessionId),
              Effect.sync(() => true),
            ),
    },
  ),
  ticker: entry(
    { active: S.Boolean },
    {
      modelToDependencies: (model) => ({
        active: model.route._tag === "SessionRunner" && model.runner !== null,
      }),
      dependenciesToStream: ({ active }) =>
        Stream.when(
          tickStream,
          Effect.sync(() => active),
        ),
    },
  ),
  editorDraftFocus: entry(
    { draftId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({ draftId: model.editor?.draft?.id ?? null }),
      dependenciesToStream: ({ draftId }) => {
        if (draftId === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.sync(() => {
            setTimeout(() => {
              if (typeof document === "undefined") return;
              document.getElementById("question-name")?.focus({ preventScroll: true });
              document.getElementById("question-editor")?.scrollIntoView({ block: "start" });
            }, 0);
          }),
        ).pipe(Stream.drain);
      },
    },
  ),
  focusedSectionScroll: entry(
    { focusedSectionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        focusedSectionId: model.runner?.focusedSectionId ?? null,
      }),
      dependenciesToStream: ({ focusedSectionId }) => {
        if (focusedSectionId === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.sync(() => {
            setTimeout(() => {
              if (typeof document !== "undefined") {
                ["mobile", "tablet"]
                  .map((scope) => document.getElementById(`${scope}-${focusedSectionId}`))
                  .find((element) => element && element.getClientRects().length > 0)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 0);
          }),
        ).pipe(Stream.drain);
      },
    },
  ),
  currentTaskScroll: entry(
    { currentTaskId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        currentTaskId: model.runner?.currentTaskId ?? null,
      }),
      dependenciesToStream: ({ currentTaskId }) => {
        if (currentTaskId === null) return Stream.empty;
        return Stream.fromEffect(
          Effect.sync(() => {
            setTimeout(() => {
              if (typeof document !== "undefined") {
                ["mobile", "tablet"]
                  .map((scope) => document.getElementById(`${scope}-formTop`))
                  .find((element) => element && element.getClientRects().length > 0)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }, 0);
          }),
        ).pipe(Stream.drain);
      },
    },
  ),
}));

// VIEW — app shell: sidebar (md+), routed page, tab bar (phone)

const pageTitle = (route: Route): string => {
  switch (route._tag) {
    case "SettingsTab":
      return "Settings";
    case "StartTab":
      return "Session";
    case "HistoryTab":
      return "History";
    case "TemplatesTab":
      return "Templates";
    case "SessionRunner":
      return "Session";
    case "TemplateEditor":
      return "Template";
    case "SessionDetail":
      return "Session";
  }
};

const pageFor = (model: Model, h: HtmlBuilder<Message>) => {
  if (model.showCreate) return templateEditorPage(model, h);
  switch (model.route._tag) {
    case "SettingsTab":
      return settingsPage(
        model.theme,
        model.style,
        model.font,
        model.accent,
        model.themeSaveFailed,
        model.styleSaveFailed,
        model.fontSaveFailed,
        model.accentSaveFailed,
        h,
        model.accentDraft,
        model.iconLibrary,
        model.iconLibrarySaveFailed,
      );
    case "StartTab":
      return startView(model, h);
    case "TemplatesTab":
      return templatesPage(model, h);
    case "HistoryTab":
      return historyPage(model, h);
    case "SessionRunner":
      return sessionView(model as unknown as Parameters<typeof sessionView>[0], h);
    case "TemplateEditor":
      return templateEditorPage(model as Parameters<typeof templateEditorPage>[0], h);
    case "SessionDetail":
      return sessionDetailPage(model, h);
  }
};

/** Large-title header for the four tab roots; detail screens draw their own nav bar. */
const rootHeader = (model: Model, h: HtmlBuilder<Message>) => {
  if (model.showCreate) return null;
  switch (model.route._tag) {
    case "TemplatesTab":
      return pageHeader(
        {
          title: pageTitle(model.route),
          trailing:
            model.templates.length > 0
              ? button(
                  {
                    size: "icon-lg",
                    className: "size-11 rounded-full",
                    onClick: Message.ClickedNewTemplate(),
                    attributes: [h.AriaLabel("New template")],
                  },
                  icon(h, Plus, "size-5"),
                  h,
                )
              : undefined,
        },
        h,
      );
    case "StartTab":
    case "HistoryTab":
    case "SettingsTab":
      return pageHeader({ title: pageTitle(model.route) }, h);
    case "SessionRunner":
    case "TemplateEditor":
    case "SessionDetail":
      return null;
  }
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const isRunner = model.route._tag === "SessionRunner";
  const hasHistory = model.history.length > 0;
  const header = rootHeader(model, h);
  return {
    title: "optio",
    body: h.div(
      [
        h.Class(
          `app-shell ${isFullScreenRoute(model.route) ? "focus-workspace" : "browse-workspace"} flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground`,
        ),
      ],
      [
        ...(isRunner ? [] : [sidebar(model.route, hasHistory, h)]),
        h.main(
          [
            h.Class(
              `relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain has-[[data-slot=sheet]]:z-40 ${
                isRunner ? "" : "md:pl-[4.5rem] xl:pl-60"
              }`,
            ),
          ],
          [...(header === null ? [] : [header]), pageFor(model, h)],
        ),
        ...(isFullScreenRoute(model.route) || model.showCreate
          ? []
          : [tabBar(model.route, hasHistory, h)]),
      ],
    ),
  } satisfies Document;
};
