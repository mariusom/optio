import { AsyncData } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { Message } from "../messages";
import { templatesOf, type Model } from "./model";
import { RouteSchema, isFullScreenRoute, type Route } from "../web/routes";
import { settingsPage } from "../web/features/settings/view";
import { infoPage } from "../web/features/settings/infoView";
import { sessionView } from "../web/features/session/sessionView";
import { startView } from "../web/features/session/startView";
import { templateEditorPage } from "../web/features/templates/editorView";
import { templatesPage } from "../web/features/templates/view";
import { historyPage } from "../web/features/history/historyView";
import { sessionDetailPage } from "../web/features/history/sessionDetailView";
import { storageNotice } from "../web/storageNotice";
import { appUpdatePrompt } from "../web/appUpdate";
import { button } from "@/components/ui/button";
import {
  Plus,
  icon,
  notice,
  pageHeader,
  sidebar,
  skeletonPage,
  tabBar,
  type SkeletonBlock,
} from "@/components/app";

const pageTitle = (route: Route): string =>
  RouteSchema.match(route, {
    AgentHelp: () => "Use with AI",
    About: () => "About Optio",
    SettingsTab: () => "Settings",
    StartTab: () => "Session",
    HistoryTab: () => "History",
    TemplatesTab: () => "Templates",
    SessionRunner: () => "Session",
    TemplateEditor: () => "Template",
    SessionDetail: () => "Session",
  });

/** Names the page in the tab, browser history and screen-reader announcements. */
const documentTitle = (model: Model): string =>
  `${model.showCreate ? "New template" : pageTitle(model.route)} · Optio`;

/** A list could not be read; the page offers to read it again. */
const listReadFailure = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("mx-auto w-full max-w-3xl px-safe pb-4")],
    [
      notice(
        {
          tone: "error",
          role: "alert",
          text: h.div(
            [h.Class("flex flex-wrap items-center gap-x-3 gap-y-2")],
            [
              h.span(
                [h.Class("min-w-0 flex-1 basis-48")],
                ["Your studies couldn’t be read. Try again, or reload Optio."],
              ),
              button(
                {
                  type: "button",
                  variant: "outline",
                  className: "h-11 text-foreground",
                  onClick: Message.ClickedRetryListRead(),
                },
                "Try again",
                h,
              ),
            ],
          ),
        },
        h,
      ),
    ],
  );

/**
 * Renders a page once the saved data it shows has been read. Until then it
 * shows a skeleton of that page, revealed only if the read is slow, so the page
 * never flashes "nothing here yet" before the real content. If the store
 * cannot be opened, the storage notice above the page explains why it is blank;
 * if a read fails, the page says so and offers to read it again.
 */
const whenLoaded = <A>(
  model: Model,
  config: Readonly<{
    data: AsyncData.AsyncData<A, "ReadFailed">;
    skeleton: ReadonlyArray<SkeletonBlock>;
    page: (data: A) => Html;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  AsyncData.matchData(config.data, {
    onEmpty: () =>
      model.storage === "unavailable"
        ? h.div([])
        : skeletonPage({ label: "Opening your studies…", blocks: config.skeleton }, h),
    onFailure: () => listReadFailure(h),
    onData: config.page,
  });

// Outlines of each page's usual content, shown while its data is read.
const startSkeleton: ReadonlyArray<SkeletonBlock> = [
  { _tag: "Controls", rows: 2 },
  { _tag: "Action" },
];
const listSkeleton: ReadonlyArray<SkeletonBlock> = [{ _tag: "List", rows: 4, subtitles: true }];

const pageFor = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.showCreate) return templateEditorPage(model, h);
  return RouteSchema.match(model.route, {
    AgentHelp: () => infoPage("AgentHelp", h, model.promptCopyStatus),
    About: () => infoPage("About", h, model.promptCopyStatus),
    SettingsTab: () => settingsPage(model, h),
    StartTab: () =>
      whenLoaded(
        model,
        {
          data: AsyncData.all({ activeSession: model.activeSession, templates: model.templates }),
          skeleton: startSkeleton,
          page: (data) => startView({ ...model, ...data }, h),
        },
        h,
      ),
    TemplatesTab: () =>
      whenLoaded(
        model,
        {
          data: model.templates,
          skeleton: listSkeleton,
          page: (templates) => templatesPage({ ...model, templates }, h),
        },
        h,
      ),
    HistoryTab: () =>
      whenLoaded(
        model,
        {
          data: model.history,
          skeleton: listSkeleton,
          page: (history) => historyPage({ ...model, history }, h),
        },
        h,
      ),
    SessionRunner: () => sessionView(model, h),
    TemplateEditor: () => templateEditorPage(model, h),
    SessionDetail: () => sessionDetailPage(model, h),
  });
};

/** Large-title header for the four tab roots; detail screens draw their own nav bar. */
const rootHeader = (model: Model, h: HtmlBuilder<Message>): Html | null => {
  if (model.showCreate) return null;
  const titled = () => pageHeader({ title: pageTitle(model.route) }, h);
  return RouteSchema.matchOrElse(
    model.route,
    {
      TemplatesTab: () =>
        pageHeader(
          {
            title: pageTitle(model.route),
            trailing:
              templatesOf(model).length > 0
                ? button(
                    {
                      size: "icon-lg",
                      className: "size-11 rounded-full",
                      onClick: Message.ClickedNewTemplate(),
                      attributes: [h.AriaLabel("New template")],
                    },
                    icon(h, Plus, "size-5"),
                    h,
                  )
                : undefined,
          },
          h,
        ),
      StartTab: titled,
      HistoryTab: titled,
      SettingsTab: titled,
    },
    () => null,
  );
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const isRunner = model.route._tag === "SessionRunner";
  const header = rootHeader(model, h);
  // The runner places its own notice; starting a session counts as recording.
  const storage = isRunner
    ? null
    : storageNotice(model, h, { recording: model.route._tag === "StartTab" });
  const updatePrompt = appUpdatePrompt(model.appUpdate, h);
  return {
    title: documentTitle(model),
    body: h.div(
      [
        h.Class(
          `app-shell ${isFullScreenRoute(model.route) ? "focus-workspace" : "browse-workspace"} flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground`,
        ),
      ],
      [
        ...(isRunner ? [] : [sidebar(model.route, h)]),
        h.main(
          [
            h.Class(
              `relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain has-[[data-slot=sheet]]:z-40 has-[[data-slot=sheet]]:overflow-hidden ${
                isRunner ? "" : "md:pl-[4.5rem] xl:pl-60"
              }`,
            ),
          ],
          [
            ...(header === null ? [] : [header]),
            ...(storage === null
              ? []
              : [h.div([h.Class("mx-auto w-full max-w-3xl px-safe pb-4")], [storage])]),
            pageFor(model, h),
          ],
        ),
        ...(isFullScreenRoute(model.route) || model.showCreate ? [] : [tabBar(model.route, h)]),
        ...(updatePrompt === null ? [] : [updatePrompt]),
      ],
    ),
  } satisfies Document;
};
