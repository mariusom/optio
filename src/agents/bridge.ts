import { Context, Effect, Exit, Queue, Schema, Stream } from "effect";

import { AgentPortReply } from "./actions";

const AgentPortRequest = Schema.Struct({
  requestId: Schema.String,
  action: Schema.Unknown,
  confirmationVersion: Schema.optionalKey(Schema.Finite),
});
type AgentPortRequest = typeof AgentPortRequest.Type;

/** What the agent connection holds: send a request, hear replies. */
export interface AgentPortHandles {
  readonly agentRequest: {
    readonly send: (request: unknown) => Exit.Exit<void, Schema.SchemaError>;
  };
  readonly agentReply: {
    readonly subscribe: (listener: (reply: AgentPortReply) => void) => () => void;
  };
}

/**
 * The channel between the agent connection and the app's update loop. The app
 * reads `requests` in a Subscription and answers with `reply` from a Command;
 * outside code holds `handles`. Requests sent before the app subscribes wait.
 */
export interface AgentBridge {
  readonly handles: AgentPortHandles;
  readonly requests: Stream.Stream<AgentPortRequest>;
  readonly reply: (reply: AgentPortReply) => Effect.Effect<void>;
}

export const makeAgentBridge = (): AgentBridge => {
  const pending: Array<AgentPortRequest> = [];
  const readers = new Set<(request: AgentPortRequest) => void>();
  const listeners = new Set<(reply: AgentPortReply) => void>();
  const decode = Schema.decodeUnknownExit(AgentPortRequest);
  return {
    handles: {
      agentRequest: {
        send: (input) =>
          Exit.map(decode(input), (request) => {
            if (readers.size === 0) pending.push(request);
            for (const read of readers) read(request);
          }),
      },
      agentReply: {
        subscribe: (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    },
    requests: Stream.callback<AgentPortRequest>((queue) => {
      const read = (request: AgentPortRequest) => Queue.offerUnsafe(queue, request);
      return Effect.acquireRelease(
        Effect.sync(() => {
          for (const request of pending.splice(0)) read(request);
          readers.add(read);
        }),
        () => Effect.sync(() => readers.delete(read)),
      );
    }),
    reply: (reply) =>
      Effect.sync(() => {
        for (const listener of listeners) listener(reply);
      }),
  };
};

/**
 * The app's bridge: one per document unless a mount provides its own (tests
 * mounting several apps). A Reference adds no requirement to Commands.
 */
export const CurrentAgentBridge = Context.Reference<AgentBridge>("optio/AgentBridge", {
  defaultValue: makeAgentBridge,
});
