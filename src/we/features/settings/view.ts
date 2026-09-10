import type { HtmlBuilder } from "foldkit/html";
import { Schema } from "effect";

import { choiceRows, groupedList, notice, page, row, sheet } from "@/components/app";
import { button } from "@/components/ui/button";
import { input } from "@/components/ui/input";
import { Message } from "../../../messages";
import { HexColour, type Accent, type Font, type IconLibrary, type Theme } from "../../theme";
import type { FoldcnStyle } from "../../style";

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Automatic" },
];

const STYLES: ReadonlyArray<{ value: FoldcnStyle; label: string }> = [
  { value: "nova", label: "Nova" },
  { value: "vega", label: "Vega" },
  { value: "maia", label: "Maia" },
  { value: "lyra", label: "Lyra" },
  { value: "mira", label: "Mira" },
  { value: "luma", label: "Luma" },
  { value: "sera", label: "Sera" },
  { value: "rhea", label: "Rhea" },
];

const FONTS: ReadonlyArray<{ value: Font; label: string }> = [
  { value: "sans", label: "System sans" },
  { value: "serif", label: "System serif" },
  { value: "mono", label: "System mono" },
];

const ICON_LIBRARIES: ReadonlyArray<{ value: IconLibrary; label: string }> = [
  { value: "hugeicons", label: "Hugeicons" },
  { value: "lucide", label: "Lucide" },
];

const ACCENTS: ReadonlyArray<{ value: Accent; label: string }> = [
  { value: "default", label: "Default" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "green", label: "Green" },
  { value: "rose", label: "Rose" },
];

const accentLabel = (label: string, accent: Accent, h: HtmlBuilder<Message>) =>
  h.span(
    [h.Class("flex items-center gap-3")],
    [
      h.span(
        [
          h.Class("accent-swatch size-5 shrink-0 rounded-full border border-foreground/20"),
          h.DataAttribute("accent", accent),
          h.AriaHidden(true),
          ...(accent.startsWith("#") ? [h.Style({ backgroundColor: accent })] : []),
        ],
        [],
      ),
      label,
    ],
  );

export const settingsPage = (
  theme: Theme,
  style: FoldcnStyle,
  font: Font,
  accent: Accent,
  saveFailed: boolean,
  styleSaveFailed: boolean,
  fontSaveFailed: boolean,
  accentSaveFailed: boolean,
  h: HtmlBuilder<Message>,
  accentDraft: string | null = null,
  iconLibrary: IconLibrary = "hugeicons",
  iconLibrarySaveFailed = false,
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
          label: "Icon style",
          header: "Icon style",
          footer: "Changes symbols throughout Optio independently of font and component style.",
          choices: ICON_LIBRARIES.map((option) => ({
            label: option.label,
            selected: iconLibrary === option.value,
            onSelect: Message.SelectedIconLibrary({ library: option.value }),
          })),
        },
        h,
      ),
      choiceRows(
        {
          label: "Font",
          header: "Font",
          footer: "Uses fonts already available on your device.",
          choices: FONTS.map((option) => ({
            label: option.label,
            selected: font === option.value,
            onSelect: Message.SelectedFont({ font: option.value }),
          })),
        },
        h,
      ),
      choiceRows(
        {
          label: "Accent colour",
          header: "Accent colour",
          footer: "Changes controls and focus indicators independently of appearance and style.",
          choices: [
            ...ACCENTS.map((option) => ({
              label: accentLabel(option.label, option.value, h),
              selected: accent === option.value,
              onSelect: Message.SelectedAccent({ accent: option.value }),
            })),
            {
              label: accentLabel("Other…", accent.startsWith("#") ? accent : "default", h),
              subtitle: accent.startsWith("#") ? accent.toUpperCase() : "Choose a custom colour",
              selected: accent.startsWith("#"),
              onSelect: Message.OpenedAccentPicker(),
            },
          ],
        },
        h,
      ),
      ...(accentDraft === null
        ? []
        : [
            sheet(
              {
                id: "accent-picker",
                title: "Custom accent colour",
                description:
                  "Choose a colour or enter its hex code. Changes apply only when confirmed.",
                onDismiss: Message.CanceledAccentPicker(),
                dismissLabel: "Cancel custom colour",
                footer: {
                  cancel: { label: "Cancel", onClick: Message.CanceledAccentPicker() },
                  confirm: {
                    label: "Use colour",
                    onClick: Message.ConfirmedAccentPicker(),
                    isDisabled: !Schema.is(HexColour)(accentDraft),
                  },
                },
              },
              [
                h.div(
                  [h.Class("flex flex-col gap-4")],
                  [
                    input(
                      {
                        id: "accent-colour",
                        label: "Colour",
                        type: "color",
                        value: Schema.is(HexColour)(accentDraft) ? accentDraft : "#2563eb",
                        onInput: (colour) => Message.ChangedAccentDraft({ colour }),
                        className: "h-16 p-1 cursor-pointer",
                      },
                      h,
                    ),
                    input(
                      {
                        id: "accent-hex",
                        label: "Hex colour",
                        value: accentDraft,
                        placeholder: "#2563eb",
                        isInvalid: !Schema.is(HexColour)(accentDraft),
                        description: "Six hexadecimal digits, for example #2563eb.",
                        onInput: (colour) => Message.ChangedAccentDraft({ colour }),
                      },
                      h,
                    ),
                  ],
                ),
              ],
              h,
            ),
          ]),
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
      ...(fontSaveFailed
        ? [notice({ tone: "warning", text: "The font was applied but couldn’t be saved." }, h)]
        : []),
      ...(iconLibrarySaveFailed
        ? [
            notice(
              { tone: "warning", text: "The icon style was applied but couldn’t be saved." },
              h,
            ),
          ]
        : []),
      ...(accentSaveFailed
        ? [
            notice(
              { tone: "warning", text: "The accent colour was applied but couldn’t be saved." },
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
