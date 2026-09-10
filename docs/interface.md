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
  focus entry, containment and restoration in [sheetFocus.ts](../src/we/sheetFocus.ts).
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
