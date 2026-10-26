import type { Crypto } from "effect";
import * as BrowserCrypto from "@effect/platform-browser/BrowserCrypto";

/** Services Commands may require; the runtime provides them as `resources`. */
export type AppServices = Crypto.Crypto;

/** Web Crypto backs Effect's Crypto service (random IDs). */
export const appServices = BrowserCrypto.layer;
