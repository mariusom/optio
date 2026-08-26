import type { HtmlBuilder } from 'foldkit/html'

import { hrefFor, isFullScreenRoute, type Route } from './routes'

// Shared view primitives for the WatchfulEye shell.
// Plain functions per foldkit docs (only h.submodel-embedded views need defineView).

// ── Icons ────────────────────────────────────────────────────────────────

type IconProps = { readonly name: IconName; readonly class?: string }
export type IconName = 'play' | 'clock' | 'doc' | 'plus' | 'chevronRight' | 'list'

/** Stroke-based 24px-grid icons, feather-style, sized via the class string. */
const icon =
  <M>({ name, class: classes = 'h-5 w-5' }: IconProps, h: HtmlBuilder<M>) => {
    const stroke = [
      h.Attribute('viewBox', '0 0 24 24'),
      h.Attribute('fill', 'none'),
      h.Attribute('stroke', 'currentColor'),
      h.Attribute('stroke-width', '2'),
      h.Attribute('stroke-linecap', 'round'),
      h.Attribute('stroke-linejoin', 'round'),
    ]
    switch (name) {
      case 'play':
        return h.svg(
          [...stroke, h.Class(classes)],
          [h.path([h.Attribute('d', 'M6 4l14 8-14 8V4z'), h.Attribute('fill', 'currentColor')], [])],
        )
      case 'clock':
        return h.svg([...stroke, h.Class(classes)], [
          h.circle([h.Attribute('cx', '12'), h.Attribute('cy', '12'), h.Attribute('r', '9')], []),
          h.polyline([h.Attribute('points', '12 7 12 12 15.5 13.5')], []),
        ])
      case 'doc':
        return h.svg([...stroke, h.Class(classes)], [
          h.path([h.Attribute('d', 'M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z')], []),
          h.polyline([h.Attribute('points', '14 2 14 7 19 7')], []),
          h.line([h.Attribute('x1', '9'), h.Attribute('y1', '12'), h.Attribute('x2', '15'), h.Attribute('y2', '12')], []),
          h.line([h.Attribute('x1', '9'), h.Attribute('y1', '16'), h.Attribute('x2', '13'), h.Attribute('y2', '16')], []),
        ])
      case 'plus':
        return h.svg([...stroke, h.Class(classes)], [
          h.line([h.Attribute('x1', '12'), h.Attribute('y1', '5'), h.Attribute('x2', '12'), h.Attribute('y2', '19')], []),
          h.line([h.Attribute('x1', '5'), h.Attribute('y1', '12'), h.Attribute('x2', '19'), h.Attribute('y2', '12')], []),
        ])
      case 'chevronRight':
        return h.svg([...stroke, h.Class(classes)], [
          h.polyline([h.Attribute('points', '9 5 16 12 9 19')], []),
        ])
      case 'list':
        return h.svg([...stroke, h.Class(classes)], [
          h.line([h.Attribute('x1', '8'), h.Attribute('y1', '6'), h.Attribute('x2', '20'), h.Attribute('y2', '6')], []),
          h.line([h.Attribute('x1', '8'), h.Attribute('y1', '12'), h.Attribute('x2', '20'), h.Attribute('y2', '12')], []),
          h.line([h.Attribute('x1', '8'), h.Attribute('y1', '18'), h.Attribute('x2', '20'), h.Attribute('y2', '18')], []),
          h.circle([h.Attribute('cx', '4'), h.Attribute('cy', '6'), h.Attribute('r', '1'), h.Attribute('fill', 'currentColor')], []),
          h.circle([h.Attribute('cx', '4'), h.Attribute('cy', '12'), h.Attribute('r', '1'), h.Attribute('fill', 'currentColor')], []),
          h.circle([h.Attribute('cx', '4'), h.Attribute('cy', '18'), h.Attribute('r', '1'), h.Attribute('fill', 'currentColor')], []),
        ])
    }
  }

// ── Building blocks ──────────────────────────────────────────────────────

type TabDef = {
  readonly tag: 'StartTab' | 'HistoryTab' | 'TemplatesTab'
  readonly label: string
  readonly icon: IconName
}

const TABS: ReadonlyArray<TabDef> = [
  { tag: 'StartTab', label: 'Session', icon: 'play' },
  { tag: 'HistoryTab', label: 'History', icon: 'clock' },
  { tag: 'TemplatesTab', label: 'Templates', icon: 'doc' },
]

/**
 * iOS-style bottom tab bar. Safe-area aware; hidden on full-screen routes.
 * Anchors drive hash routing — no JS navigation needed.
 */
export const bottomTabBar = <M>(route: Route, h: HtmlBuilder<M>) =>
  h.nav(
    [
      h.Class(
        'fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg select-none',
      ),
    ],
    [
      h.div(
        [h.Class('mx-auto grid h-12 max-w-md grid-cols-3 items-center')],
        TABS.map(tab => {
          const active = route._tag === tab.tag
          const href = hrefFor({ _tag: tab.tag })
          return h.a(
            [
              h.Class(
                `flex h-full flex-col items-center justify-center transition-transform active:scale-95 ${
                  active ? 'text-primary' : 'text-base-content/50 hover:text-base-content/80'
                }`,
              ),
              h.Attribute('href', href),
              h.AriaLabel(tab.label),
              ...(active ? [h.AriaCurrent('page')] : []),
            ],
            [
              icon({ name: tab.icon, class: 'h-5 w-5' }, h),
              h.span([h.Class('mt-0.5 text-[10px] font-medium tracking-tight')], [tab.label]),
            ],
          )
        }),
      ),
    ],
  )

/** iOS blurred sticky top bar with centered title + optional trailing slot. */
export const topBar = <M>(
  title: string,
  trailing: ReturnType<HtmlBuilder<M>['div']> | null,
  h: HtmlBuilder<M>,
) =>
  h.header(
    [
      h.Class(
        'sticky top-0 z-30 w-full border-b border-base-300/80 bg-base-100/80 pt-[env(safe-area-inset-top)] backdrop-blur-md select-none',
      ),
    ],
    [
      h.div([h.Class('mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4')], [
        h.div([h.Class('min-w-16')], []),
        h.h1(
          [h.Class('max-w-[220px] truncate text-center text-base font-semibold tracking-tight sm:max-w-xs')],
          [title],
        ),
        h.div([h.Class('flex min-w-16 items-center justify-end')], trailing === null ? [] : [trailing]),
      ]),
    ],
  )

type EmptyStateProps = {
  readonly icon: IconName
  readonly title: string
  readonly message: string
}

/** Unified empty state: icon in soft circle, semibold heading, muted copy. */
export const emptyState = <M>(
  props: EmptyStateProps,
  h: HtmlBuilder<M>,
) =>
  h.div(
    [h.Class('mx-auto my-auto flex max-w-sm flex-col items-center justify-center p-8 text-center')],
    [
      h.div(
        [h.Class('mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-300/60 text-base-content/50')],
        [icon({ name: props.icon, class: 'h-7 w-7' }, h)],
      ),
      h.h3([h.Class('text-base font-semibold text-base-content')], [props.title]),
      h.p([h.Class('mt-1 text-xs leading-relaxed text-base-content/60')], [props.message]),
    ],
  )

export { icon }
