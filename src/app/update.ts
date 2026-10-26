import type { AppServices } from "./services";
import type { Update } from "foldkit";
import { Array, Record } from "effect";

import { confirmationChanged, invalidatesAgentConfirmation } from "../agents/actions";
import type { Message } from "../messages";
import { editorFieldHandlers, editorLoadHandlers, editorSaveHandlers } from "./editorUpdate";
import { backupHandlers } from "./backupUpdate";
import { historyHandlers } from "./historyUpdate";
import type { Model } from "./model";
import { sessionHandlers } from "./sessionUpdate";
import { storageHandlers } from "./storageUpdate";
import { agentHandlers, shellHandlers } from "./shellUpdate";
import { templateHandlers } from "./templateUpdate";

type Result = Update.Return<Model, Message, AppServices>;
type Tag = Message["_tag"];
type Handler = (message: Message) => Result;

// Feature handler groups close over the model lazily (they only return object
// literals), so each message builds just the group that owns its tag.
const handlerGroups = [
  (model: Model) => agentHandlers(model, (next, message) => update(next, message)),
  shellHandlers,
  templateHandlers,
  editorLoadHandlers,
  editorFieldHandlers,
  editorSaveHandlers,
  sessionHandlers,
  historyHandlers,
  storageHandlers,
  backupHandlers,
] as const;

type KeysOf<T> = T extends unknown ? keyof T : never;
type CoveredTag = KeysOf<ReturnType<(typeof handlerGroups)[number]>>;
// Compile-time exhaustiveness: every message tag has a handler group.
const everyTagHandled: [Exclude<Tag, CoveredTag>] extends [never] ? true : never = true;
void everyTagHandled;

type HandlerGroup = (model: Model) => Record.ReadonlyRecord<string, Handler>;

const groupByTag = new Map<string, HandlerGroup>(
  Array.flatMap(handlerGroups, (group) => {
    const handlers = group as unknown as HandlerGroup;
    return Array.map(Record.keys(handlers(null as never)), (tag) => [tag, handlers] as const);
  }),
);

const updateInternal = (model: Model, message: Message): Result => {
  const group = groupByTag.get(message._tag);
  if (group === undefined) throw new Error(`Unhandled message: ${message._tag}`);
  return (group(model)[message._tag] as Handler)(message);
};

export const update = (model: Model, message: Message): Result => {
  const result = updateInternal(model, message);
  if (message._tag === "AgentRequest") return result;
  if (
    invalidatesAgentConfirmation(message) ||
    (result.model !== model && confirmationChanged(model, result.model))
  ) {
    return {
      ...result,
      model: { ...result.model, agentConfirmationVersion: model.agentConfirmationVersion + 1 },
    };
  }
  return result;
};
