import type { Update } from "foldkit";

import { confirmationState, invalidatesAgentConfirmation } from "../agents/actions";
import { Message } from "../messages";
import { editorFieldHandlers, editorLoadHandlers, editorSaveHandlers } from "./editorUpdate";
import { historyHandlers } from "./historyUpdate";
import type { Model } from "./model";
import { sessionHandlers } from "./sessionUpdate";
import { agentHandlers, shellHandlers } from "./shellUpdate";
import { templateHandlers } from "./templateUpdate";

const updateInternal = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    ...agentHandlers(model, update),
    ...shellHandlers(model),
    ...templateHandlers(model),
    ...editorLoadHandlers(model),
    ...editorFieldHandlers(model),
    ...editorSaveHandlers(model),
    ...sessionHandlers(model),
    ...historyHandlers(model),
  });

export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const result = updateInternal(model, message);
  if (message._tag === "AgentRequest") return result;
  if (
    confirmationState(model) !== confirmationState(result.model) ||
    invalidatesAgentConfirmation(message)
  ) {
    return {
      ...result,
      model: { ...result.model, agentConfirmationVersion: model.agentConfirmationVersion + 1 },
    };
  }
  return result;
};
