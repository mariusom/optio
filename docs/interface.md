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
- Use bottom sheets on phones and centered cards on larger screens. Preserve
  focus entry, containment and restoration in [sheetFocus.ts](../src/web/sheetFocus.ts).
  Destructive actions require confirmation.
- Label fields, explain disabled primary actions, and use plain terms such as
  “question”, “choices” and “must be answered”. Show short errors; send technical
  details to the console.
- Keep 16px mobile inputs, safe-area padding, delegated scrolling and the
  dynamic-height shell in [index.css](../src/index.css). Preserve visible keyboard
  focus, reduced-motion support and hidden decorative icons.
- Responsive copies need distinct field IDs and radio names. Focus and scroll
  targets must resolve to the visible copy; test both sidebar states.

Component style presets are separate from appearance and preserve app-owned
layout and touch sizing. Default/Nova keeps local defaults; other styles use
upstream radii. Use the generator described in [development](development.md)
instead of editing the generated style table.

## Foldcn component review — 2026-09-29

Reviewed the 66-item registry against upstream
[`a6a82bd`](https://github.com/elianiva/foldcn/commit/a6a82bd820578ef064257c39ea81ec77ea45a0dc).
Registry URLs are live, not commit-pinned. All 21 local component modules have
refreshed style mappings for the eight presets; local touch sizing and compact
field layouts remain intentional overrides. “Unchanged” below means the
authored component had no upstream change since the September 9 snapshot.

| Local component | Update and usage decision                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alert           | Added; app notices use its description and action slots, preserving severity, status/alert roles and 44px dismissal.                                                                     |
| alert-dialog    | Forward explicit description presence; retain app-owned confirmations and focus handling.                                                                                                |
| badge           | Unchanged; retain status badges.                                                                                                                                                         |
| button          | Unchanged; retain shared actions and touch sizes.                                                                                                                                        |
| card            | Unchanged; retain card styling used by app primitives.                                                                                                                                   |
| checkbox        | Forward description presence; retain wrapper without replacing existing specialized controls.                                                                                            |
| dialog          | Forward explicit description presence; retain app sheet lifecycle.                                                                                                                       |
| empty           | Unchanged; retain app empty states.                                                                                                                                                      |
| fieldset        | Added for the updated radio field/choice-card anatomy; includes grouped fields and error rendering.                                                                                      |
| input           | Forward description presence; retain compact label/control layout and mobile sizing.                                                                                                     |
| item            | Unchanged; retain shared list-row styling.                                                                                                                                               |
| label           | Unchanged; retain helper without forcing a migration of app labels.                                                                                                                      |
| native-select   | Forward description presence; retain native selects.                                                                                                                                     |
| progress        | Unchanged; retained, no new consumer.                                                                                                                                                    |
| radio-group     | Add field/choice-card layouts, invalid state and description presence; disabled buttons stay out of tab order. Preserve legacy renderer. Do not replace the runner's native radio grids. |
| separator       | Unchanged; retained, no new consumer.                                                                                                                                                    |
| sheet           | Forward explicit description presence; preserve responsive app sheets and their focus management.                                                                                        |
| skeleton        | Unchanged; retained, no new consumer.                                                                                                                                                    |
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
| button-group           | Existing actions are independent, not connected segmented controls.                            |
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
| kbd                    | No existing shortcut legend.                                                                   |
| listbox                | Native selects already serve current selection needs.                                          |
| marker                 | Existing status badges and notices cover current indicators.                                   |
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
| toggle-group           | Existing single/multiple-choice controls express form selection semantics.                     |
| tooltip                | Essential labels/help already remain visible and touch-accessible.                             |
| virtual-list           | No measured rendering bottleneck justifies changing focus/scroll behavior.                     |
