import type { H, Ui } from "@/lib/view";

import {
  confirmSheet as appConfirmSheet,
  sheet as appSheet,
  type ConfirmConfig,
  type SheetConfig,
} from "@/components/app";
import type { Message } from "../messages";

export { sheetAction } from "@/components/app";

type Child = Ui | string;

/** App sheet, typed to the app's messages. */
export const sheet = (
  config: SheetConfig<Message>,
  children: ReadonlyArray<Child>,
  h: H<Message>,
): Ui => appSheet(config, children, h);

export const confirmSheet = (config: ConfirmConfig<Message>, h: H<Message>): Ui =>
  appConfirmSheet(config, h);
