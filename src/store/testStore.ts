import { EventJournal } from "effect/eventlog";
import { Effect, Scope } from "effect";

import type { AppStore } from "./client";
import { makeStore } from "./openStore";
import type { StoreEvent } from "./schema";

/** An empty store that keeps nothing on disk, for tests. */
export const openMemoryStore = () =>
  Effect.runPromise(
    makeStore(EventJournal.layerMemory, "in-memory").pipe(Scope.provide(Scope.makeUnsafe())),
  );

/** Commits events and resolves once they are applied. */
export const commitNow = (store: AppStore, ...events: ReadonlyArray<StoreEvent>) =>
  Effect.runPromise(store.commit(...events));
