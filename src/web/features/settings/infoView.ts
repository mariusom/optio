import type { H } from "@/lib/view";
import { controlRow, groupedList, navBar, page, row } from "@/components/app";
import { buttonClass } from "@/components/ui/button";
import type { Model } from "../../../app/model";
import type { Message } from "../../../messages";
import { hrefFor } from "../../routes";
import { version } from "../../../../package.json";

const aboutContent = (h: H<Message>) => [
  groupedList(
    { header: "Time & motion studies" },
    [
      row({ title: "Optio", value: `Version ${version} · Pre-release`, wrap: true }, h),
      row(
        {
          title: "Observe, record, understand",
          value:
            "Create study questions, record tasks as you work, and export results as CSV. Free and open source.",
          wrap: true,
        },
        h,
      ),
      row(
        {
          title: "Local by default",
          value:
            "No account, backend or sync. Works offline after the first load. Export important results; browser storage is not a backup.",
          wrap: true,
        },
        h,
      ),
    ],
    h,
  ),
  groupedList(
    {},
    [
      row({ title: "Use with AI", href: hrefFor({ _tag: "AgentHelp" }) }, h),
      row(
        {
          title: "Source code & feedback",
          href: "https://github.com/mariusom/optio",
          attrs: { target: "_blank", rel: "noopener noreferrer" },
          subtitle: "Opens in a new tab",
        },
        h,
      ),
      row(
        {
          title: "MIT licence",
          href: "https://github.com/mariusom/optio/blob/main/LICENSE",
          attrs: { target: "_blank", rel: "noopener noreferrer" },
          subtitle: "Opens in a new tab",
        },
        h,
      ),
      row(
        {
          title: "Third-party notices",
          href: `${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`,
          attrs: { target: "_blank", rel: "noopener noreferrer" },
          subtitle: "Opens in a new tab",
        },
        h,
      ),
    ],
    h,
  ),
];

const agentContent = (access: Model["assistantAccess"], h: H<Message>) => [
  groupedList(
    { header: "Assistant tools in this tab" },
    [
      access === "unavailable"
        ? controlRow([h.p.children("WebMCP isn’t available in this browser.")], h)
        : controlRow(
            [
              h.p.children(
                access === "approved"
                  ? "You’ve approved assistant access to studies in this tab."
                  : "A WebMCP assistant can read, change and delete studies if you approve. Its provider may receive study data. Deletion needs separate confirmation.",
              ),
              // A new query string loads a new document, so the startup consent
              // gate runs. (Effect UI cancels every form submit, so this is a link.)
              h.a
                .attr(
                  "href",
                  `${import.meta.env.BASE_URL}${access === "off" ? "?agentTools=1" : ""}${hrefFor({ _tag: "TemplatesTab" })}`,
                )
                .class(buttonClass({ variant: access === "off" ? "default" : "outline" }))
                .children(access === "off" ? "Enable assistant tools" : "Turn off assistant tools"),
              h.p
                .class("text-sm text-muted-foreground")
                .children("This reloads the tab. Save any drafts first."),
            ],
            h,
          ),
    ],
    h,
  ),
  groupedList(
    {
      header: "In a separate chat",
      footer: "Share the guide to plan a template. It contains instructions, not your study data.",
    },
    [
      row(
        {
          title: "Agent guide",
          href: `${import.meta.env.BASE_URL}agent-guide.md`,
          attrs: { target: "_blank", rel: "noopener noreferrer" },
          subtitle: "Markdown · Opens in a new tab",
        },
        h,
      ),
    ],
    h,
  ),
];

export const infoPage = (
  kind: "AgentHelp" | "About",
  h: H<Message>,
  access: Model["assistantAccess"],
) =>
  h.div.attr("data-help-page", kind).children(
    navBar(
      {
        title: kind === "About" ? "About Optio" : "Use with AI",
        back: { label: "Settings", href: hrefFor({ _tag: "SettingsTab" }) },
      },
      h,
    ),
    page({}, kind === "About" ? aboutContent(h) : agentContent(access, h), h),
  );
