import type { Html, HtmlBuilder } from "foldkit/html";

import { ArrowDown, ArrowUp, icon, rowAction } from "@/components/app";
import { Message } from "../../../messages";

// Explicit, keyboard-accessible reorder controls for questions and choices.
// They stay 44px targets but render muted so the item names dominate the row.

const quietClass =
  "text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground dark:hover:bg-muted/40 disabled:opacity-35";

const moveButton = (
  config: Readonly<{ label: string; onClick: Message; isDisabled: boolean; up: boolean }>,
  h: HtmlBuilder<Message>,
): Html =>
  rowAction(
    {
      isDisabled: config.isDisabled,
      className: quietClass,
      attributes: [h.AriaLabel(config.label)],
      onClick: config.onClick,
    },
    [icon(h, config.up ? ArrowUp : ArrowDown, "size-4")],
    h,
  );

/** Up/down pair; each end of the list disables its outward button. */
export const reorderButtons = (
  config: Readonly<{
    /** Names the moved item in the accessible labels, e.g. "choice Hoist". */
    subject: string;
    index: number;
    total: number;
    isDisabled?: boolean;
    up: Message;
    down: Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const disabled = config.isDisabled ?? false;
  return h.div(
    [h.Class("flex shrink-0 items-stretch")],
    [
      moveButton(
        {
          label: `Move ${config.subject} up`,
          up: true,
          isDisabled: disabled || config.index === 0,
          onClick: config.up,
        },
        h,
      ),
      moveButton(
        {
          label: `Move ${config.subject} down`,
          up: false,
          isDisabled: disabled || config.index === config.total - 1,
          onClick: config.down,
        },
        h,
      ),
    ],
  );
};
