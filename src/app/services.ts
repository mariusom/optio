import type { SecureRandom } from "effect/crypto";
import * as BrowserCrypto from "@effect/platform-browser/BrowserCrypto";

/** Services Commands may require; the runtime provides them as `resources`. */
export type AppServices = SecureRandom.SecureRandom;

/** Provide only the secure randomness needed for record IDs. */
export const appServices = BrowserCrypto.layerSecureRandom;
