import type { HtmlBuilder } from "foldkit/html";
import { controlRow, groupedList, navBar, notice, page, row } from "@/components/app";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import { hrefFor } from "../../routes";
import { version } from "../../../../package.json";

export const templatePrompt = `Help me create a template for Optio: https://mariusom.github.io/optio/
Read its guide: https://mariusom.github.io/optio/agent-guide.md

I want to study [describe the work]. Suggest questions and choices, then review the template with me. If you have an authorized WebMCP connection to my Optio tab, create it after I approve; otherwise, give me the questions to add manually.`;

export type PromptCopyStatus = "idle" | "copying" | "copied" | "failed";

export const infoPage = (
  kind: "AgentHelp" | "About",
  h: HtmlBuilder<Message>,
  copyStatus: PromptCopyStatus = "idle",
) =>
  h.div(
    [h.DataAttribute("help-page", kind)],
    [
      navBar(
        {
          title: kind === "About" ? "About Optio" : "Use with AI",
          back: { label: "Settings", href: hrefFor({ _tag: "SettingsTab" }) },
        },
        h,
      ),
      page(
        { className: "pt-6" },
        kind === "About"
          ? [
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
                      attributes: [h.Target("_blank"), h.Rel("noopener noreferrer")],
                      subtitle: "Opens in a new tab",
                    },
                    h,
                  ),
                  row(
                    {
                      title: "MIT licence",
                      href: "https://github.com/mariusom/optio/blob/main/LICENSE",
                      attributes: [h.Target("_blank"), h.Rel("noopener noreferrer")],
                      subtitle: "Opens in a new tab",
                    },
                    h,
                  ),
                  row(
                    {
                      title: "Third-party notices",
                      href: `${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`,
                      attributes: [h.Target("_blank"), h.Rel("noopener noreferrer")],
                      subtitle: "Opens in a new tab",
                    },
                    h,
                  ),
                ],
                h,
              ),
            ]
          : [
              groupedList(
                {
                  header: "Create a template with AI",
                  footer:
                    "Paste this into Claude, ChatGPT or Gemini and replace [describe the work] with your study. Sharing the URL does not grant access to your local studies.",
                },
                [
                  controlRow(
                    [
                      h.p(
                        [
                          h.Class(
                            "whitespace-pre-wrap break-words text-sm leading-relaxed select-text",
                          ),
                        ],
                        [templatePrompt],
                      ),
                      button(
                        {
                          onClick: Message.ClickedCopyTemplatePrompt(),
                          isDisabled: copyStatus === "copying" || copyStatus === "copied",
                          className: "mt-4 self-start min-h-11",
                        },
                        copyStatus === "copied"
                          ? "Copied"
                          : copyStatus === "copying"
                            ? "Copying…"
                            : "Copy prompt",
                        h,
                      ),
                      h.p(
                        [
                          h.Role("status"),
                          h.AriaLive("polite"),
                          h.Class("text-sm text-muted-foreground"),
                        ],
                        [
                          copyStatus === "failed"
                            ? "Couldn’t copy. Select the prompt above and copy it manually, or try again."
                            : copyStatus === "copied"
                              ? "Prompt copied to clipboard."
                              : "",
                        ],
                      ),
                    ],
                    h,
                  ),
                ],
                h,
              ),
              h.details(
                [],
                [
                  h.summary(
                    [
                      h.Class(
                        "min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                      ),
                    ],
                    ["Connect directly with WebMCP (experimental)"],
                  ),
                  h.div(
                    [h.Class("flex flex-col gap-6 pt-4")],
                    [
                      notice(
                        {
                          text: "Optio offers experimental WebMCP tools for assistants in this browser tab. Access is off by default.",
                        },
                        h,
                      ),
                      groupedList(
                        {
                          header: "Claude, ChatGPT or Gemini?",
                          footer:
                            "WebMCP is not a remote MCP server. Pasting Optio’s URL into a connector does not connect your studies.",
                        },
                        [
                          row(
                            {
                              title: "Claude & ChatGPT",
                              value:
                                "Use an assistant/browser integration that explicitly supports WebMCP in your open Optio tab. A normal chat or MCP connector alone is not enough.",
                              wrap: true,
                            },
                            h,
                          ),
                          row(
                            {
                              title: "Gemini",
                              value:
                                "Google’s WebMCP inspector can test tools with Gemini. This is separate from Gemini chat and Gemini in Chrome.",
                              wrap: true,
                            },
                            h,
                          ),
                          row(
                            {
                              title: "Browser setup & inspector",
                              href: "https://developer.chrome.com/docs/ai/webmcp",
                              attributes: [h.Target("_blank"), h.Rel("noopener noreferrer")],
                              subtitle: "Opens in a new tab",
                            },
                            h,
                          ),
                        ],
                        h,
                      ),
                      groupedList(
                        {
                          header: "Connect in a compatible browser",
                          footer:
                            "To turn access off, remove ?agentTools=1 from the address and reload. Finish recording or save drafts before reloading.",
                        },
                        [
                          row(
                            {
                              title: "1. Open Optio with ?agentTools=1",
                              value:
                                "Add it before the # in the address, then reload. For example: /optio/?agentTools=1#/templates",
                              wrap: true,
                            },
                            h,
                          ),
                          row(
                            {
                              title: "2. Accept the browser confirmation",
                              value:
                                "Only approve an assistant you trust. No confirmation? Your browser may not support document.modelContext. No tools are registered without support and consent.",
                              wrap: true,
                            },
                            h,
                          ),
                          row(
                            {
                              title: "3. Ask your connected assistant",
                              value:
                                "“Read Optio’s agent guide, then use its WebMCP tools to create the template we agreed on. Check that it saved.”",
                              wrap: true,
                            },
                            h,
                          ),
                        ],
                        h,
                      ),
                      notice(
                        {
                          tone: "warning",
                          text: "Access allows reading, changing and deleting studies. Your assistant provider may receive study data. Deletion still requires a separate human confirmation.",
                        },
                        h,
                      ),
                      groupedList(
                        {
                          header: "For agents",
                          footer:
                            "Start with optio_get_state. Use registered schemas; check state after writes. Never approve consent on the user’s behalf.",
                        },
                        [
                          row(
                            {
                              title: "Agent guide",
                              href: `${import.meta.env.BASE_URL}agent-guide.md`,
                              attributes: [h.Target("_blank"), h.Rel("noopener noreferrer")],
                              subtitle: "Opens in a new tab",
                            },
                            h,
                          ),
                        ],
                        h,
                      ),
                    ],
                  ),
                ],
              ),
            ],
        h,
      ),
    ],
  );
