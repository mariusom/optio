import { Clock, Effect, Schema } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { reportFailure } from "../../errors";
import type { AppStore } from "../../../livestore/client";
import { withStore, type StoreAccess } from "../../../livestore/access";
import { FieldDef } from "../../../domain/fields";
import { fieldRowsToDefs } from "../../fieldRows";

type StartTemplate = {
  templateId: string | null;
  templateName: string;
  fields: ReadonlyArray<FieldDef>;
};

const resolveStartTemplate = (
  store: AppStore,
  tables: StoreAccess["tables"],
  template: StartTemplate,
): StartTemplate => {
  if (template.fields.length > 0) return template;
  const { templateId, templateName } = template;
  // An explicit ID is authoritative, including zero-field or missing templates.
  if (templateId !== null) {
    const fieldRows = store.query(
      tables.templateFields.select().where({ templateId }).orderBy("sortOrder", "asc"),
    );
    const found = store.query(tables.templates.select().where({ id: templateId }))[0];
    return {
      templateId,
      templateName: found?.name ?? templateName,
      fields: fieldRowsToDefs(fieldRows),
    };
  }
  if (templateName === "") return template;
  const found = store.query(tables.templates.select().where({ name: templateName }))[0];
  if (found === undefined) return template;
  const fieldRows = store.query(
    tables.templateFields.select().where({ templateId: found.id }).orderBy("sortOrder", "asc"),
  );
  return {
    templateId: found.id,
    templateName: found.name,
    fields: fieldRowsToDefs(fieldRows),
  };
};

const failed = (error: string) => Message.FailedSessionOp({ error });

export const StartSession = Command.define("StartSession", {
  args: {
    id: Schema.String,
    templateId: Schema.Union([Schema.Null, Schema.String]),
    templateName: Schema.String,
    sessionName: Schema.String,
    fields: Schema.Array(FieldDef),
  },
  messages: [Message.SessionStarted, Message.FailedSessionOp],
  execute: ({ id, templateId, templateName, sessionName, fields }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const now = new Date(yield* Clock.currentTimeMillis);
        const activeSession = store.query(tables.sessions.select().where({ endedAt: null }))[0];
        if (activeSession !== undefined) {
          return Message.SessionStarted({ sessionId: activeSession.id });
        }

        const template = resolveStartTemplate(store, tables, { templateId, templateName, fields });
        store.commit(
          events.sessionStarted({
            id,
            templateId: template.templateId,
            templateName: template.templateName,
            sessionName,
            now,
          }),
          events.taskSpawned({
            sessionId: id,
            id: crypto.randomUUID(),
            orderIndex: 1,
            fields: [...template.fields],
          }),
        );
        return Message.SessionStarted({ sessionId: id });
      }),
    ).pipe(reportFailure("start", failed)),
});

export const DiscardLiveSession = Command.define("DiscardLiveSession", {
  args: { sessionId: Schema.String },
  messages: [Message.SessionDiscarded, Message.FailedSessionOp],
  execute: ({ sessionId }) =>
    withStore(({ store, tables, events }) =>
      Effect.sync(() => {
        const session = store.query(tables.sessions.select().where({ id: sessionId }))[0];
        if (session === undefined || session.endedAt !== null) return Message.SessionDiscarded();
        store.commit(
          events.sessionLiveGraphCleared({ sessionId }),
          events.sessionDeleted({ id: sessionId }),
        );
        return Message.SessionDiscarded();
      }),
    ).pipe(reportFailure("delete", failed)),
});
