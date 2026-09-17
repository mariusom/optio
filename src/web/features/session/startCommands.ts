import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { friendlyFailure } from "../../errors";
import { getStore, type AppStore } from "../../../livestore/client";
import { events, tables, FieldDef } from "../../../livestore/schema";
import { fieldRowsToDefs } from "../../fieldRows";

type StartTemplate = {
  templateId: string | null;
  templateName: string;
  fields: ReadonlyArray<FieldDef>;
};

const resolveStartTemplate = (store: AppStore, template: StartTemplate): StartTemplate => {
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

export const StartSession = Command.define("StartSession", {
  args: {
    id: S.String,
    templateId: S.Union([S.Null, S.String]),
    templateName: S.String,
    sessionName: S.String,
    fields: S.Array(FieldDef),
  },
  messages: [Message.SessionStarted, Message.FailedSessionOp],
  execute: ({ id, templateId, templateName, sessionName, fields }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);

      const sessions = store.query(tables.sessions.select()) as ReadonlyArray<{
        readonly id: string;
        readonly endedAt: number | Date | null;
      }>;
      const activeSession = sessions.find(
        (session) => session.endedAt === null || session.endedAt === undefined,
      );
      if (activeSession !== undefined) {
        return Message.SessionStarted({ sessionId: activeSession.id });
      }

      const template = resolveStartTemplate(store, { templateId, templateName, fields });
      const taskId = crypto.randomUUID();
      store.commit(
        events.sessionStarted({
          id,
          templateId: template.templateId,
          templateName: template.templateName,
          sessionName,
          now: new Date(),
        }),
        events.taskSpawned({
          sessionId: id,
          id: taskId,
          orderIndex: 1,
          fields: [...template.fields],
        }),
      );
      return Message.SessionStarted({ sessionId: id });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedSessionOp({ error: friendlyFailure("start", cause) })),
      ),
    ),
});

export const DiscardLiveSession = Command.define("DiscardLiveSession", {
  args: { sessionId: S.String },
  messages: [Message.SessionDiscarded, Message.FailedSessionOp],
  execute: ({ sessionId }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);

      const sessionRows = store.query(
        tables.sessions.select().where({ id: sessionId }),
      ) as ReadonlyArray<{ endedAt: Date | number | null }>;
      const session = sessionRows[0];
      if (session === undefined || (session.endedAt !== null && session.endedAt !== undefined)) {
        return Message.SessionDiscarded();
      }

      store.commit(
        events.sessionLiveGraphCleared({ sessionId }),
        events.sessionDeleted({ id: sessionId }),
      );
      return Message.SessionDiscarded();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedSessionOp({ error: friendlyFailure("delete", cause) })),
      ),
    ),
});
