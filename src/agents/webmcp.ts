import { Context, Effect, ManagedRuntime, Option, Schema, Stream } from "effect";
import { Tool } from "effect/unstable/ai";

import { OptioTools, type makeToolHandlers } from "./tools";

/** Current document API; Promise conversion is confined to this browser boundary. */
export interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: {
        readOnlyHint: boolean;
        untrustedContentHint: boolean;
        consequentialHint: boolean;
      };
      execute(input: unknown, options: { signal: AbortSignal }): Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ): Promise<void>;
}

export class WebMcpError extends Schema.TaggedError<WebMcpError>()("WebMcpError", {
  message: Schema.String,
}) {}

/** Scope owns registration and in-flight calls, including partial-registration rollback. */
export const registerWebMcp = Effect.fn("agents.registerWebMcp")(function* (
  context: ModelContext,
  handlers: ReturnType<typeof makeToolHandlers>,
) {
  const runtime = yield* Effect.acquireRelease(
    Effect.sync(() => ManagedRuntime.make(handlers)),
    (runtime) => Effect.promise(() => runtime.dispose()),
  );
  const registration = yield* Effect.acquireRelease(
    Effect.sync(() => new AbortController()),
    (controller) => Effect.sync(() => controller.abort()),
  );
  for (const tool of Object.values(OptioTools.tools)) {
    const execute = Effect.fn(`agents.webmcp.${tool.name}`)(function* (input: unknown) {
      const parameters = yield* Schema.decodeUnknownEffect(tool.parametersSchema)(input);
      const toolkit = yield* OptioTools;
      const results = yield* toolkit.handle(tool.name, parameters);
      const last = yield* Stream.runLast(results);
      if (Option.isNone(last)) return yield* new WebMcpError({ message: "No tool result." });
      if (last.value.isFailure) return yield* new WebMcpError({ message: "Optio tool failed." });
      return last.value.encodedResult;
    });
    // Native WebMCP discards rejection reasons. Preserve expected, sanitized
    // failures as JSON; interruption and defects must still reject execution.
    const result = (input: unknown) =>
      execute(input).pipe(
        Effect.catchTag("AgentReadError", (error) =>
          Effect.succeed({ isError: true, error: { message: error.message } }),
        ),
        Effect.catchTag("SchemaError", () =>
          Effect.succeed({ isError: true, error: { message: "Invalid tool input." } }),
        ),
      );
    yield* Effect.tryPromise({
      try: () =>
        context.registerTool(
          {
            name: tool.name,
            description: Tool.getDescription(tool)!,
            inputSchema: Tool.getJsonSchema(tool),
            annotations: {
              readOnlyHint: Context.get(tool.annotations, Tool.Readonly),
              untrustedContentHint: true,
              consequentialHint: !Context.get(tool.annotations, Tool.Readonly),
            },
            execute: (input, { signal }) => runtime.runPromise(result(input), { signal }),
          },
          { signal: registration.signal },
        ),
      catch: () => new WebMcpError({ message: `Could not register ${tool.name}.` }),
    });
  }
});
