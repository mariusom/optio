import { Schema } from "effect";
import { AsyncData } from "foldkit";
import { FieldDef, FieldKind } from "../domain/fields";
import { RunnerStateSchema } from "../web/features/session/runner";
import { RouteSchema, type Route } from "../web/routes";
import { Accent, ControlSize, defaultLook, Font, IconLibrary, Look, Theme } from "../web/theme";
import { FoldcnStyle } from "../web/style";
import { TemplateSummary } from "../web/types";

// Payload shapes shared by the Model and the Messages that deliver them.

/** The open session shown on the Start tab. */
export const ActiveSessionSummary = Schema.Struct({
  id: Schema.String,
  templateId: Schema.Union([Schema.Null, Schema.String]),
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  completedCount: Schema.Number,
});

/** One archived session in the History list. */
export const HistorySessionSummary = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.Number,
  taskCount: Schema.Number,
});

/** An archived session with its tasks and answers. */
export const HistorySessionDetail = Schema.Struct({
  id: Schema.String,
  sessionName: Schema.String,
  templateName: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.Union([Schema.Null, Schema.Number]),
  taskCount: Schema.Number,
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      taskId: Schema.Number,
      startedAt: Schema.Union([Schema.Null, Schema.Number]),
      endedAt: Schema.Union([Schema.Null, Schema.Number]),
      sections: Schema.Array(
        Schema.Struct({
          sectionName: Schema.String,
          value: Schema.String,
          sectionType: Schema.String,
          isRequired: Schema.Boolean,
          startedAt: Schema.Union([Schema.Null, Schema.Number]),
        }),
      ),
    }),
  ),
});

/** Store-backed lists, each read by its own subscription. */
export const StoreList = Schema.Literals(["templates", "history", "activeSession"]);
export type StoreList = typeof StoreList.Type;

/** A list's subscription failed before its first emission. */
const ReadFailed = Schema.Literal("ReadFailed");

/**
 * Store-backed data that is `Loading` until its subscription first emits, so
 * pages can tell "not read yet" from "empty" and never flash an empty state.
 * A store that cannot open is reported through `storage`; a read that fails
 * becomes `Failure`, so its page offers a retry instead of loading forever.
 */
const fromStore = <A, I>(data: Schema.Codec<A, I>) => AsyncData.Schema(data, ReadFailed).schema;

export const Model = Schema.Struct({
  agentConfirmationVersion: Schema.Number,
  /**
   * New IDs are `idSeed-idCounter`: the seed is random per boot (a startup
   * Flag) and the counter only grows, so update creates unique IDs without
   * calling a random generator itself. See `takeId`.
   */
  idSeed: Schema.String,
  idCounter: Schema.Number,
  route: RouteSchema,
  /**
   * Latest wall-clock time (ms), filled by the runtime boot and the ticker
   * subscription from Effect's Clock. Views and update read time from here,
   * never the clock, so rendering stays a function of the Model.
   */
  now: Schema.Number,
  theme: Theme,
  /** The operating system's scheme, which the "auto" theme follows. */
  systemPrefersDark: Schema.Boolean,
  themeSaveFailed: Schema.Boolean,
  style: FoldcnStyle,
  styleSaveFailed: Schema.Boolean,
  styleLoadFailed: Schema.Boolean,
  font: Font,
  fontSaveFailed: Schema.Boolean,
  iconLibrary: IconLibrary,
  iconLibrarySaveFailed: Schema.Boolean,
  accent: Accent,
  accentSaveFailed: Schema.Boolean,
  accentDraft: Schema.NullOr(Schema.String),
  look: Look,
  lookSaveFailed: Schema.Boolean,
  controlSize: ControlSize,
  controlSizeSaveFailed: Schema.Boolean,
  // Templates tab slice
  templates: fromStore(Schema.Array(TemplateSummary)),
  /**
   * The startup sample-template check has finished (or failed). The templates
   * subscription waits for it, so its first emission is never the empty list
   * from just before the samples are written.
   */
  templatesSeedChecked: Schema.Boolean,
  /** Bumped by "Try again" after a failed list read; restarts the list subscriptions. */
  listReadAttempt: Schema.Number,
  showCreate: Schema.Boolean,
  newName: Schema.String,
  pendingDelete: Schema.Union([
    Schema.Null,
    Schema.Struct({ id: Schema.String, name: Schema.String }),
  ]),
  /** Template whose "⋯" action sheet is open, if any. */
  templateActionsFor: Schema.Union([Schema.Null, Schema.String]),
  lastError: Schema.Union([Schema.Null, Schema.String]),
  editor: Schema.Union([
    Schema.Null,
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      isDefault: Schema.Boolean,
      fields: Schema.Array(FieldDef),
      original: Schema.Struct({
        name: Schema.String,
        isDefault: Schema.Boolean,
        fields: Schema.Array(FieldDef),
      }),
      isSaving: Schema.Boolean,
      showAddField: Schema.Boolean,
      editingFieldId: Schema.Union([Schema.Null, Schema.String]),
      draft: Schema.Union([
        Schema.Null,
        Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          kind: FieldKind,
          isRequired: Schema.Boolean,
          defaultValue: Schema.String,
          sortOrder: Schema.Number,
          options: Schema.Array(Schema.String),
          exclusiveOptions: Schema.Array(Schema.String),
          newOptionText: Schema.String,
        }),
      ]),
      pendingDiscard: Schema.Boolean,
    }),
  ]),
  // Session launcher
  selectedTemplateId: Schema.Union([Schema.Null, Schema.String]),
  sessionNameInput: Schema.String,
  placeholderName: Schema.String,
  activeSession: fromStore(Schema.NullOr(ActiveSessionSummary)),
  pendingDiscardSession: Schema.Boolean,
  // Live session form
  runner: Schema.Union([Schema.Null, RunnerStateSchema]),
  // Archived sessions
  history: fromStore(Schema.Array(HistorySessionSummary)),
  selectedHistorySession: Schema.NullOr(HistorySessionDetail),
  /**
   * The open session detail or template editor could not be read. Without it a
   * null detail means "still opening"; a missing item navigates away instead.
   */
  detailLoadFailed: Schema.Boolean,
  pendingHistoryDelete: Schema.Union([
    Schema.Null,
    Schema.Struct({ id: Schema.String, displayName: Schema.String }),
  ]),
  showEditHistoryName: Schema.Boolean,
  editHistoryNameInput: Schema.String,
  selectedHistoryTaskId: Schema.Union([Schema.Null, Schema.String]),
  historyActionsFor: Schema.Union([Schema.Null, Schema.String]),
  /** Where an internal link wanted to go while the editor had unsaved changes. */
  pendingNavigationUrl: Schema.Union([Schema.Null, Schema.String]),
  /** Failed history delete, rename or export. */
  historyError: Schema.Union([Schema.Null, Schema.String]),
  /** Whether studies persist, live only in memory, or cannot be opened. */
  storage: Schema.Literals(["opening", "persisted", "in-memory", "unavailable"]),
  memoryStorageAcknowledged: Schema.Boolean,
  promptCopyStatus: Schema.Literals(["idle", "copying", "copied", "failed"]),
  /** A new app version has taken control and waits for the user to reload. */
  appUpdate: Schema.Literals(["none", "ready", "applying"]),
});
export type Model = typeof Model.Type;

const initialModel = (route: Route): Model => ({
  agentConfirmationVersion: 0,
  // Replaced by the random startup Flag; tests keep this fixed seed.
  idSeed: "local",
  idCounter: 0,
  route,
  // Placeholder: the runtime boot fills this from Effect's Clock before the
  // first render, and the ticker keeps it fresh after.
  now: 0,
  theme: "auto",
  // The systemColorScheme subscription reports the real value on start.
  systemPrefersDark: false,
  themeSaveFailed: false,
  style: "nova",
  styleSaveFailed: false,
  styleLoadFailed: false,
  font: "sans",
  fontSaveFailed: false,
  iconLibrary: "hugeicons",
  iconLibrarySaveFailed: false,
  accent: "default",
  accentSaveFailed: false,
  accentDraft: null,
  look: defaultLook,
  lookSaveFailed: false,
  controlSize: "standard",
  controlSizeSaveFailed: false,
  templates: AsyncData.Loading(),
  templatesSeedChecked: false,
  listReadAttempt: 0,
  showCreate: false,
  newName: "",
  pendingDelete: null,
  templateActionsFor: null,
  lastError: null,
  editor: null,
  selectedTemplateId: null,
  sessionNameInput: "",
  // Filled by the GeneratePlaceholderName command that init issues.
  placeholderName: "",
  activeSession: AsyncData.Loading(),
  pendingDiscardSession: false,
  runner: null,
  history: AsyncData.Loading(),
  selectedHistorySession: null,
  detailLoadFailed: false,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  historyActionsFor: null,
  pendingNavigationUrl: null,
  historyError: null,
  storage: "opening",
  memoryStorageAcknowledged: false,
  promptCopyStatus: "idle",
  appUpdate: "none",
});

export { initialModel };

/** Returns a new unique ID and the Model that has used it. */
export const takeId = (model: Model): readonly [string, Model] => [
  `${model.idSeed}-${model.idCounter}`,
  { ...model, idCounter: model.idCounter + 1 },
];

type StoreData = Pick<Model, "templates" | "history" | "activeSession">;

// For handlers and agent checks that act on what has been read so far.
// Pages match the AsyncData itself, so loading never renders as empty.

/** Templates read so far; empty while loading. */
export const templatesOf = (model: Pick<StoreData, "templates">) =>
  AsyncData.getOrElse(model.templates, () => []);

/** Archived sessions read so far; empty while loading. */
export const historyOf = (model: Pick<StoreData, "history">) =>
  AsyncData.getOrElse(model.history, () => []);

/** The open session, or null when there is none or it has not been read yet. */
export const activeSessionOf = (model: Pick<StoreData, "activeSession">) =>
  AsyncData.getOrElse(model.activeSession, () => null);
