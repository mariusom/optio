import type { HtmlBuilder } from "foldkit/html";

import { choiceRows, groupedList, notice, page, row } from "@/components/app";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import type { Theme } from "../../theme";
import type { FoldcnStyle } from "../../style";

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Automatic" },
];

const STYLES: ReadonlyArray<{ value: FoldcnStyle; label: string }> = [
  { value: "default", label: "Default (Nova)" },
  { value: "nova", label: "Nova" },
  { value: "vega", label: "Vega" },
  { value: "maia", label: "Maia" },
  { value: "lyra", label: "Lyra" },
  { value: "mira", label: "Mira" },
  { value: "luma", label: "Luma" },
  { value: "sera", label: "Sera" },
  { value: "rhea", label: "Rhea" },
];

export const settingsPage = (
  theme: Theme,
  style: FoldcnStyle,
  saveFailed: boolean,
  styleSaveFailed: boolean,
  h: HtmlBuilder<Message>,
) =>
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
      choiceRows(
        {
          label: "Component style",
          header: "Component style",
          footer: "Changes component shape, spacing and typography independently of appearance.",
          choices: STYLES.map((option) => ({
            label: option.label,
            selected: style === option.value,
            onSelect: Message.SelectedStyle({ style: option.value }),
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
            button(
              {
                variant: "link",
                className: "mx-auto",
                onClick: Message.SelectedTheme({ theme }),
              },
              "Try again",
              h,
            ),
          ]
        : []),
      ...(styleSaveFailed
        ? [
            notice(
              { tone: "warning", text: "The component style was applied but couldn’t be saved." },
              h,
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
