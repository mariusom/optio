import { describe, expect, it, vi } from "vitest";
import { Effect, Exit, Scope } from "effect";

import type { AppStore } from "../livestore/client";
import { makeToolHandlers } from "./tools";
import { makeMcpHandler } from "./mcp";
import { registerWebMcp as registration, type ModelContext } from "./webmcp";

type WebTool = Parameters<ModelContext["registerTool"]>[0];

// Model native error delivery: rejected callbacks lose their reason, whereas
// fulfilled JSON results reach the caller intact.
const executeNative = async (
  tool: WebTool,
  input: unknown,
  signal = new AbortController().signal,
) => {
  try {
    return await tool.execute(input, { signal });
  } catch {
    throw new DOMException("Tool execution failed", "UnknownError");
  }
};

const registerWebMcp = async (
  context: ModelContext,
  handlers: ReturnType<typeof makeToolHandlers>,
) => {
  const scope = await Effect.runPromise(Scope.make());
  const close = () => Effect.runPromise(Scope.close(scope, Exit.void));
  try {
    await Effect.runPromise(
      registration(context, handlers).pipe(Effect.provideService(Scope.Scope, scope)),
    );
    return close;
  } catch (error) {
    await close();
    throw error;
  }
};

const archived = {
  id: "archive",
  sessionName: "Study",
  templateName: "Work",
  startedAt: new Date(1000),
  endedAt: new Date(6000),
};

const fixture = () => {
  const query = vi.fn((builder: { toString(): string }) => {
    const sql = builder.toString();
    if (sql.includes("'templates'"))
      return [
        { id: "b", name: "Zebra", isDefault: 0 },
        { id: "a", name: "Alpha", isDefault: 1 },
      ];
    if (sql.includes("'taskRecords'")) return [{ sessionId: "archive" }, { sessionId: "archive" }];
    if (sql.includes("'sessions'")) return [archived, { ...archived, id: "live", endedAt: null }];
    throw new Error(`Unexpected query: ${sql}`);
  });
  const open = vi.fn(async () => ({ query }) as unknown as Pick<AppStore, "query">);
  return { query, open, handlers: makeToolHandlers(open) };
};

const registry = () => {
  const tools = new Map<string, WebTool>();
  const context: ModelContext = {
    registerTool: async (tool, { signal }) => {
      tools.set(tool.name, tool);
      signal.addEventListener("abort", () => tools.delete(tool.name), { once: true });
    },
  };
  return { tools, context };
};

describe("WebMCP tools", () => {
  it("registers lazily, validates inputs, reads metadata and cleans up", async () => {
    const { handlers, open } = fixture();
    const { tools, context } = registry();
    const dispose = await registerWebMcp(context, handlers);
    try {
      expect(open).not.toHaveBeenCalled();
      expect(tools.size).toBe(5);
      const options = { signal: new AbortController().signal };
      const list = tools.get("optio_list_templates")!;
      expect(list.annotations.readOnlyHint).toBe(true);
      expect(tools.get("optio_action")!.annotations).toMatchObject({
        readOnlyHint: false,
        consequentialHint: true,
      });
      await expect(executeNative(list, { limit: 101 })).resolves.toEqual({
        isError: true,
        error: { message: "Invalid tool input." },
      });
      expect(open).not.toHaveBeenCalled();
      expect(await list.execute({ limit: 1 }, options)).toEqual({
        templates: [{ id: "a", name: "Alpha", isDefault: true }],
        total: 2,
      });
      expect(
        await tools.get("optio_get_session_summary")!.execute({ sessionId: "archive" }, options),
      ).toEqual({
        id: "archive",
        sessionName: "Study",
        templateName: "Work",
        startedAt: 1000,
        endedAt: 6000,
        durationMs: 5000,
        taskCount: 2,
      });
      expect(await tools.get("optio_list_sessions")!.execute({}, options)).toMatchObject({
        total: 1,
      });
      for (const sessionId of ["live", "missing"]) {
        await expect(
          executeNative(tools.get("optio_get_session_summary")!, { sessionId }),
        ).resolves.toEqual({ isError: true, error: { message: "Archived session not found." } });
      }
    } finally {
      await dispose();
    }
    expect(tools.size).toBe(0);
  });

  it("rolls back partial registration", async () => {
    const { tools, context } = registry();
    const register = context.registerTool;
    context.registerTool = async (tool, options) => {
      if (tools.size === 1) throw new Error("Registration blocked");
      await register(tool, options);
    };
    await expect(registerWebMcp(context, fixture().handlers)).rejects.toThrow("Could not register");
    expect(tools.size).toBe(0);
  });

  it("interrupts in-flight app calls when the registration scope closes", async () => {
    const { tools, context } = registry();
    const request = vi.fn(() => Effect.never);
    const dispose = await registerWebMcp(context, makeToolHandlers(fixture().open, { request }));
    const result = tools
      .get("optio_get_state")!
      .execute({}, { signal: new AbortController().signal });
    const interrupted = expect(result).rejects.toBeDefined();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await dispose();
    await interrupted;
    expect(tools.size).toBe(0);
  });

  it("honours aborts and does not expose database error details", async () => {
    const { tools, context } = registry();
    const open = vi.fn(async (): Promise<Pick<AppStore, "query">> => {
      throw new Error("secret database path");
    });
    const dispose = await registerWebMcp(context, makeToolHandlers(open));
    try {
      const tool = tools.get("optio_list_templates")!;
      const aborted = AbortSignal.abort();
      await expect(tool.execute({}, { signal: aborted })).rejects.toBeDefined();
      expect(open).not.toHaveBeenCalled();
      await expect(executeNative(tool, {})).resolves.toEqual({
        isError: true,
        error: { message: "Local study data is unavailable." },
      });
    } finally {
      await dispose();
    }
  });
});

describe("MCP Streamable HTTP", () => {
  it("initializes, lists and calls shared tools; rejects invalid inputs and origins", async () => {
    const { handlers, open } = fixture();
    const { handler, dispose } = makeMcpHandler(handlers, ["https://optio.test"]);
    let sessionId: string | null = null;
    let id = 0;
    const request = async (method: string, params: object, origin = "https://optio.test") => {
      const response = await handler(
        new Request("https://optio.test/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            origin,
            "mcp-protocol-version": "2025-06-18",
            ...(sessionId ? { "mcp-session-id": sessionId } : {}),
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        }),
      );
      sessionId = response.headers.get("mcp-session-id") ?? sessionId;
      return response;
    };
    const body = async (response: Response) => {
      expect(response.status).toBe(200);
      const text = await response.text();
      const data =
        text.startsWith("event:") || text.startsWith("data:")
          ? text
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5))
              .join("\n")
          : text;
      return JSON.parse(data);
    };
    try {
      const initialized = await body(
        await request("initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        }),
      );
      expect(initialized.result.serverInfo.name).toBe("Optio");
      expect(sessionId).toBeTruthy();
      const listed = await body(await request("tools/list", {}));
      expect(listed.result.tools).toHaveLength(5);
      expect(
        listed.result.tools.filter(
          (tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint,
        ),
      ).toHaveLength(4);
      expect(open).not.toHaveBeenCalled();
      const result = await body(
        await request("tools/call", { name: "optio_list_templates", arguments: { limit: 1 } }),
      );
      expect(result.result.structuredContent).toEqual({
        templates: [{ id: "a", name: "Alpha", isDefault: true }],
        total: 2,
      });
      const invalid = await body(
        await request("tools/call", { name: "optio_list_templates", arguments: { limit: -1 } }),
      );
      expect(invalid.result?.isError || invalid.error).toBeTruthy();
      const missing = await body(
        await request("tools/call", {
          name: "optio_get_session_summary",
          arguments: { sessionId: "live" },
        }),
      );
      expect(missing.result.isError).toBe(true);
      expect((await request("tools/list", {}, "https://evil.test")).status).toBe(403);
    } finally {
      await dispose();
    }
  });
});
