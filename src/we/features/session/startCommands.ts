import { Cause, Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { getStore } from "../../../livestore/client";
import { events, tables, FieldDef } from "../../../livestore/schema";
import { fieldRowsToDefs } from "../../fieldRows";

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

      // An explicit template ID is authoritative, including zero-field templates.
      // Name lookup is only for callers without an ID.
      let resolvedFields: ReadonlyArray<FieldDef> = fields;
      let resolvedTemplateId: string | null = templateId;
      let resolvedTemplateName = templateName;

      if (resolvedFields.length === 0) {
        // Resolve by ID when supplied, otherwise by name.
        let fieldRows: Parameters<typeof fieldRowsToDefs>[0] = [] as unknown as Parameters<
          typeof fieldRowsToDefs
        >[0];
        let foundId: string | null = null;
        let foundName = templateName;

        if (templateId !== null) {
          const rows = store.query(
            tables.templateFields.select().where({ templateId }).orderBy("sortOrder", "asc"),
          ) as Parameters<typeof fieldRowsToDefs>[0];
          fieldRows = rows;
          foundId = templateId;
          // Keep the stored template name consistent even when it has no fields.
          const tmpl = store.query(
            tables.templates.select().where({ id: templateId }),
          ) as ReadonlyArray<{
            readonly name: string;
          }>;
          if (tmpl[0] !== undefined) foundName = tmpl[0].name;
        }
        if (templateId === null && templateName !== "") {
          const tmpls = store.query(
            tables.templates.select().where({ name: templateName }),
          ) as ReadonlyArray<{
            readonly id: string;
            readonly name: string;
          }>;
          const byName = tmpls[0];
          if (byName !== undefined) {
            const rows2 = store.query(
              tables.templateFields
                .select()
                .where({ templateId: byName.id })
                .orderBy("sortOrder", "asc"),
            ) as Parameters<typeof fieldRowsToDefs>[0];
            fieldRows = rows2;
            foundId = byName.id;
            foundName = byName.name;
          }
        }
        resolvedFields = fieldRows.length > 0 ? fieldRowsToDefs(fieldRows) : [];
        // If we resolved via name fallback, adjust ids/names
        if (foundId !== null) resolvedTemplateId = foundId;
        resolvedTemplateName = foundName;
      }

      const taskId = crypto.randomUUID();
      store.commit(
        events.sessionStarted({
          id,
          templateId: resolvedTemplateId,
          templateName: resolvedTemplateName,
          sessionName,
        }),
        events.taskSpawned({
          sessionId: id,
          id: taskId,
          orderIndex: 1,
          fields: [...resolvedFields] as FieldDef[],
        }),
      );
      return Message.SessionStarted({ sessionId: id });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedSessionOp({ error: Cause.pretty(cause) })),
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
        Effect.succeed(Message.FailedSessionOp({ error: Cause.pretty(cause) })),
      ),
    ),
});
