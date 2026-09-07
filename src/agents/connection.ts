import { Effect, Exit, Schema } from "effect";
import type { Runtime } from "foldkit";
import { Model } from "../main";

import {
  type AgentAction,
  type AgentReply,
  type agentPorts,
  confirmationTarget,
  requiresConfirmation,
} from "./actions";

export class AgentConnectionError extends Schema.TaggedError<AgentConnectionError>()(
  "AgentConnectionError",
  {
    message: Schema.String,
  },
) {}

export interface AgentApplication {
  readonly request: (action: AgentAction | null) => Effect.Effect<AgentReply, AgentConnectionError>;
}

/** Each request owns its reply subscription; Effect handles interruption and timeout cleanup. */
export const connectAgentApplication = (
  ports: Runtime.PortHandles<typeof agentPorts>,
  confirm: (message: string) => boolean,
): AgentApplication => {
  const request: AgentApplication["request"] = Effect.fn("agents.request")(
    function* (action: AgentAction | null) {
      let confirmationVersion: number | undefined;
      if (action && requiresConfirmation(action)) {
        const reply = yield* request(null);
        const state = yield* Schema.decodeUnknownEffect(Model)(reply.state).pipe(
          Effect.mapError(() => new AgentConnectionError({ message: "Invalid app state." })),
        );
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
      const requestId = yield* Effect.sync(() => crypto.randomUUID());
      return yield* Effect.callback<AgentReply, AgentConnectionError>((resume) => {
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
  return { request };
};
