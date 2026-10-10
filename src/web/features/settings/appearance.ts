import type { HtmlBuilder } from "foldkit/html";
import { Schema } from "effect";

import { choiceRows, controlRow, groupedList, segmentedControl } from "@/components/app";
import { input } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
import { sheet } from "../../sheets";
import { Message } from "../../../messages";
import {
  HexColour,
  type Accent,
  type ControlSize,
  type IconLibrary,
  type Look,
  type Theme,
} from "../../theme";

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Automatic" },
];

const ICON_LIBRARIES: ReadonlyArray<{ value: IconLibrary; label: string }> = [
  { value: "hugeicons", label: "Hugeicons" },
  { value: "lucide", label: "Lucide" },
];

const LOOKS: ReadonlyArray<{ value: Look; label: string; description: string }> = [
  { value: "blueprint", label: "Blueprint", description: "Grid paper and cobalt ink (default)" },
  { value: "classic", label: "Classic", description: "Neutral and quiet" },
  { value: "studio", label: "Studio", description: "Warm paper, teal, serif titles" },
  { value: "swiss", label: "Swiss", description: "White, ruled lines, signal red" },
  { value: "shopfloor", label: "Shopfloor", description: "Dark navigation, safety amber" },
];

const ACCENTS: ReadonlyArray<{ value: Accent; label: string }> = [
  { value: "default", label: "Default" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "green", label: "Green" },
  { value: "rose", label: "Rose" },
];

/** Look picker: each row previews the look in the current light/dark scheme. */
export const lookRows = (look: Look, h: HtmlBuilder<Message>) =>
  choiceRows(
    {
      label: "Look",
      header: "Look",
      footer: "Changes colours, surfaces and headings. Your layout and data stay the same.",
      choices: LOOKS.map((option) => ({
        label: h.span(
          [h.Class("flex items-center gap-3")],
          [
            h.span(
              [
                h.Class("look-swatch h-8 w-12 shrink-0"),
                h.DataAttribute("look", option.value),
                h.AriaHidden(true),
              ],
              [h.span([])],
            ),
            option.label,
          ],
        ),
        subtitle: option.description,
        selected: look === option.value,
        onSelect: Message.SelectedLook({ look: option.value }),
      })),
    },
    h,
  );

export const themeControl = (theme: Theme, h: HtmlBuilder<Message>) =>
  segmentedControl(
    {
      name: "settings-theme",
      label: "Appearance",
      footer: "Automatic follows your device’s light and dark setting.",
      segments: THEMES.map((option) => ({
        label: option.label,
        selected: theme === option.value,
        onSelect: Message.SelectedTheme({ theme: option.value }),
      })),
    },
    h,
  );

export const iconLibraryControl = (iconLibrary: IconLibrary, h: HtmlBuilder<Message>) =>
  segmentedControl(
    {
      name: "settings-icon-library",
      label: "Icon style",
      footer: "Changes symbols throughout Optio independently of font and component style.",
      segments: ICON_LIBRARIES.map((option) => ({
        label: option.label,
        selected: iconLibrary === option.value,
        onSelect: Message.SelectedIconLibrary({ library: option.value }),
      })),
    },
    h,
  );

export const controlSizeRow = (controlSize: ControlSize, h: HtmlBuilder<Message>) =>
  groupedList(
    { header: "Controls" },
    [
      controlRow(
        [
          switch_(
            {
              id: "settings-larger-controls",
              isChecked: controlSize === "large",
              onToggle: (isChecked) =>
                Message.SelectedControlSize({ controlSize: isChecked ? "large" : "standard" }),
              label: "Larger controls",
              description:
                "Bigger text, answers and main buttons for gloves or a moving vehicle. Answers stack on phones.",
              wrapperClass: "flex-row-reverse justify-between gap-4",
            },
            h,
          ),
        ],
        h,
      ),
    ],
    h,
  );

const accentLabel = (label: string, accent: Accent, h: HtmlBuilder<Message>) =>
  h.span(
    [h.Class("flex items-center gap-3")],
    [
      h.span([
        h.Class("accent-swatch size-5 shrink-0 rounded-full border border-foreground/20"),
        h.DataAttribute("accent", accent),
        h.AriaHidden(true),
        ...(accent.startsWith("#") ? [h.Style({ backgroundColor: accent })] : []),
      ]),
      label,
    ],
  );

export const accentRows = (accent: Accent, h: HtmlBuilder<Message>) =>
  choiceRows(
    {
      label: "Accent colour",
      header: "Accent colour",
      footer:
        "Default uses the look’s own colour. Others replace it on controls and focus indicators.",
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
  );

export const accentPicker = (accentDraft: string | null, h: HtmlBuilder<Message>) =>
  accentDraft === null
    ? []
    : [
        sheet(
          {
            id: "accent-picker",
            title: "Custom accent colour",
            description:
              "Choose a colour or enter its hex code. Changes apply only when confirmed.",
            onDismiss: Message.CanceledAccentPicker(),
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
      ];
