import { Result, Schema as S } from "effect";
import {
  actionError,
  AgentAction,
  confirmationTarget,
  requiresConfirmation,
} from "../agents/actions";
import { hrefFor } from "../web/routes";
import { HexColour } from "../web/theme";
import { generateSessionName } from "../web/random-name";
import { hasChanges } from "../web/features/templates/editor";
import {
  NavigateExternal,
  NavigateInternal,
  ReplyToAgent,
  SaveAccent,
  SaveFont,
  SaveIconLibrary,
  SaveStyle,
  SaveTheme,
} from "./commands";
import type { Update } from "foldkit";
import { toString as urlToString } from "foldkit/url";
import { Message } from "../messages";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = Parameters<typeof Message.match<Result>>[1];

type AgentHandlers = Pick<AllHandlers, "AgentRequest">;
export const agentHandlers = (
  model: Model,
  dispatch: (model: Model, message: Message) => Result,
): AgentHandlers => ({
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
          : dispatch(model, operation);
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

type ShellHandlers = Pick<
  AllHandlers,
  | "SelectedTheme"
  | "ThemeSaveFinished"
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
  | "GotRoute"
  | "ClickedLink"
  | "Navigated"
>;
export const shellHandlers = (model: Model): ShellHandlers => ({
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
    // Offer a fresh suggested name on entry; preserve any explicitly typed name.
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
});
