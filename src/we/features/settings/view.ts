import type { HtmlBuilder } from "foldkit/html";

import { choiceRows, groupedList, notice, page, row } from "@/components/app";
import { Message } from "../../../messages";
import type { Theme } from "../../theme";

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Automatic" },
];

export const settingsPage = (theme: Theme, saveFailed: boolean, h: HtmlBuilder<Message>) =>
  page(
    {},
    [
      choiceRows(
        {
          label: "Appearance",
          header: "Appearance",
          footer: "Automatic follows your device’s light and dark setting.",
          choices: THEMES.map((option) => ({
            label: option.label,
            selected: theme === option.value,
            onSelect: Message.SelectedTheme({ theme: option.value }),
          })),
        },
        h,
      ),
      ...(saveFailed
        ? [
            notice(
              {
                tone: "warning",
                text: "Applied for now, but it couldn’t be saved. Free up some space on this device and try again.",
              },
              h,
            ),
            h.button(
              [
                h.Type("button"),
                h.Class("mx-auto min-h-11 px-4 text-[1.0625rem] text-primary active:opacity-60"),
                h.OnClick(Message.SelectedTheme({ theme })),
              ],
              ["Try again"],
            ),
          ]
        : []),
      groupedList(
        {
          header: "Privacy",
          footer: "Optio works without an account or a network connection.",
        },
        [
          row(
            { title: "Stored only on this device", subtitle: "Nothing is uploaded or shared." },
            h,
          ),
        ],
        h,
      ),
    ],
    h,
  );
