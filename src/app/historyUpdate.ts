import { Array, Option, String } from "effect";
import {
  DeleteHistorySession,
  ExportSessionCsv,
  RenameHistorySession,
} from "../web/features/history/historyCommands";
import { hrefFor, HistoryTab, SessionDetail } from "../web/routes";
import { NavigateInternal } from "./commands";
import type { MessageHandlers, UpdateResult } from "../messages";
import * as AsyncData from "@/lib/asyncData";
import { historyOf, type Model } from "./model";

type Result = UpdateResult<Model>;
type AllHandlers = MessageHandlers<Result>;

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
  | "FailedHistoryOp"
  | "ClickedHistoryTask"
  | "DismissedHistoryTask"
  | "ClickedExportHistoryCsv"
  | "CsvExported"
  | "FailedCsvExport"
  | "DismissedHistoryError"
>;
export const historyHandlers = (model: Model): HistoryHandlers => ({
  GotHistory: ({ history }) => ({ model: { ...model, history: AsyncData.succeed(history) } }),
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
            ? [NavigateInternal.make({ url: hrefFor(HistoryTab()) })]
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
    commands: [NavigateInternal.make({ url: hrefFor(SessionDetail({ sessionId: id })) })],
  }),
  RequestedHistoryDelete: ({ id, displayName }) => {
    const session = Array.findFirst(historyOf(model), (candidate) => candidate.id === id);
    return {
      model: {
        ...model,
        historyActionsFor: null,
        pendingHistoryDelete: {
          id,
          displayName: Option.match(session, {
            onNone: () => displayName,
            onSome: (found) => found.displayName,
          }),
        },
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
          commands: [DeleteHistorySession.make({ id: model.pendingHistoryDelete.id })],
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
        commands: [NavigateInternal.make({ url: "#/history" })],
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
    const trimmed = String.trim(model.editHistoryNameInput);
    // Allow empty to clear custom name (revert to template)
    return {
      model: { ...model, showEditHistoryName: false },
      commands: [
        RenameHistorySession.make({ id: model.selectedHistorySession.id, sessionName: trimmed }),
      ],
    };
  },
  HistoryNameUpdated: () => ({ model: { ...model, showEditHistoryName: false } }),
  FailedHistoryOp: ({ error }) => ({
    model: { ...model, pendingHistoryDelete: null, historyError: error },
  }),
  ClickedHistoryTask: ({ taskId }) => ({ model: { ...model, selectedHistoryTaskId: taskId } }),
  DismissedHistoryTask: () => ({ model: { ...model, selectedHistoryTaskId: null } }),
  ClickedExportHistoryCsv: ({ sessionId, spreadsheetSafe = false }) => ({
    model: { ...model, historyError: null, historyActionsFor: null },
    commands: [ExportSessionCsv.make({ sessionId, spreadsheetSafe })],
  }),
  CsvExported: () => ({ model }),
  FailedCsvExport: ({ error }) => ({ model: { ...model, historyError: error } }),
  DismissedHistoryError: () => ({ model: { ...model, historyError: null } }),
});
