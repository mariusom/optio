import { Array, Order, pipe, String } from "effect";
import type { H } from "@/lib/view";

import {
  FileText,
  Play,
  X,
  groupedList,
  hint,
  icon,
  notice,
  page,
  row,
  statusPill,
  emptyState,
  confirmSheet,
} from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { nativeSelect } from "@/components/ui/native-select";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatDurationHm, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "./startHelpers";
import { displaySessionName, isTemplateMissing } from "./startHelpers";

// ── Resume an interrupted session ─────────────────────────────────────────

const resumeView = (
  options: Readonly<{
    active: ActiveSession;
    templates: ReadonlyArray<TemplateSummary>;
    pendingDiscard: boolean;
    /** Ticked Model time, not the clock: views render time from the Model. */
    now: number;
  }>,
  h: H<Message>,
) => {
  const { active, templates, pendingDiscard, now } = options;
  const missing = isTemplateMissing(templates, active);
  const name = displaySessionName(active.sessionName, active.templateName);
  const taskCount = `${active.completedCount} task${active.completedCount === 1 ? "" : "s"}`;

  return h.div.class("flex flex-col gap-6").children(
    groupedList(
      {
        header: "In progress",
        footer: missing
          ? "This session’s template was deleted. You can still finish and keep what you recorded, or discard it."
          : "This session is still open. Pick up where you left off.",
      },
      [
        row(
          {
            title: name,
            subtitle: active.templateName,
            trailing: statusPill(
              { tone: missing ? "warning" : "success" },
              [
                h.span.class(
                  cn(
                    "size-1.5 rounded-full",
                    missing ? "bg-warning-content" : "bg-success animate-pulse",
                  ),
                ),
                h.span.children(taskCount),
              ],
              h,
            ),
          },
          h,
        ),
        row({ title: "Started", value: formatTimeOnly(active.startedAt) }, h),
        row({ title: "Elapsed", value: formatDurationHm(now - active.startedAt) }, h),
      ],
      h,
    ),
    h.div.class("flex flex-col gap-2").children(
      button(
        {
          size: "lg",
          className: "w-full",
          onClick: Message.ClickedResumeSession(),
          attrs: { "aria-label": missing ? "Finish Session" : "Resume Session" },
        },
        [icon(h, Play, "size-4 fill-current"), missing ? "Finish session" : "Resume session"],
        h,
      ),
      button(
        {
          variant: "destructive",
          size: "lg",
          className: "w-full",
          onClick: Message.ClickedDiscardSession(),
          attrs: { "aria-label": "Discard Session" },
        },
        "Discard session",
        h,
      ),
    ),
    pendingDiscard
      ? [
          confirmSheet(
            {
              id: "discard-session",
              title: "Discard this session?",
              message: `${taskCount} recorded so far will be deleted. This can’t be undone.`,
              confirmLabel: "Discard",
              confirmAriaLabel: "Confirm discard session",
              cancelAriaLabel: "Cancel discard",
              destructive: true,
              onConfirm: Message.ConfirmedDiscardSession(),
              onCancel: Message.CanceledDiscardSession(),
            },
            h,
          ),
        ]
      : [],
  );
};

// ── First run ─────────────────────────────────────────────────────────────

const noTemplatesView = (h: H<Message>) =>
  emptyState(
    {
      icon: FileText,
      title: "Start with a template",
      description: "A template is the list of things you note down for each task.",
      action: h.a
        .class(buttonClass({ size: "lg" }))
        .attr("href", hrefFor({ _tag: "TemplatesTab" }))
        .attr("aria-label", "Create Template")
        .children("Create a template"),
    },
    h,
  );

// ── New session form ──────────────────────────────────────────────────────

const byName = Order.mapInput(
  Order.make<string>((a, b) => pipe(a, String.localeCompare(b))),
  (template: TemplateSummary) => template.name,
);

const templatePicker = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedId: string | null,
  h: H<Message>,
) => {
  const sorted = Array.sort(templates, byName);
  return nativeSelect(
    {
      id: "study-template",
      label: "Study template",
      wrapperClass: "[&>[data-slot=native-select-wrapper]]:w-full",
      value: selectedId ?? "",
      onChange: (id) => Message.SelectedTemplate({ id }),
      options: [
        ...(selectedId === null
          ? [h.option.attr("value", "").disabled(true).children("Choose a template")]
          : []),
        // The default template is preselected; a suffix would truncate on phones.
        ...Array.map(sorted, (template) =>
          h.option.attr("value", template.id).children(template.name),
        ),
      ],
    },
    h,
  );
};

const sessionNameField = (placeholderName: string, value: string, h: H<Message>) =>
  h.div.class(cn("group/field w-full", inlineFieldClass)).children(
    h.label.attr("for", "session-name").class(cn(inputLabelClass)).children("Session name"),
    h.div.class("relative").children(
      h.input
        .id("session-name")
        .attr("type", "text")
        .class(cn(inputClass, "pr-11"))
        .value(value)
        .attr("placeholder", placeholderName)
        .attr("autocomplete", "off")
        .attr("autocapitalize", "words")
        .attr("enterkeyhint", "go")
        .on("input", ({ value: text }) => Message.ChangedSessionNameInput({ text }))
        .on("keydown", ({ key }) => (key === "Enter" ? Message.ClickedStartSession() : undefined), {
          preventDefault: true,
        }),
      value.length > 0
        ? [
            button(
              {
                variant: "ghost",
                size: "icon",
                className: "absolute inset-y-0 right-0 my-auto",
                onClick: Message.ChangedSessionNameInput({ text: "" }),
                attrs: { "aria-label": "Clear session name" },
              },
              [icon(h, X, "size-4")],
              h,
            ),
          ]
        : [],
    ),
  );

const newSessionView = (
  options: Readonly<{
    templates: ReadonlyArray<TemplateSummary>;
    selectedTemplateId: string | null;
    placeholderName: string;
    sessionNameInput: string;
  }>,
  h: H<Message>,
) => {
  const { templates, selectedTemplateId, placeholderName, sessionNameInput } = options;
  const canStart =
    selectedTemplateId !== null && Array.some(templates, (t) => t.id === selectedTemplateId);
  return h.div.class("flex flex-col gap-6").children(
    groupedList(
      {
        header: "New session",
        footer: `Leave the name empty to call it “${placeholderName}”.`,
        surface: "plain",
        className: "gap-4 divide-y-0",
      },
      [
        templatePicker(templates, selectedTemplateId, h),
        sessionNameField(placeholderName, sessionNameInput, h),
      ],
      h,
    ),
    h.div.class("flex flex-col gap-2").children(
      button(
        {
          size: "lg",
          className: "w-full",
          isDisabled: !canStart,
          onClick: Message.ClickedStartSession(),
          attrs: { "aria-label": "Start Session" },
        },
        [icon(h, Play, "size-4 fill-current"), "Start session"],
        h,
      ),
      canStart ? [] : [hint("Choose a template to start.", h)],
    ),
  );
};

// ── Public entry ──────────────────────────────────────────────────────────

type StartModel = {
  readonly templates: ReadonlyArray<TemplateSummary>;
  readonly selectedTemplateId: string | null;
  readonly sessionNameInput: string;
  readonly placeholderName: string;
  readonly activeSession: ActiveSession | null;
  readonly pendingDiscardSession: boolean;
  readonly now: number;
  readonly lastError?: string | null;
};

export const startView = (model: StartModel, h: H<Message>) =>
  page(
    {},
    [
      ...(model.lastError !== undefined && model.lastError !== null && model.lastError !== ""
        ? [notice({ tone: "error", text: model.lastError }, h)]
        : []),
      model.activeSession !== null
        ? resumeView(
            {
              active: model.activeSession,
              templates: model.templates,
              pendingDiscard: model.pendingDiscardSession,
              now: model.now,
            },
            h,
          )
        : model.templates.length === 0
          ? noTemplatesView(h)
          : newSessionView(
              {
                templates: model.templates,
                selectedTemplateId: model.selectedTemplateId,
                placeholderName: model.placeholderName,
                sessionNameInput: model.sessionNameInput,
              },
              h,
            ),
      ...(model.activeSession === null
        ? [
            h.a
              .class(
                buttonClass({
                  variant: "link",
                  className: "min-h-11 self-center text-muted-foreground",
                }),
              )
              .attr("href", hrefFor({ _tag: "AgentHelp" }))
              .children("Use with AI"),
          ]
        : []),
    ],
    h,
  );
