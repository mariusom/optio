import { Effect, Queue, Schema as S, Stream } from "effect";
import { Command, Navigation, Subscription, Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { toString as urlToString, type Url } from "foldkit/url";

import { Message } from "./messages";
import { getStore } from "./livestore/client";
import { FieldDef, FieldKind, tables } from "./livestore/schema";
import {
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
  hasChanges,
  isDraftValid,
  isTemplateValid,
  makeEmptyDraft,
  moveField,
  renumberFields,
  toggleExclusiveOption,
} from "./we/features/templates/editor";
import { templateEditorPage } from "./we/features/templates/editorView";
import { templatesPage } from "./we/features/templates/view";
import { hasOptions, supportsRequired } from "./we/fields";
import {
  isFullScreenRoute,
  parseRoute,
  RouteSchema,
  templateEditorRouter,
  templatesRouter,
  type Route,
} from "./we/routes";
import { bottomTabBar, emptyState, topBar } from "./we/ui";

// MODEL — shell state + feature slices

export const Model = S.Struct({
  route: RouteSchema,
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
});
export type Model = typeof Model.Type;

const initialModel = (route: Route): Model => ({
  route,
  templates: [],
  showCreate: false,
  newName: "",
  pendingDelete: null,
  lastError: null,
  editor: null,
});

// INIT — first paint parses the URL and seeds sample content if the store is
// empty (Swift seeds on container init; a session can't start without a template)

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

const NavigateExternal = Command.define("NavigateExternal", {
  args: { href: S.String },
  messages: [Message.Navigated],
  execute: ({ href }) => Effect.map(Navigation.load(href), () => Message.Navigated()),
});

// UPDATE — pure state transitions

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    // ── Routing ────────────────────────────────────────────────────────────
    GotRoute: ({ route }) => {
      if (route._tag === "TemplateEditor") {
        if (model.editor !== null && model.editor.id === route.templateId) {
          return { model: { ...model, route } };
        }
        return { model: { ...model, route, editor: null } };
      }
      return { model: { ...model, route, editor: null } };
    },
    ClickedLink: ({ request }) =>
      request._tag === "Internal"
        ? { model, commands: [NavigateInternal({ url: urlToString(request.url) })] }
        : { model, commands: [NavigateExternal({ href: request.href })] },
    Navigated: () => ({ model }),

    // ── Templates ──────────────────────────────────────────────────────────
    GotTemplates: ({ templates }) => ({ model: { ...model, templates } }),
    ClickedNewTemplate: () => ({
      model: { ...model, showCreate: true, newName: "", lastError: null },
    }),
    ChangedNewName: ({ text }) => ({ model: { ...model, newName: text } }),
    ConfirmedCreateTemplate: () =>
      model.newName.trim() === ""
        ? { model }
        : {
            model,
            commands: [CreateTemplate({ id: crypto.randomUUID(), name: model.newName.trim() })],
          },
    TemplateCreated: () => ({ model: { ...model, showCreate: false, newName: "" } }),
    CanceledCreateTemplate: () => ({ model: { ...model, showCreate: false, newName: "" } }),
    ClickedTemplateRow: ({ id }) => ({
      model,
      commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
    }),
    DuplicatedTemplate: ({ id }) => ({
      model,
      commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
    }),
    RequestedDeleteTemplate: ({ id, name }) => ({
      model: { ...model, pendingDelete: { id, name } },
    }),
    CanceledDeleteTemplate: () => ({ model: { ...model, pendingDelete: null } }),
    ConfirmedDeleteTemplate: () =>
      model.pendingDelete === null
        ? { model }
        : {
            model: { ...model, pendingDelete: null },
            commands: [DeleteTemplate({ id: model.pendingDelete.id })],
          },
    ClickedSetDefaultTemplate: ({ id }) => ({ model, commands: [SetDefaultTemplate({ id })] }),
    ClickedDuplicateTemplate: ({ id }) => ({ model, commands: [DuplicateTemplate({ id })] }),
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
        return { model: { ...model, editor: null, lastError: "Template not found." } };
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
      if (model.editor === null) return { model };
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
      const draft = model.editor.draft;
      const isDraftDirty = draft !== null && (draft.name.trim() !== "" || draft.options.length > 0);
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
      if (model.editor === null) return { model };
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
      const nextKind = kind as FieldKind;
      let draft = { ...model.editor.draft, kind: nextKind };
      if (!supportsRequired(nextKind)) draft = { ...draft, isRequired: false };
      if (!hasOptions(nextKind)) {
        draft = { ...draft, options: [], exclusiveOptions: [], newOptionText: "" };
      } else if (draft.options.length === 0 && nextKind === "checkbox") {
        // keep exclusive empty
      }
      if (nextKind === "boolean") {
        const current = draft.defaultValue;
        draft = { ...draft, defaultValue: current === "true" ? "true" : "false" };
      } else if (draft.defaultValue === "true" || draft.defaultValue === "false") {
        // Coming from boolean to text types, clear boolean-style default
        if (nextKind !== "boolean") draft = { ...draft, defaultValue: "" };
      }
      if (nextKind === "checkbox" && draft.exclusiveOptions.length > 0) {
        draft = {
          ...draft,
          exclusiveOptions: draft.exclusiveOptions.filter((option) =>
            draft.options.includes(option),
          ),
        };
      }
      if (nextKind !== "checkbox") draft = { ...draft, exclusiveOptions: [] };
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
      if (model.editor === null) return { model };
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
            fields: [...fields] as unknown as ReadonlyArray<FieldDef>,
          }),
        ],
      };
    },
    ClickedCancelEditTemplate: () => {
      if (model.editor === null) return { model };
      if (!hasChanges(model.editor)) {
        return { model, commands: [NavigateInternal({ url: `#${templatesRouter()}` })] };
      }
      return { model: { ...model, editor: { ...model.editor, pendingDiscard: true } } };
    },
    TemplateSaved: () => {
      if (model.editor === null)
        return { model, commands: [NavigateInternal({ url: `#${templatesRouter()}` })] };
      return {
        model: { ...model, editor: { ...model.editor, isSaving: false } },
        commands: [NavigateInternal({ url: `#${templatesRouter()}` })],
      };
    },
    ShowDiscardConfirm: () => {
      if (model.editor === null) return { model };
      return { model: { ...model, editor: { ...model.editor, pendingDiscard: true } } };
    },
    CanceledDiscard: () => {
      if (model.editor === null) return { model };
      return { model: { ...model, editor: { ...model.editor, pendingDiscard: false } } };
    },
    ConfirmedDiscard: () => {
      if (model.editor === null) return { model };
      const isFieldDiscard =
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
        model: { ...model, editor: { ...model.editor, pendingDiscard: false } },
        commands: [NavigateInternal({ url: `#${templatesRouter()}` })],
      };
    },
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

const safeArray = (json: string): ReadonlyArray<string> => {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

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

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
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
}));

// VIEW — app shell: top bar, routed page, bottom tab bar

const pageTitle = (route: Route): string => {
  switch (route._tag) {
    case "StartTab":
      return "Session";
    case "HistoryTab":
      return "History";
    case "TemplatesTab":
      return "Templates";
    case "SessionRunner":
      return "Session";
    case "TemplateEditor":
      return "Edit Template";
    case "SessionDetail":
      return "Session Details";
  }
};

const pageFor = (model: Model, h: HtmlBuilder<Message>) => {
  switch (model.route._tag) {
    case "StartTab":
      return h.div(
        [h.Class("flex h-full flex-col")],
        [
          h.div(
            [h.Class("flex flex-1 flex-col items-center justify-center px-6 text-center")],
            [
              h.div(
                [
                  h.Class(
                    "flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-serif text-primary shadow-sm",
                  ),
                ],
                ["θ"],
              ),
              h.p([h.Class("mt-4 text-lg font-semibold tracking-tight")], ["optio"]),
              h.p(
                [h.Class("mt-1 max-w-xs text-sm leading-relaxed text-base-content/60")],
                ["Time & motion studies — recorded locally, never leaving your device."],
              ),
            ],
          ),
        ],
      );
    case "TemplatesTab":
      return templatesPage(model, h);
    case "HistoryTab":
      return emptyState(
        {
          icon: "clock",
          title: "No sessions yet",
          message: "Start a session from the Session tab to begin tracking.",
        },
        h,
      );
    case "SessionRunner":
      return comingSoon("Session runner", h);
    case "TemplateEditor":
      return templateEditorPage(model as Parameters<typeof templateEditorPage>[0], h);
    case "SessionDetail":
      return comingSoon("Session details", h);
  }
};

const comingSoon = (label: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("flex h-full items-center justify-center text-sm text-base-content/50")],
    [`${label} — coming soon.`],
  );

const trailingFor = (model: Model, h: HtmlBuilder<Message>) =>
  model.route._tag === "TemplatesTab" && model.templates.length > 0
    ? h.button(
        [
          h.Class(
            "-mr-2 btn btn-ghost btn-sm text-primary font-semibold hover:bg-transparent active:opacity-60",
          ),
          h.AriaLabel("Create new template"),
          h.OnClick(Message.ClickedNewTemplate()),
        ],
        ["+"],
      )
    : null;

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  ({
    title: "optio",
    body: h.div(
      [h.Class("flex h-dvh w-full flex-col overflow-hidden bg-base-200 text-base-content")],
      [
        topBar(pageTitle(model.route), trailingFor(model, h), h),
        h.main(
          [h.Class("relative flex-1 overflow-y-auto overscroll-y-contain")],
          [
            pageFor(model, h),
            ...(isFullScreenRoute(model.route)
              ? []
              : [h.div([h.Class("h-[calc(4rem+env(safe-area-inset-bottom))]")], [])]),
          ],
        ),
        ...(isFullScreenRoute(model.route) ? [] : [bottomTabBar(model.route, h)]),
      ],
    ),
  }) satisfies Document;
