# Interface conventions

Use [app primitives](../src/components/app) for navigation, grouped lists,
feedback and sheets. They compose project-owned [registry components](../src/components/ui)
from [Foldcn](https://foldcn.elianiva.com). Consult upstream documentation for
component APIs; review local customizations before refreshing a registry item.

- Use semantic colors and Tailwind spacing. Primary controls keep 44px touch
  targets (`h-11`); large buttons use `h-12`. Pages control layout, while shared
  primitives own control padding, radii, typography and sizing.
- Keep the phone-first layout: bottom tabs below 768px, a sidebar above that,
  and a labeled sidebar from 1280px. Live sessions hide phone tabs and add a
  task column on larger screens.
- Use bottom sheets on phones and centered cards on larger screens, built with
  [sheet.ts](../src/components/app/sheet.ts) (app pages use the
  [web/sheets.ts](../src/web/sheets.ts) wrappers). Each renders the
  @foldkit/ui Dialog view on a native `<dialog>` and is open while rendered:
  mounting shows it with FoldKit's focus entry (`[autofocus]`, else the first
  control), Tab containment, topmost-only Escape and scroll lock (the delegated
  `main` scroller stops too); unmounting releases them and returns focus to
  whatever opened the first of consecutive sheets. Give each sheet a unique
  `id`; render it once, outside responsive copies. Action sheets list every
  action, destructive ones included, as `sheetAction` rows aligned with the
  title, with Cancel in the footer. Destructive actions require confirmation.
- Label fields, explain disabled primary actions, and use plain terms such as
  “question”, “choices” and “must be answered”. Show short errors; send technical
  details to the console.
- Keep 16px mobile inputs, safe-area padding, delegated scrolling and the
  dynamic-height shell in [index.css](../src/index.css). Preserve visible keyboard
  focus, reduced-motion support and hidden decorative icons.
- Responsive copies need distinct field IDs and radio names. Focus and scroll
  targets must resolve to the visible copy; test both sidebar states. Run DOM
  effects after `Render.afterCommit` (or `afterPaint`), never timers; scripted
  smooth scrolling must fall back to instant under reduced motion. Headings
  focused programmatically hide their outline; they are not in the tab order.
- Pages showing saved data render a `skeletonPage` outline of their content
  until the data is read (`whenLoaded` in `app/view.ts`), never an empty state.
  It appears only after 400 ms (`loading-reveal`), so quick reads show no
  placeholder; its blocks are hidden from screen readers behind one status.
- Charts are plain HTML/CSS. Their marks are decorative (`aria-hidden`); a
  visible list beside them names every value, so meaning never rests on colour.
  Data colours are the only non-semantic colours: the fixed categorical slots
  in `history/timeBreakdownView.ts`, with their own dark-mode steps, assigned
  in order and never cycled (fold extra categories into “Other”). Missing data
  uses a muted neutral. Re-validate any slot change in light and dark mode.
- A template's “Time report” (its action sheet) sums the session-detail
  breakdown over every finished session recorded with it. It is a sheet, open
  while `templateReportFor` is set, fed by the `templateReport` subscription.
- Durations in lists use `formatDurationShort` (seconds under a minute, then
  hours and minutes); detail screens use `formatDurationHms`.
- The runner's primary action has one desktop shortcut, Ctrl/⌘+Enter: Record,
  or Save while editing (`runnerShortcuts` subscription, off while a sheet is
  open or ending). The buttons declare `aria-keyshortcuts`; the visible `kbd`
  hint shows only with a fine pointer from 768px.
- Key rows in lists that insert or reorder items (`row({ key })` or
  `h.keyed`), so focus stays with the same item. Reorder with explicit up/down
  buttons (`reorderButtons` in the template feature): 44px targets, muted so item
  names dominate, disabled at the ends.
- Name tappable rows by their visible text; do not override it with an
  `aria-label` (WCAG 2.5.3), so voice control can say what it sees. Icon-only
  controls beside a row keep their own labels (“Actions for …”, “Move … up”).
- Only one session can be live. Controls that start a session offer to resume
  the live one instead: the Session tab shows “Resume session”, and the template
  action sheet replaces “Start session” with “Resume live session” and says why.

Looks (Classic, Studio, Swiss, Shopfloor, Blueprint) restyle colours,
surfaces and headings through `html[data-look]` in [looks.css](../src/looks.css),
with a light and a dark palette each and system fonts only; layout, sizes and
data stay the same. Blueprint is the default look (`defaultLook` in `web/theme.ts`; a saved choice
wins); Classic uses the base tokens in `index.css`. The static `theme-color` tags
in `index.html` and the PWA manifest colours match Blueprint. A non-default
accent still replaces a look's primary colour, except in the dark navigation of
Shopfloor and Blueprint. `src/web/looks.test.ts` checks every palette's contrast;
add new looks there. Browser chrome uses each look's `lookThemeColors` entry.
“Larger controls” (`html[data-control-size="large"]`) scales text to 112.5%,
gives answer choices and primary actions 56px and stacks choices on phones.
Settings uses native-radio segmented controls (`segmentedControl` in app
primitives) for short single choices such as appearance and icon style.

Component style presets are separate from appearance and preserve app-owned
layout and touch sizing. Default/Nova keeps local defaults; other styles use
upstream radii. Use the generator described in [development](development.md)
instead of editing the generated style table.

## Foldcn component review — 2026-09-29

Reviewed the 66-item registry against upstream
[`a6a82bd`](https://github.com/elianiva/foldcn/commit/a6a82bd820578ef064257c39ea81ec77ea45a0dc).
Registry URLs are live, not commit-pinned. Rechecked on 2026-10-10 against
[`5fa3b78`](https://github.com/elianiva/foldcn/commit/5fa3b78): the only change is
a new `message` component; no imported component changed. The 17 modules the app renders have
style mappings for the eight presets (skeleton, progress and kbd were added on
2026-10-10 for loading pages, required-answer progress and the record shortcut); checkbox, fieldset,
label, radio-group and separator keep their local classes under every preset
until they gain a consumer (add them to the generator then), because every
mapped class ships in the CSS bundle. Local touch sizing and compact field
layouts remain intentional overrides. “Unchanged” below means the
authored component had no upstream change since the September 9 snapshot.

| Local component | Update and usage decision                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alert           | Added; app notices use its description and action slots, preserving severity, status/alert roles and 44px dismissal.                                                                     |
| alert-dialog    | Forward explicit description presence; app confirmations use the app sheet instead.                                                                                                      |
| badge           | Unchanged; retain status badges.                                                                                                                                                         |
| button          | Unchanged; retain shared actions and touch sizes.                                                                                                                                        |
| card            | Unchanged; retain card styling used by app primitives.                                                                                                                                   |
| checkbox        | Forward description presence; retain wrapper without replacing existing specialized controls.                                                                                            |
| dialog          | Forward explicit description presence; app sheets render its Dialog view (init/view) on a native dialog.                                                                                 |
| empty           | Unchanged; retain app empty states.                                                                                                                                                      |
| fieldset        | Added for the updated radio field/choice-card anatomy; includes grouped fields and error rendering.                                                                                      |
| input           | Forward description presence; retain compact label/control layout and mobile sizing.                                                                                                     |
| kbd             | Added for the runner's Ctrl/⌘+Enter hint; key text uses `text-foreground/80` at the call site for 4.5:1 on the muted key.                                                                |
| item            | Unchanged; retain shared list-row styling.                                                                                                                                               |
| label           | Unchanged; retain helper without forcing a migration of app labels.                                                                                                                      |
| native-select   | Forward description presence; retain native selects.                                                                                                                                     |
| progress        | Local `children`/`attributes` for upstream label anatomy and an accessible name; the runner shows required-answer progress ("1 of 3 required answered").                                 |
| radio-group     | Add field/choice-card layouts, invalid state and description presence; disabled buttons stay out of tab order. Preserve legacy renderer. Do not replace the runner's native radio grids. |
| separator       | Unchanged; retained, no new consumer.                                                                                                                                                    |
| sheet           | Forward explicit description presence; the responsive app sheet keeps its own bottom-sheet/card panel.                                                                                   |
| skeleton        | Unchanged; loading pages use it through `skeletonPage`.                                                                                                                                  |
| spinner         | Added to session loading; decorative icon with reduced-motion support and one parent live status.                                                                                        |
| switch          | Forward description presence; retain settings toggles and local label layout.                                                                                                            |
| textarea        | Forward description presence; retain editor sizing.                                                                                                                                      |

The upstream `Dialog.boot` re-export is deferred: the compatible installed
FoldKit lacks it. It also affects alert-dialog and sheet. The newer dependency
group is blocked by LiveStore's Effect imports; see [development](development.md).
The description APIs used here are already supported by the installed FoldKit.

The remaining catalog items were evaluated against existing use cases, rather
than copied without consumers. “New” identifies additions since September 9.

| Not imported           | Fit assessment                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| accordion              | No existing collapsible section requiring this interaction.                                    |
| animation              | Existing CSS transitions and reduced-motion rules suffice.                                     |
| aspect-ratio           | No media presentation needing a ratio wrapper.                                                 |
| attachment             | No file-attachment workflow.                                                                   |
| avatar                 | No account/profile UI.                                                                         |
| breadcrumb             | Current shallow navigation uses back actions.                                                  |
| bubble (new)           | No chat UI.                                                                                    |
| button-group           | Settings' segmented choices are form selections, so native radios serve them better.           |
| calendar               | No date-selection workflow.                                                                    |
| carousel (new)         | No slide/media workflow; would add Embla unnecessarily.                                        |
| collapsible            | No current disclosure interaction to replace.                                                  |
| combobox               | Short option lists do not need autocomplete.                                                   |
| command                | No requested command-palette workflow.                                                         |
| context-menu           | Keep visible touch-accessible actions; upstream also lacks pointer-position anchoring.         |
| date-picker            | No date input requiring a popup calendar.                                                      |
| direction              | No existing runtime direction switch.                                                          |
| drag-and-drop          | Keep explicit reorder controls and keyboard access.                                            |
| drawer                 | Preserve current responsive sheets; drag dismissal would change behavior.                      |
| file-drop              | No import/upload workflow.                                                                     |
| hover-card             | Essential information must remain visible on touch devices.                                    |
| input-group            | Current fields do not need shared-border add-ons.                                              |
| input-otp              | No authentication/OTP workflow.                                                                |
| listbox                | Native selects already serve current selection needs.                                          |
| marker                 | Existing status badges and notices cover current indicators.                                   |
| message (new)          | Chat message layout; Optio has no chat or transcript.                                          |
| menu                   | Keep visible actions rather than hiding them in dropdowns.                                     |
| menubar                | Not a desktop menu-driven app; upstream lacks cross-menu arrow traversal.                      |
| message-scroller (new) | No transcript or live-edge chat scrolling.                                                     |
| nav                    | Existing app navigation already owns active routes and responsive copies.                      |
| navigation-menu        | No nested hover navigation.                                                                    |
| pagination (new)       | Current lists are not paged.                                                                   |
| popover                | No existing floating-panel interaction to replace.                                             |
| questionnaire (new)    | Step/skip flow does not match timed observations, revisiting tasks or persisted edit rollback. |
| resizable              | Existing responsive columns do not need user-controlled splitters.                             |
| scroll-area (new)      | Preserve native scrolling and current focus/scroll targets.                                    |
| select                 | Native-select covers the current use cases without an extra submodel.                          |
| sidebar                | Preserve bottom tabs, compact/labeled sidebar breakpoints and live-session task column.        |
| slider                 | Exact numeric entry is more appropriate for existing questions.                                |
| table                  | Current grouped result rows serve mobile layouts; CSV handles tabular export.                  |
| tabs                   | App tabs are route navigation, not an in-page tab-panel widget.                                |
| toast                  | Persistent inline errors and explicit refresh prompts must not auto-dismiss.                   |
| toggle                 | Existing switches and buttons already express boolean/actions semantics.                       |
| toggle-group           | Evaluated for segmented settings; a stateful submodel adds machinery native radios avoid.      |
| tooltip                | Essential labels/help already remain visible and touch-accessible.                             |
| virtual-list           | No measured rendering bottleneck justifies changing focus/scroll behavior.                     |
