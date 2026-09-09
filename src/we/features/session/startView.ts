import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import {
  FileText,
  Play,
  X,
  confirmSheet,
  groupedList,
  hint,
  icon,
  notice,
  page,
  row,
  statusPill,
  controlRow,
  emptyState,
} from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { nativeSelect } from "@/components/ui/native-select";
import { inputClass, inputLabelClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatDurationHm, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "./startHelpers";
import { displaySessionName, isTemplateMissing } from "./startHelpers";

// ── Resume an interrupted session ─────────────────────────────────────────

const resumeView = (
  active: ActiveSession,
  templates: ReadonlyArray<TemplateSummary>,
  pendingDiscard: boolean,
  h: HtmlBuilder<Message>,
) => {
  const missing = isTemplateMissing(templates, active);
  const name = displaySessionName(active.sessionName, active.templateName);
  const taskCount = `${active.completedCount} task${active.completedCount === 1 ? "" : "s"}`;

  return h.div(
    [h.Class("flex flex-col gap-6")],
    [
      groupedList(
        {
          header: "In progress",
          footer: missing
            ? "This session’s template was deleted. You can still finish and keep what you recorded, or discard it."
            : "Optio kept this session when the app closed. Pick up where you left off.",
        },
        [
          row(
            {
              title: name,
              subtitle: active.templateName,
              trailing: statusPill(
                { tone: missing ? "warning" : "success" },
                [
                  h.span(
                    [
                      h.Class(
                        cn(
                          "size-1.5 rounded-full",
                          missing ? "bg-warning-content" : "bg-success animate-pulse",
                        ),
                      ),
                    ],
                    [],
                  ),
                  h.span([], [taskCount]),
                ],
                h,
              ),
            },
            h,
          ),
          row({ title: "Started", value: formatTimeOnly(active.startedAt) }, h),
          row({ title: "Elapsed", value: formatDurationHm(Date.now() - active.startedAt) }, h),
        ],
        h,
      ),
      h.div(
        [h.Class("flex flex-col gap-2")],
        [
          button(
            {
              size: "lg",
              className: "w-full",
              onClick: Message.ClickedResumeSession(),
              attributes: [h.AriaLabel(missing ? "Finish Session" : "Resume Session")],
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
              attributes: [h.AriaLabel("Discard Session")],
            },
            "Discard session",
            h,
          ),
        ],
      ),
      ...(pendingDiscard
        ? [
            confirmSheet(
              {
                id: "discard-session",
                title: "Discard this session?",
                message: `${taskCount} recorded so far will be deleted. This can’t be undone.`,
                confirmLabel: "Discard",
                confirmAriaLabel: "Confirm discard session",
                cancelAriaLabel: "Cancel discard",
                dismissLabel: "Cancel discarding session",
                destructive: true,
                onConfirm: Message.ConfirmedDiscardSession(),
                onCancel: Message.CanceledDiscardSession(),
              },
              h,
            ),
          ]
        : []),
    ],
  );
};

// ── First run ─────────────────────────────────────────────────────────────

const noTemplatesView = (h: HtmlBuilder<Message>) =>
  emptyState(
    {
      icon: FileText,
      title: "Start with a template",
      description: "A template is the list of things you note down for each task.",
      action: h.a(
        [
          h.Class(buttonClass({ size: "lg" })),
          h.Href(hrefFor({ _tag: "TemplatesTab" })),
          h.AriaLabel("Create Template"),
        ],
        ["Create a template"],
      ),
    },
    h,
  );

// ── New session form ──────────────────────────────────────────────────────

const templatePicker = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedId: string | null,
  h: HtmlBuilder<Message>,
) => {
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
  return nativeSelect(
    {
      id: "study-template",
      label: "Study template",
      wrapperClass: "w-full",
      value: selectedId ?? "",
      onChange: (id) => Message.SelectedTemplate({ id }),
      options: [
        ...(selectedId === null
          ? [h.option([h.Value(""), h.Disabled(true)], ["Choose a template"])]
          : []),
        ...sorted.map((template) =>
          h.option(
            [h.Value(template.id)],
            [`${template.name}${template.isDefault ? " (default)" : ""}`],
          ),
        ),
      ],
    },
    h,
  );
};

const sessionNameField = (placeholderName: string, value: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("group/field flex w-full flex-col gap-1.5")],
    [
      h.label([h.For("session-name"), h.Class(cn(inputLabelClass))], ["Session name"]),
      h.div(
        [h.Class("relative")],
        [
          h.input([
            h.Id("session-name"),
            h.Type("text"),
            h.Class(cn(inputClass, "pr-11")),
            h.Value(value),
            h.Placeholder(placeholderName),
            h.Autocomplete("off"),
            h.Autocapitalize("words"),
            h.EnterKeyHint("go"),
            h.OnInput((text) => Message.ChangedSessionNameInput({ text })),
            h.OnKeyDownPreventDefault((key) =>
              key === "Enter" ? Option.some(Message.ClickedStartSession()) : Option.none(),
            ),
          ]),
          ...(value.length > 0
            ? [
                button(
                  {
                    variant: "ghost",
                    size: "icon",
                    className: "absolute inset-y-0 right-0 my-auto",
                    onClick: Message.ChangedSessionNameInput({ text: "" }),
                    attributes: [h.AriaLabel("Clear session name")],
                  },
                  [icon(h, X, "size-4")],
                  h,
                ),
              ]
            : []),
        ],
      ),
    ],
  );

const newSessionView = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
  placeholderName: string,
  sessionNameInput: string,
  h: HtmlBuilder<Message>,
) => {
  const canStart =
    selectedTemplateId !== null && templates.some((t) => t.id === selectedTemplateId);
  return h.div(
    [h.Class("flex flex-col gap-6")],
    [
      groupedList(
        {
          header: "New session",
          footer: `Leave the name empty to call it “${placeholderName}”.`,
        },
        [
          controlRow([templatePicker(templates, selectedTemplateId, h)], h),
          controlRow([sessionNameField(placeholderName, sessionNameInput, h)], h),
        ],
        h,
      ),
      h.div(
        [h.Class("flex flex-col gap-2")],
        [
          button(
            {
              size: "lg",
              className: "w-full",
              isDisabled: !canStart,
              onClick: Message.ClickedStartSession(),
              attributes: [h.AriaLabel("Start Session")],
            },
            [icon(h, Play, "size-4 fill-current"), "Start session"],
            h,
          ),
          ...(canStart ? [] : [hint("Choose a template to start.", h)]),
        ],
      ),
    ],
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
  readonly lastError?: string | null;
};

export const startView = (model: StartModel, h: HtmlBuilder<Message>) =>
  page(
    {},
    [
      ...(model.lastError ? [notice({ tone: "error", text: model.lastError }, h)] : []),
      model.activeSession !== null
        ? resumeView(model.activeSession, model.templates, model.pendingDiscardSession, h)
        : model.templates.length === 0
          ? noTemplatesView(h)
          : newSessionView(
              model.templates,
              model.selectedTemplateId,
              model.placeholderName,
              model.sessionNameInput,
              h,
            ),
    ],
    h,
  );
