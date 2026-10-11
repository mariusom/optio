import { Duration, Effect, Option, Schedule } from "effect";

import type { StoreAccess } from "../livestore/access";

/** The global event number of a LiveStore head such as "e12" or "e12.3". */
const headNumber = (head: string): number => Number(/^e(\d+)/.exec(head)?.[1] ?? Number.NaN);

/**
 * True once the leader (which writes to disk) has confirmed every event this
 * session had committed when called; false if that takes longer than
 * `timeout`. Commit updates `localHead` synchronously; `upstreamHead` follows
 * the leader. A reload before confirmation loses those events.
 */
export const confirmedOnDisk = (store: StoreAccess["store"], timeout: Duration.Input) => {
  const target = headNumber(store.syncStatus().localHead);
  return Effect.sync(() => headNumber(store.syncStatus().upstreamHead) >= target).pipe(
    Effect.repeat({ until: (confirmed) => confirmed, schedule: Schedule.spaced("100 millis") }),
    Effect.timeoutOption(timeout),
    Effect.map(Option.isSome),
  );
};
