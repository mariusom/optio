import { Semaphore } from "effect";

/**
 * Store writes take this lock in dispatch order. A command reads the tables and
 * then commits, and a commit applies only once the journal is ready, so
 * without the lock two commands could both decide from the same state (two
 * first templates both becoming the default). It also makes a batch of runner
 * answers commit before the command that follows it, and anything that must
 * happen after pending answers are written (a reload for an update) takes it too.
 */
export const serialized = Semaphore.makeUnsafe(1).withPermits(1);
