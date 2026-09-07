import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";
import { HttpRouter } from "effect/unstable/http";

import { OptioTools, type makeToolHandlers } from "./tools";

/** Embeddable Streamable HTTP handler, not a network listener or an OPFS bridge. */
export const makeMcpHandler = (
  handlers: ReturnType<typeof makeToolHandlers>,
  allowedOrigins: ReadonlyArray<string>,
) =>
  HttpRouter.toWebHandler(
    Layer.mergeAll(
      McpServer.layerHttp({
        name: "Optio",
        version: "0.1.0",
        path: "/mcp",
        protocols: [McpProtocol.v2025_06_18],
        allowedOrigins,
      }),
      McpServer.toolkit(OptioTools).pipe(Layer.provide(handlers)),
    ),
    { disableLogger: true },
  );
