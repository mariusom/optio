// The store's schema and queries, loaded with the store rather than at startup:
// importing them pulls LiveStore into the module graph.
export { events, tables } from "./schema";
export * as queries from "./queries";
