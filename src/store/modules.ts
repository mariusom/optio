// The store's schema and queries, loaded with the store rather than at startup:
// importing them pulls the EventLog runtime into the module graph.
export { events } from "./schema";
export { tables } from "./tables";
export * as queries from "./queries";
