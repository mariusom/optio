import { Effect, Exit, Schema } from "effect";
import type { Runtime } from "foldkit";
import { Model } from "../main";

import {
  type AgentAction,
  type AgentPortReply,
  type AgentResult,
  type agentPorts,
  confirmationTarget,
  requiresConfirmation,
} from "./actions";
import { projectAgentState } from "./state";

export class AgentConnectionError extends Schema.TaggedError<AgentConnectionError>()(
  "AgentConnectionError",
  {
    message: Schema.String,
  },
) {}

export interface AgentApplication {
  readonly request: (
    action: AgentAction | null,
  ) => Effect.Effect<AgentResult, AgentConnectionError>;
}

/** Each request owns its reply subscription; Effect handles interruption and timeout cleanup. */
export const connectAgentApplication = (
  ports: Runtime.PortHandles<typeof agentPorts>,
  confirm: (message: string) => boolean,
): AgentApplication => {
  const requestPort = Effect.fn("agents.requestPort")(
    function* (action: AgentAction | null, confirmationVersion?: number) {
      const requestId = yield* Effect.sync(() => crypto.randomUUID());
      return yield* Effect.callback<AgentPortReply, AgentConnectionError>((resume) => {
        const unsubscribe = ports.agentReply.subscribe((reply) => {
          if (reply.requestId === requestId) resume(Effect.succeed(reply));
        });
        const sent = ports.agentRequest.send({
          requestId,
          action,
          ...(confirmationVersion === undefined ? {} : { confirmationVersion }),
        });
        if (Exit.isFailure(sent)) {
          resume(Effect.fail(new AgentConnectionError({ message: "Invalid app request." })));
        }
        return Effect.sync(unsubscribe);
      });
    },
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () =>
        Effect.fail(
          new AgentConnectionError({
            message:
              "App did not acknowledge the request. Read state before retrying; a dispatched action may have run and is not undone by cancellation.",
          }),
        ),
    }),
  );

  const decodeModel = (reply: AgentPortReply) =>
    Schema.decodeUnknownEffect(Model)(reply.state).pipe(
      Effect.mapError(() => new AgentConnectionError({ message: "Invalid app state." })),
    );

  const request: AgentApplication["request"] = Effect.fn("agents.request")(function* (
    action: AgentAction | null,
  ) {
    let confirmationVersion: number | undefined;
    if (action && requiresConfirmation(action)) {
      const state = yield* decodeModel(yield* requestPort(null));
      const target = confirmationTarget(state, action);
      if (target === null)
        return yield* new AgentConnectionError({ message: "Request confirmation first." });
      confirmationVersion = state.agentConfirmationVersion;
      const approved = yield* Effect.sync(() =>
        confirm(
          `Allow the agent to ${action._tag}: ${target.name} (ID: ${target.id})? This can permanently discard data or end recording. Review the pending confirmation in Optio before allowing.`,
        ),
      );
      if (!approved)
        return yield* new AgentConnectionError({ message: "User declined the action." });
    }
    const reply = yield* requestPort(action, confirmationVersion);
    if (reply.error !== null) return yield* new AgentConnectionError({ message: reply.error });
    const state = yield* decodeModel(reply);
    return { state: projectAgentState(state) };
  });
  return { request };
};
