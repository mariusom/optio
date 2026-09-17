import {
  DeleteHistorySession,
  ExportSessionCsv,
  RenameHistorySession,
} from "../web/features/history/historyCommands";
import { historyRouter, sessionDetailRouter } from "../web/routes";
import { NavigateInternal } from "./commands";
import type { Update } from "foldkit";
import { Message } from "../messages";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = Parameters<typeof Message.match<Result>>[1];

type HistoryHandlers = Pick<
  AllHandlers,
  | "GotHistory"
  | "GotHistoryDetail"
  | "ClickedHistoryRow"
  | "RequestedHistoryDelete"
  | "OpenedHistoryActions"
  | "ClosedHistoryActions"
  | "CanceledHistoryDelete"
  | "ConfirmedHistoryDelete"
  | "HistoryDeleted"
  | "ClickedEditHistoryName"
  | "ChangedEditHistoryName"
  | "CanceledEditHistoryName"
  | "ConfirmedEditHistoryName"
  | "HistoryNameUpdated"
  | "ClickedHistoryTask"
  | "DismissedHistoryTask"
  | "ClickedExportHistoryCsv"
  | "CsvExported"
  | "FailedCsvExport"
  | "DismissedCsvError"
>;
export const historyHandlers = (model: Model): HistoryHandlers => ({
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
    return {
      model: {
        ...model,
        selectedHistorySession: detail,
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
    const session = model.history.find((candidate) => candidate.id === id);
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
  ClickedExportHistoryCsv: ({ sessionId, spreadsheetSafe = false }) => ({
    model: { ...model, csvError: null, historyActionsFor: null },
    commands: [ExportSessionCsv({ sessionId, spreadsheetSafe })],
  }),
  CsvExported: () => ({ model }),
  FailedCsvExport: ({ error }) => ({ model: { ...model, csvError: error } }),
  DismissedCsvError: () => ({ model: { ...model, csvError: null } }),
});
