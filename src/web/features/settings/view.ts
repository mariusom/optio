import type { HtmlBuilder } from "foldkit/html";

import { choiceRows, groupedList, notice, page, row } from "@/components/app";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import type { Accent, ControlSize, Font, IconLibrary, Look, Theme } from "../../theme";
import type { FoldcnStyle } from "../../style";
import { hrefFor } from "../../routes";
import {
  accentPicker,
  accentRows,
  controlSizeRow,
  iconLibraryControl,
  lookRows,
  themeControl,
} from "./appearance";

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

type FailureOptions = Readonly<{
  theme: Theme;
  themeSaveFailed: boolean;
  styleSaveFailed: boolean;
  fontSaveFailed: boolean;
  accentSaveFailed: boolean;
  iconLibrarySaveFailed: boolean;
  lookSaveFailed: boolean;
  controlSizeSaveFailed: boolean;
  styleLoadFailed: boolean;
}>;

/** Preferences that apply at once but may fail to save, and what to say. */
const unsavedNotices = (options: FailureOptions): ReadonlyArray<string> =>
  [
    [options.styleLoadFailed, "Couldn't load that style. Reload the app before trying again."],
    [options.styleSaveFailed, "The component style was applied but couldn’t be saved."],
    [options.lookSaveFailed, "The look was applied but couldn’t be saved."],
    [options.controlSizeSaveFailed, "The control size was applied but couldn’t be saved."],
    [options.fontSaveFailed, "The font was applied but couldn’t be saved."],
    [options.iconLibrarySaveFailed, "The icon style was applied but couldn’t be saved."],
    [options.accentSaveFailed, "The accent colour was applied but couldn’t be saved."],
  ].flatMap(([failed, text]) => (failed ? [text as string] : []));

const failureNotices = (options: FailureOptions, h: HtmlBuilder<Message>) => [
  ...(options.themeSaveFailed
    ? [
        notice(
          {
            tone: "warning" as const,
            text: "Applied for now, but it couldn’t be saved. Free up some space on this device and try again.",
          },
          h,
        ),
        button(
          {
            variant: "link" as const,
            className: "mx-auto",
            onClick: Message.SelectedTheme({ theme: options.theme }),
          },
          "Try again",
          h,
        ),
      ]
    : []),
  ...unsavedNotices(options).map((text) => notice({ tone: "warning", text }, h)),
];

const helpAndAbout = (h: HtmlBuilder<Message>) =>
  h.details(
    [h.Class("rounded-lg border border-border")],
    [
      h.summary(
        [
          h.Class(
            "min-h-11 cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
          ),
        ],
        ["Help & about"],
      ),
      h.div(
        [h.Class("border-t border-border divide-y divide-border")],
        [
          row({ title: "Use with AI", href: hrefFor({ _tag: "AgentHelp" }) }, h),
          row({ title: "About Optio", href: hrefFor({ _tag: "About" }) }, h),
        ],
      ),
    ],
  );

const privacy = (h: HtmlBuilder<Message>) =>
  groupedList(
    {
      header: "Privacy",
      footer:
        "No account is needed. After the first load, studies work offline. Export important results; browser storage is not a backup.",
    },
    [
      row(
        {
          title: "Stored in this browser",
          wrap: true,
          value: "Optional assistant access can share study data with your assistant provider.",
        },
        h,
      ),
    ],
    h,
  );

type SettingsModel = FailureOptions &
  Readonly<{
    style: FoldcnStyle;
    font: Font;
    accent: Accent;
    accentDraft: string | null;
    iconLibrary: IconLibrary;
    look: Look;
    controlSize: ControlSize;
  }>;

/** One settings column; columns sit side by side from 1280px (xl). */
const column = (children: Parameters<typeof page>[1], h: HtmlBuilder<Message>) =>
  h.div([h.Class("flex min-w-0 flex-col gap-6")], children);

/**
 * Settings reads top to bottom on phones; from 1280px the same order flows
 * into two columns (look and colour, then type, symbols, shape and info), so
 * reading and tab order still finish one column before starting the next.
 */
export const settingsPage = (model: SettingsModel, h: HtmlBuilder<Message>) =>
  page(
    { wide: "xl" },
    [
      h.div(
        [h.Class("grid gap-6 xl:grid-cols-2 xl:items-start xl:gap-8")],
        [
          column(
            [
              lookRows(model.look, h),
              themeControl(model.theme, h),
              accentRows(model.accent, h),
              controlSizeRow(model.controlSize, h),
            ],
            h,
          ),
          column(
            [
              choiceRows(
                {
                  label: "Font",
                  header: "Font",
                  footer: "Uses fonts already available on your device.",
                  choices: FONTS.map((option) => ({
                    label: option.label,
                    selected: model.font === option.value,
                    onSelect: Message.SelectedFont({ font: option.value }),
                  })),
                },
                h,
              ),
              iconLibraryControl(model.iconLibrary, h),
              choiceRows(
                {
                  label: "Component style",
                  header: "Component style",
                  footer:
                    "Changes component shape, spacing and typography independently of appearance.",
                  choices: STYLES.map((option) => ({
                    label: option.label,
                    selected: model.style === option.value,
                    onSelect: Message.SelectedStyle({ style: option.value }),
                  })),
                },
                h,
              ),
              ...failureNotices(model, h),
              privacy(h),
              helpAndAbout(h),
            ],
            h,
          ),
        ],
      ),
      ...accentPicker(model.accentDraft, h),
    ],
    h,
  );
