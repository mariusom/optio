import { Result, Schema } from "effect";
import {
  actionError,
  AgentAction,
  confirmationTarget,
  requiresConfirmation,
} from "../agents/actions";
import { hrefFor } from "../web/routes";
import { HexColour, isDarkTheme } from "../web/theme";
import { ReloadForUpdate } from "../web/appUpdate";
import { hasChanges } from "../web/features/templates/editor";
import {
  ApplyColorScheme,
  GeneratePlaceholderName,
  NavigateExternal,
  NavigateInternal,
  CopyTemplatePrompt,
  ReplyToAgent,
  ResetTemplatePromptCopy,
  SaveAccent,
  SaveControlSize,
  SaveFont,
  SaveIconLibrary,
  SaveLook,
  SaveStyle,
  SaveTheme,
} from "./commands";
import type { Update } from "foldkit";
import { toString as urlToString } from "foldkit/url";
import { Message, type MessageHandlers } from "../messages";
import { activeSessionOf, type Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = MessageHandlers<Result>;

type AgentHandlers = Pick<AllHandlers, "AgentRequest">;

const perform = (
  model: Model,
  operation: AgentAction,
  dispatch: (model: Model, message: Message) => Result,
): Result => {
  if (operation._tag === "Navigate") {
    return { model, commands: [NavigateInternal({ url: hrefFor(operation.route) })] };
  }
  const result = dispatch(model, operation);
  if (operation._tag !== "ChangedFieldValue") return result;
  // An assistant sets whole answers, so write them now instead of waiting for
  // the typing pause.
  const flushed = dispatch(result.model, Message.SettledFieldInput());
  return {
    model: flushed.model,
    commands: [...(result.commands ?? []), ...(flushed.commands ?? [])],
  };
};
export const agentHandlers = (
  model: Model,
  dispatch: (model: Model, message: Message) => Result,
): AgentHandlers => ({
  AgentRequest: ({ requestId, action, confirmationVersion }) => {
    const decoded = action === null ? null : Schema.decodeUnknownResult(AgentAction)(action);
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
      operation === null || error !== null ? { model } : perform(model, operation, dispatch);
    const commands = result.commands ?? [];
    return {
      model: result.model,
      commands: [
        ...commands,
        ReplyToAgent({
          reply: {
            requestId,
            state: result.model,
            error,
          },
        }),
      ],
    };
  },
});

type LookMessage =
  | "SelectedLook"
  | "LookSaveFinished"
  | "SelectedControlSize"
  | "ControlSizeSaveFinished";

/** Look and control size: applied by their save commands, like font. */
const lookHandlers = (model: Model): Pick<AllHandlers, LookMessage> => ({
  SelectedLook: ({ look }) => ({ model: { ...model, look }, commands: [SaveLook({ look })] }),
  LookSaveFinished: ({ look, saved }) => ({
    model: look === model.look ? { ...model, lookSaveFailed: !saved } : model,
  }),
  SelectedControlSize: ({ controlSize }) => ({
    model: { ...model, controlSize },
    commands: [SaveControlSize({ controlSize })],
  }),
  ControlSizeSaveFinished: ({ controlSize, saved }) => ({
    model: controlSize === model.controlSize ? { ...model, controlSizeSaveFailed: !saved } : model,
  }),
});

type ShellHandlers = Pick<
  AllHandlers,
  | "SelectedTheme"
  | "ThemeSaveFinished"
  | "ChangedSystemColorScheme"
  | "AppliedColorScheme"
  | "AppUpdateReady"
  | "ClickedApplyUpdate"
  | "SelectedStyle"
  | "StyleSaveFinished"
  | "SelectedFont"
  | "FontSaveFinished"
  | "SelectedIconLibrary"
  | "IconLibrarySaveFinished"
  | "SelectedAccent"
  | "OpenedAccentPicker"
  | "ChangedAccentDraft"
  | "CanceledAccentPicker"
  | "ConfirmedAccentPicker"
  | "AccentSaveFinished"
  | LookMessage
  | "GotRoute"
  | "FailedDetailLoad"
  | "ClickedLink"
  | "Navigated"
  | "CompletedReplyToAgent"
  | "SettledSheet"
  | "SupersededStyleSave"
  | "ClickedCopyTemplatePrompt"
  | "TemplatePromptCopyFinished"
  | "ResetTemplatePromptCopy"
>;
export const shellHandlers = (model: Model): ShellHandlers => ({
  SelectedTheme: ({ theme }) => ({
    model: { ...model, theme },
    commands: [
      ApplyColorScheme({ dark: isDarkTheme(theme, model.systemPrefersDark) }),
      SaveTheme({ theme }),
    ],
  }),
  ChangedSystemColorScheme: ({ prefersDark }) => {
    const next = { ...model, systemPrefersDark: prefersDark };
    // A fixed light or dark choice ignores the system scheme.
    if (model.theme !== "auto") return { model: next };
    return { model: next, commands: [ApplyColorScheme({ dark: prefersDark })] };
  },
  AppliedColorScheme: () => ({ model }),
  AppUpdateReady: () =>
    model.appUpdate === "none" ? { model: { ...model, appUpdate: "ready" } } : { model },
  ClickedApplyUpdate: () =>
    model.appUpdate === "ready"
      ? { model: { ...model, appUpdate: "applying" }, commands: [ReloadForUpdate()] }
      : { model },
  ThemeSaveFinished: ({ theme, saved }) => ({
    model: theme === model.theme ? { ...model, themeSaveFailed: !saved } : model,
  }),
  SelectedStyle: ({ style }) => ({
    model: { ...model, style },
    commands: [SaveStyle({ style })],
  }),
  StyleSaveFinished: ({ style, appliedStyle, saved, loadFailed }) => ({
    model:
      style === model.style
        ? {
            ...model,
            style: appliedStyle,
            styleSaveFailed: !saved && !loadFailed,
            styleLoadFailed: loadFailed,
          }
        : model,
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
    if (!Schema.is(HexColour)(model.accentDraft)) return { model };
    const accent = model.accentDraft.toLowerCase();
    return {
      model: { ...model, accent, accentDraft: null },
      commands: [SaveAccent({ accent })],
    };
  },
  AccentSaveFinished: ({ accent, saved }) => ({
    model: accent === model.accent ? { ...model, accentSaveFailed: !saved } : model,
  }),
  ...lookHandlers(model),
  // ── Routing ────────────────────────────────────────────────────────────
  GotRoute: ({ route }) => {
    let base =
      route._tag === "TemplateEditor"
        ? model.editor !== null && model.editor.id === route.templateId
          ? { ...model, route, templateActionsFor: null }
          : { ...model, route, editor: null, templateActionsFor: null }
        : { ...model, route, editor: null, templateActionsFor: null };
    base = {
      ...base,
      historyActionsFor: null,
      showCreate: false,
      accentDraft: null,
      detailLoadFailed: false,
    };
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
    // Offer a fresh suggested name on entry; preserve any explicitly typed name.
    if (route._tag === "StartTab" && activeSessionOf(base) === null) {
      return { model: base, commands: [GeneratePlaceholderName()] };
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
  FailedDetailLoad: () => ({ model: { ...model, detailLoadFailed: true } }),
  CompletedReplyToAgent: () => ({ model }),
  SettledSheet: () => ({ model }),
  SupersededStyleSave: () => ({ model }),
  ClickedCopyTemplatePrompt: () =>
    model.promptCopyStatus === "copying" || model.promptCopyStatus === "copied"
      ? { model }
      : { model: { ...model, promptCopyStatus: "copying" }, commands: [CopyTemplatePrompt()] },
  TemplatePromptCopyFinished: ({ copied }) => ({
    model: { ...model, promptCopyStatus: copied ? "copied" : "failed" },
    commands: copied ? [ResetTemplatePromptCopy()] : [],
  }),
  ResetTemplatePromptCopy: () => ({ model: { ...model, promptCopyStatus: "idle" } }),
});
