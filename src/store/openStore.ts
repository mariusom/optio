import { Array, Context, Effect, Equal, Layer, Redacted, Schema, Scope } from "effect";
import { EventJournal, EventLog } from "effect/eventlog";

import { materialize } from "./materialize";
import { storageResetKey } from "./resetFlag";
import { StoreEvents, eventNames, schema, type StoreEvent } from "./schema";
import { emptyState, type Query, type StoreState } from "./tables";

export type StorageMode = "persisted" | "in-memory";

/** The open store: synchronous reads of the tables, journaled writes. */
interface AppStore {
  readonly storageMode: StorageMode;
  readonly query: <A>(query: Query<A>) => A;
  /** Appends the events to the journal and applies them, in order, as one write. */
  readonly commit: (
    ...events: ReadonlyArray<StoreEvent>
  ) => Effect.Effect<void, EventJournal.EventJournalError>;
  /** Calls `onChange` with the result now and whenever a write changes it. */
  readonly subscribe: <A>(query: Query<A>, onChange: (result: A) => void) => () => void;
  /** The number of writes still being saved. */
  readonly syncStatus: () => { readonly pendingCount: number };
  /** Calls `onChange` with the number of writes still being saved, now and on change. */
  readonly subscribeSyncStatus: (
    onChange: (status: { readonly pendingCount: number }) => void,
  ) => () => void;
}

const database = "optio";

// The log never syncs, so its identity only labels this browser's entries.
const localIdentity = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.of({ publicKey: "optio-local", privateKey: Redacted.make(new Uint8Array(32)) }),
);

type LooseHandlers = {
  readonly handle: (
    name: string,
    handler: (options: { readonly payload: unknown }) => Effect.Effect<void>,
  ) => LooseHandlers;
};

const applyTo =
  (state: StoreState, name: StoreEvent["name"]) =>
  ({ payload }: { readonly payload: unknown }) =>
    Effect.sync(() => materialize(state, { name, args: payload } as StoreEvent));

/** Every event's handler applies it to `state`. */
const handlersFor = (state: StoreState) =>
  EventLog.group(
    StoreEvents,
    (handlers) =>
      Array.reduce(eventNames, handlers as unknown as LooseHandlers, (registered, name) =>
        registered.handle(name, applyTo(state, name)),
      ) as never,
  );

type PayloadCodec = Schema.Codec<unknown, Uint8Array>;
const payloadCodecs = StoreEvents.events as unknown as Readonly<
  Record<string, { readonly payloadSchemaBinary: PayloadCodec } | undefined>
>;

/** Rebuilds the tables from the journal, oldest entry first. */
const replay = (log: EventLog.EventLog["Service"], state: StoreState) =>
  Effect.gen(function* () {
    const entries = yield* log.entries;
    for (const entry of entries) {
      const codec = payloadCodecs[entry.event];
      // An event this version doesn't know (from a newer version) is skipped.
      if (codec === undefined) continue;
      const args = yield* Schema.decodeEffect(codec.payloadSchemaBinary)(entry.payload);
      materialize(state, { name: entry.event, args } as StoreEvent);
    }
  });

/** A store over `journal`, open until the scope closes. */
export const makeStore = (
  journal: Layer.Layer<EventJournal.EventJournal, EventJournal.EventJournalError>,
  storageMode: StorageMode,
) =>
  Effect.gen(function* () {
    const state = emptyState();
    const context = yield* Layer.build(
      EventLog.layer(schema, handlersFor(state)).pipe(Layer.provide([journal, localIdentity])),
    );
    const log = Context.get(context, EventLog.EventLog);
    yield* replay(log, state);

    const changeListeners = new Set<() => void>();
    const notifyChange = Effect.sync(() => {
      for (const listener of changeListeners) listener();
    });
    const syncListeners = new Set<(status: { readonly pendingCount: number }) => void>();
    let pendingCount = 0;
    const addPending = (delta: number) =>
      Effect.sync(() => {
        pendingCount += delta;
        for (const listener of syncListeners) listener({ pendingCount });
      });

    const write = (events: Array.NonEmptyReadonlyArray<StoreEvent>) =>
      log.writeMany({
        schema,
        events: Array.map(events, ({ name, args }) => ({ event: name, payload: args })) as never,
      });

    const store: AppStore = {
      storageMode,
      query: (query) => query.run(state),
      commit: (...events) =>
        Array.isReadonlyArrayNonEmpty(events)
          ? Effect.acquireUseRelease(
              addPending(1),
              () => write(events),
              () => addPending(-1),
            ).pipe(Effect.asVoid, Effect.ensuring(notifyChange))
          : Effect.void,
      subscribe: (query, onChange) => {
        let last = query.run(state);
        onChange(last);
        const listener = () => {
          const next = query.run(state);
          if (Equal.equals(next, last)) return;
          last = next;
          onChange(next);
        };
        changeListeners.add(listener);
        return () => changeListeners.delete(listener);
      },
      syncStatus: () => ({ pendingCount }),
      subscribeSyncStatus: (onChange) => {
        onChange({ pendingCount });
        syncListeners.add(onChange);
        return () => syncListeners.delete(onChange);
      },
    };
    return store;
  });

let tabLockHeld = false;

/**
 * Only one tab opens the store: its journal is not shared live between tabs,
 * so a second tab would show and act on stale data. The lock is held until
 * the tab closes.
 */
const takeTabLock = Effect.callback<boolean>((resume) => {
  if (tabLockHeld || typeof navigator === "undefined" || navigator.locks === undefined) {
    resume(Effect.succeed(true));
    return;
  }
  void navigator.locks.request("optio-store", { ifAvailable: true }, (lock) => {
    tabLockHeld = lock !== null;
    resume(Effect.succeed(tabLockHeld));
    return tabLockHeld ? Effect.runPromise(Effect.never) : undefined;
  });
});

const flag = (read: (storage: Storage) => boolean | void) =>
  Effect.try({ try: () => read(localStorage) === true, catch: () => false }).pipe(
    Effect.orElseSucceed(() => false),
  );

/** Erases the journal: the way out of storage the user chose to reset in Settings. */
const deleteJournal = Effect.callback<void>((resume) => {
  const request = indexedDB.deleteDatabase(database);
  request.addEventListener("success", () => resume(Effect.void));
  request.addEventListener("error", () => resume(Effect.void));
  request.addEventListener("blocked", () => resume(Effect.void));
});

// Best effort: ask the browser not to evict studies under storage pressure.
// Browsers may decline or prompt; the app works either way.
const requestPersistentStorage = Effect.tryPromise({
  try: () => navigator.storage.persist(),
  catch: () => "PersistRefused" as const,
}).pipe(Effect.ignore);

/**
 * The IndexedDB journal, or `null` where the browser refuses IndexedDB (some
 * private windows and blocked-storage settings).
 */
const openJournal = Effect.gen(function* () {
  const reset = yield* flag((storage) => storage.getItem(storageResetKey) === "1");
  if (reset) {
    yield* deleteJournal;
    yield* flag((storage) => storage.removeItem(storageResetKey));
  }
  const journal = yield* Layer.build(EventJournal.layerIndexedDb({ database }));
  return Layer.succeedContext(journal);
}).pipe(Effect.catchCause(() => Effect.succeed(null)));

/** A store on IndexedDB when the browser allows it, otherwise in memory. */
const openPersisted = Effect.gen(function* () {
  const journal = yield* openJournal;
  if (journal === null) return yield* makeStore(EventJournal.layerMemory, "in-memory");
  const store = yield* makeStore(journal, "persisted");
  yield* requestPersistentStorage;
  return store;
}).pipe(
  // Exposed for debugging and the end-to-end journeys, as a store library would.
  Effect.tap((store) =>
    Effect.sync(() => {
      Object.assign(globalThis, { __debugOptioStore: store });
    }),
  ),
);

/** Promise boundary: the store client caches and retries this promise. */
export const openStore = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (!(yield* takeTabLock))
        return yield* Effect.die(new Error("Optio is open in another tab."));
      return yield* openPersisted;
    }).pipe(Scope.provide(Scope.makeUnsafe())),
  );
