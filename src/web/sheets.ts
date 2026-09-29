import type { Html, HtmlBuilder } from "foldkit/html";

import {
  confirmSheet as appConfirmSheet,
  sheet as appSheet,
  type ConfirmConfig,
  type SheetConfig,
} from "@/components/app";
import { Message } from "../messages";

export { sheetAction } from "@/components/app";

type Child = Html | string;

/** App sheet: lifecycle acknowledgements go to the no-op `SettledSheet`. */
export const sheet = (
  config: Omit<SheetConfig<Message>, "onSettled">,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<Message>,
): Html => appSheet({ ...config, onSettled: Message.SettledSheet() }, children, h);

export const confirmSheet = (
  config: Omit<ConfirmConfig<Message>, "onSettled">,
  h: HtmlBuilder<Message>,
): Html => appConfirmSheet({ ...config, onSettled: Message.SettledSheet() }, h);
