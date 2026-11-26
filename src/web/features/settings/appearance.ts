import type { H } from "@/lib/view";
import { Array, pipe, Schema, String } from "effect";

import { choiceRows, controlRow, groupedList, segmentedControl, sheet } from "@/components/app";
import { cn } from "@/lib/utils";
import { input } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
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
  { value: "swiss", label: "Swiss", description: "White, hairlines, ink blue (default)" },
  { value: "classic", label: "Classic", description: "Neutral and quiet" },
  { value: "studio", label: "Studio", description: "Warm paper, teal, serif titles" },
  { value: "blueprint", label: "Blueprint", description: "Grid paper and cobalt ink" },
  { value: "shopfloor", label: "Shopfloor", description: "Dark navigation, safety amber" },
];

const ACCENTS: ReadonlyArray<{ value: Accent; label: string }> = [
  { value: "default", label: "Default" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "green", label: "Green" },
  { value: "rose", label: "Rose" },
];

const swatch = (look: Look, h: H<Message>, className: string) =>
  h.span
    .class(cn("look-swatch shrink-0", className))
    .attr("data-look", look)
    .attr("aria-hidden", "true")
    .children(h.span);

/** Look picker: each row previews the look in the current light/dark scheme. */
export const lookRows = (look: Look, h: H<Message>) =>
  choiceRows(
    {
      label: "Look",
      header: "Look",
      footer: "Changes colours, surfaces and headings. Your layout and data stay the same.",
      choices: Array.map(LOOKS, (option) => ({
        label: h.span
          .class("flex items-center gap-3")
          .children(swatch(option.value, h, "h-8 w-12"), option.label),
        subtitle: option.description,
        selected: look === option.value,
        onSelect: Message.SelectedLook({ look: option.value }),
      })),
    },
    h,
  );

export const themeControl = (theme: Theme, h: H<Message>) =>
  segmentedControl(
    {
      name: "settings-theme",
      label: "Appearance",
      footer: "Automatic follows your device’s light and dark setting.",
      segments: Array.map(THEMES, (option) => ({
        label: option.label,
        selected: theme === option.value,
        onSelect: Message.SelectedTheme({ theme: option.value }),
      })),
    },
    h,
  );

export const iconLibraryControl = (iconLibrary: IconLibrary, h: H<Message>) =>
  segmentedControl(
    {
      name: "settings-icon-library",
      label: "Icon style",
      footer: "Changes symbols throughout Optio independently of font and component style.",
      segments: Array.map(ICON_LIBRARIES, (option) => ({
        label: option.label,
        selected: iconLibrary === option.value,
        onSelect: Message.SelectedIconLibrary({ library: option.value }),
      })),
    },
    h,
  );

export const controlSizeRow = (controlSize: ControlSize, h: H<Message>) =>
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

const isCustomAccent = (accent: Accent): boolean => pipe(accent, String.startsWith("#"));

const accentLabel = (label: string, accent: Accent, h: H<Message>) =>
  h.span.class("flex items-center gap-3").children(
    h.span
      .class("accent-swatch size-5 shrink-0 rounded-full border border-foreground/20")
      .attr("data-accent", accent)
      .attr("aria-hidden", "true")
      .style({ backgroundColor: isCustomAccent(accent) && accent }),
    label,
  );

export const accentRows = (accent: Accent, h: H<Message>) =>
  choiceRows(
    {
      label: "Accent colour",
      header: "Accent colour",
      footer:
        "Default uses the look’s own colour. Others replace it on controls and focus indicators.",
      choices: [
        ...Array.map(ACCENTS, (option) => ({
          label: accentLabel(option.label, option.value, h),
          selected: accent === option.value,
          onSelect: Message.SelectedAccent({ accent: option.value }),
        })),
        {
          label: accentLabel("Other…", isCustomAccent(accent) ? accent : "default", h),
          subtitle: isCustomAccent(accent) ? String.toUpperCase(accent) : "Choose a custom colour",
          selected: isCustomAccent(accent),
          onSelect: Message.OpenedAccentPicker(),
        },
      ],
    },
    h,
  );

export const accentPicker = (accentDraft: string | null, h: H<Message>) =>
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
            h.div.class("flex flex-col gap-4").children(
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
            ),
          ],
          h,
        ),
      ];
