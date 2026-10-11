import { Semaphore } from "effect";

/**
 * Runner writes take this lock in dispatch order, so a batch of answers
 * commits before the command that follows it. Anything that must happen after
 * pending answers are written (a reload for an update) takes it too.
 */
export const serialized = Semaphore.makeUnsafe(1).withPermits(1);
