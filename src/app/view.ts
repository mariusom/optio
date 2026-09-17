import type { Document, HtmlBuilder } from "foldkit/html";
import { Message } from "../messages";
import type { Model } from "./model";
import type { Route } from "../web/routes";
import { isFullScreenRoute } from "../web/routes";
import { settingsPage } from "../web/features/settings/view";
import { infoPage } from "../web/features/settings/infoView";
import { sessionView } from "../web/features/session/sessionView";
import { startView } from "../web/features/session/startView";
import { templateEditorPage } from "../web/features/templates/editorView";
import { templatesPage } from "../web/features/templates/view";
import { historyPage } from "../web/features/history/historyView";
import { sessionDetailPage } from "../web/features/history/sessionDetailView";
import { button } from "@/components/ui/button";
import { Plus, icon, pageHeader, sidebar, tabBar } from "@/components/app";

const pageTitle = (route: Route): string => {
  switch (route._tag) {
    case "AgentHelp":
      return "Use with AI";
    case "About":
      return "About Optio";
    case "SettingsTab":
      return "Settings";
    case "StartTab":
      return "Session";
    case "HistoryTab":
      return "History";
    case "TemplatesTab":
      return "Templates";
    case "SessionRunner":
      return "Session";
    case "TemplateEditor":
      return "Template";
    case "SessionDetail":
      return "Session";
  }
};

const pageFor = (model: Model, h: HtmlBuilder<Message>) => {
  if (model.showCreate) return templateEditorPage(model, h);
  switch (model.route._tag) {
    case "AgentHelp":
    case "About":
      return infoPage(model.route._tag, h, model.promptCopyStatus);
    case "SettingsTab":
      return settingsPage(model, h);
    case "StartTab":
      return startView(model, h);
    case "TemplatesTab":
      return templatesPage(model, h);
    case "HistoryTab":
      return historyPage(model, h);
    case "SessionRunner":
      return sessionView(model as unknown as Parameters<typeof sessionView>[0], h);
    case "TemplateEditor":
      return templateEditorPage(model as Parameters<typeof templateEditorPage>[0], h);
    case "SessionDetail":
      return sessionDetailPage(model, h);
  }
};

/** Large-title header for the four tab roots; detail screens draw their own nav bar. */
const rootHeader = (model: Model, h: HtmlBuilder<Message>) => {
  if (model.showCreate) return null;
  switch (model.route._tag) {
    case "TemplatesTab":
      return pageHeader(
        {
          title: pageTitle(model.route),
          trailing:
            model.templates.length > 0
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
      );
    case "StartTab":
    case "HistoryTab":
    case "SettingsTab":
      return pageHeader({ title: pageTitle(model.route) }, h);
    case "AgentHelp":
    case "About":
    case "SessionRunner":
    case "TemplateEditor":
    case "SessionDetail":
      return null;
  }
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const isRunner = model.route._tag === "SessionRunner";
  const hasHistory = model.history.length > 0;
  const header = rootHeader(model, h);
  return {
    title: "optio",
    body: h.div(
      [
        h.Class(
          `app-shell ${isFullScreenRoute(model.route) ? "focus-workspace" : "browse-workspace"} flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground`,
        ),
      ],
      [
        ...(isRunner ? [] : [sidebar(model.route, hasHistory, h)]),
        h.main(
          [
            h.Class(
              `relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain has-[[data-slot=sheet]]:z-40 ${
                isRunner ? "" : "md:pl-[4.5rem] xl:pl-60"
              }`,
            ),
          ],
          [...(header === null ? [] : [header]), pageFor(model, h)],
        ),
        ...(isFullScreenRoute(model.route) || model.showCreate
          ? []
          : [tabBar(model.route, hasHistory, h)]),
      ],
    ),
  } satisfies Document;
};
