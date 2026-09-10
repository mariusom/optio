import { expect, it, vi } from "vitest";
import { Runtime } from "foldkit";
import { Effect, Exit, Schema, Scope } from "effect";
import { createStorePromise } from "@livestore/livestore";
import { makeInMemoryAdapter } from "@livestore/adapter-web";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

import { applicationConfig } from "../application";
import { Model, update } from "../main";
import { Message } from "../messages";
import { getStore } from "../livestore/client";
import { schema } from "../livestore/schema";
import { EndSession } from "../we/features/session/runnerCommands";
import { AgentReply, type AgentAction } from "./actions";
import { connectAgentApplication } from "./connection";
import { makeToolHandlers } from "./tools";
import { registerWebMcp, type ModelContext } from "./webmcp";
import "../index.css";

// Real Foldkit runtime, commands, SQLite queries/materializers, with LiveStore's
// in-memory adapter. This verifies mutations, not worker/OPFS persistence.
it("operates template/field CRUD and the full record → edit → archive → delete workflow", async () => {
  const store = await createStorePromise({
    schema,
    storeId: `agent-test-${crypto.randomUUID()}`,
    adapter: makeInMemoryAdapter(),
  });
  vi.mocked(getStore).mockResolvedValue(store);
  const container = document.createElement("div");
  container.id = `agent-test-${crypto.randomUUID()}`;
  document.body.append(container);
  const handle = Runtime.embed(Runtime.makeApplication({ ...applicationConfig, container }));
  const confirm = vi.fn(() => true);
  const connection = connectAgentApplication(handle.ports, confirm);
  const tools = new Map<string, Parameters<ModelContext["registerTool"]>[0]>();
  const scope = await Effect.runPromise(Scope.make());
  await Effect.runPromise(
    registerWebMcp(
      {
        registerTool: async (tool, { signal }) => {
          tools.set(tool.name, tool);
          signal.addEventListener("abort", () => tools.delete(tool.name), { once: true });
        },
      },
      makeToolHandlers(getStore, connection),
    ).pipe(Effect.provideService(Scope.Scope, scope)),
  );
  const invoke = async (name: string, input: unknown) =>
    tools.get(name)!.execute(input, { signal: new AbortController().signal });
  const read = async () => {
    const reply = Schema.decodeUnknownSync(AgentReply)(await invoke("optio_get_state", {}));
    return Schema.decodeUnknownSync(Model)(reply.state);
  };
  const act = async (action: AgentAction) => {
    const reply = Schema.decodeUnknownSync(AgentReply)(await invoke("optio_action", { action }));
    expect(reply.error).toBeNull();
    return reply;
  };
  const wait = async (predicate: (state: Model) => boolean) => {
    await expect.poll(async () => predicate(await read()), { timeout: 15_000 }).toBe(true);
    return read();
  };
  const name = `Agent CRUD ${crypto.randomUUID()}`;
  try {
    await wait((s) => s.templates.length > 0);
    await act({ _tag: "Navigate", route: { _tag: "TemplatesTab" } });
    await wait((s) => s.route._tag === "TemplatesTab");
    await act({ _tag: "ClickedNewTemplate" });
    await act({ _tag: "ChangedNewName", text: name });
    await act({ _tag: "ConfirmedCreateTemplate" });
    let state = await wait((s) => s.templates.some((t) => t.name === name));
    const templateId = state.templates.find((t) => t.name === name)!.id;
    await act({ _tag: "ClickedTemplateRow", id: templateId });
    await wait((s) => s.editor?.id === templateId);
    await act({ _tag: "ChangedEditorName", text: `${name} edited` });
    await act({ _tag: "ClickedAddField" });
    await act({ _tag: "ChangedFieldName", text: "Observation" });
    await act({ _tag: "ChangedFieldKind", kind: "textInput" });
    await act({ _tag: "ToggledFieldRequired" });
    await act({ _tag: "ConfirmedSaveField" });
    state = await read();
    expect(state.editor!.fields).toHaveLength(1);
    const fieldId = state.editor!.fields[0].id;
    await act({ _tag: "ClickedEditField", id: fieldId });
    await act({ _tag: "ChangedFieldName", text: "Activity" });
    await act({ _tag: "ConfirmedSaveField" });
    await act({ _tag: "ClickedAddField" });
    await act({ _tag: "ChangedFieldName", text: "Temporary" });
    await act({ _tag: "ConfirmedSaveField" });
    state = await read();
    await act({ _tag: "ClickedDeleteField", id: state.editor!.fields[1].id });
    await act({ _tag: "ClickedSaveTemplate" });
    await wait((s) =>
      s.templates.some(
        (t) => t.id === templateId && t.fieldCount === 1 && t.name.endsWith("edited"),
      ),
    );
    // Hold A's state reply while another connection replaces its pending target.
    // Test both A→B and A→B→A: reusing an old approval must never authorize a write.
    const otherTemplate = (await read()).templates.find((t) => t.id !== templateId)!;
    for (const restoreA of [false, true]) {
      await act({ _tag: "RequestedDeleteTemplate", id: templateId, name: "Ignored" });
      let release: (() => void) | undefined;
      let held = false;
      const raceConfirm = vi.fn(() => true);
      const racing = connectAgentApplication(
        {
          ...handle.ports,
          agentReply: {
            ...handle.ports.agentReply,
            subscribe: (listener) =>
              handle.ports.agentReply.subscribe((reply) => {
                if (!held) {
                  held = true;
                  release = () => listener(reply);
                } else listener(reply);
              }),
          },
        },
        raceConfirm,
      );
      const approval = Effect.runPromise(racing.request({ _tag: "ConfirmedDeleteTemplate" }));
      await vi.waitFor(() => expect(release).toBeDefined());
      await act({ _tag: "RequestedDeleteTemplate", id: otherTemplate.id, name: "Ignored" });
      if (restoreA) await act({ _tag: "RequestedDeleteTemplate", id: templateId, name: "Ignored" });
      release!();
      const rejected = await approval;
      expect(rejected.error).toContain("Confirmation changed");
      expect(rejected.pendingCommands).toBe(0);
      expect(raceConfirm).toHaveBeenCalledWith(expect.stringContaining(`(ID: ${templateId})`));
      expect((await read()).templates.map((t) => t.id)).toEqual(
        expect.arrayContaining([templateId, otherTemplate.id]),
      );
    }
    await act({ _tag: "CanceledDeleteTemplate" });
    await act({ _tag: "Navigate", route: { _tag: "StartTab" } });
    await wait((s) => s.route._tag === "StartTab");
    await act({ _tag: "SelectedTemplate", id: templateId });
    await act({ _tag: "ChangedSessionNameInput", text: name });
    await act({ _tag: "ClickedStartSession" });
    state = await wait((s) => s.runner?.sessionName === name && s.runner.tasks.length === 1);
    const sessionId = state.runner!.sessionId;
    const task = state.runner!.tasks[0];
    const taskFieldId = task.sections[0].id;
    await expect(
      invoke("optio_action", { action: { _tag: "ClickedStartSession" } }),
    ).resolves.toMatchObject({
      isError: true,
      error: { message: expect.stringContaining("already active") },
    });
    await expect(
      invoke("optio_action", {
        action: { _tag: "ChangedFieldValue", taskFieldId: "foreign-field", value: "Invalid" },
      }),
    ).resolves.toMatchObject({
      isError: true,
      error: { message: expect.stringContaining("Select the task") },
    });
    const invalidRecord = await act({ _tag: "ClickedRecord" });
    expect(invalidRecord.pendingCommands).toBe(0);
    expect((await read()).runner!.completedCount).toBe(0);
    await act({ _tag: "ChangedFieldValue", taskFieldId, value: "Observe" });
    state = await wait((s) => s.runner?.tasks[0].sections[0].value === "Observe");
    const firstWrite = state.runner!.tasks[0].sections[0].startDate;
    expect(firstWrite).not.toBeNull();
    await act({ _tag: "ClickedRecord" });
    await wait((s) => s.runner?.completedCount === 1);
    await act({ _tag: "ClickedSelectTask", taskId: task.id });
    await wait((s) => s.runner?.tasks[0].isBeingEdited === true);
    await act({ _tag: "ChangedFieldValue", taskFieldId, value: "Canceled edit" });
    await wait((s) => s.runner?.tasks[0].sections[0].value === "Canceled edit");
    await act({ _tag: "ClickedCancelEdit" });
    state = await wait((s) => s.runner?.tasks[0].isBeingEdited === false);
    expect(state.runner!.tasks[0].sections[0].value).toBe("Observe");
    expect(state.runner!.tasks[0].sections[0].startDate).toBe(firstWrite);
    await act({ _tag: "ClickedSelectTask", taskId: task.id });
    await wait((s) => s.runner?.tasks[0].isBeingEdited === true);
    await act({ _tag: "ChangedFieldValue", taskFieldId, value: "Corrected" });
    await wait((s) => s.runner?.tasks[0].sections[0].value === "Corrected");
    await act({ _tag: "ClickedSaveEdit" });
    state = await wait((s) => s.runner?.tasks[0].isBeingEdited === false);
    expect(state.runner!.tasks[0].sections[0].startDate).toBe(firstWrite);
    await act({ _tag: "ClickedEndSession" });
    await act({ _tag: "ConfirmedEndSession" });
    await wait((s) => s.history.some((s) => s.id === sessionId));
    await wait((s) => s.activeSession === null);
    await expect(
      invoke("optio_action", {
        action: {
          _tag: "Navigate",
          route: { _tag: "SessionRunner", sessionId },
        },
      }),
    ).resolves.toMatchObject({
      isError: true,
      error: { message: expect.stringContaining("Only the active session") },
    });
    // Protect against stale state and direct deep links too, not just agent routes.
    expect(await Effect.runPromise(EndSession({ sessionId }).effect)).toMatchObject({
      _tag: "FailedRunnerOp",
      error: "This session has already ended.",
    });
    expect(await Effect.runPromise(EndSession({ sessionId: "missing" }).effect)).toMatchObject({
      _tag: "FailedRunnerOp",
    });
    expect(await invoke("optio_get_session_summary", { sessionId })).toMatchObject({
      taskCount: 1,
    });
    await act({ _tag: "ClickedHistoryRow", id: sessionId });
    state = await wait((s) => s.selectedHistorySession?.id === sessionId);
    expect(state.selectedHistorySession!.tasks[0].sections[0].value).toBe("Corrected");
    await act({ _tag: "ClickedEditHistoryName" });
    await act({ _tag: "ChangedEditHistoryName", text: `${name} renamed` });
    await act({ _tag: "ConfirmedEditHistoryName" });
    await wait((s) =>
      s.history.some((s) => s.id === sessionId && s.sessionName.endsWith("renamed")),
    );
    await act({ _tag: "ClickedEditHistoryName" });
    await act({ _tag: "ChangedEditHistoryName", text: "" });
    await act({ _tag: "ConfirmedEditHistoryName" });
    await wait((s) => s.history.some((s) => s.id === sessionId && s.sessionName === ""));
    const archiveDisplayName = (await read()).history.find((s) => s.id === sessionId)!.displayName;
    expect(archiveDisplayName).toBe(`${name} edited`);
    await act({ _tag: "Navigate", route: { _tag: "HistoryTab" } });
    await wait((s) => s.route._tag === "HistoryTab");
    await act({ _tag: "RequestedHistoryDelete", id: sessionId, displayName: "Misleading label" });
    expect((await read()).pendingHistoryDelete?.displayName).toBe(archiveDisplayName);
    await expect
      .poll(() => document.querySelector('[role="dialog"]')?.textContent)
      .toContain(archiveDisplayName);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
      "Misleading label",
    );
    confirm.mockReturnValueOnce(false);
    await expect(
      invoke("optio_action", { action: { _tag: "ConfirmedHistoryDelete" } }),
    ).resolves.toEqual({
      isError: true,
      error: { message: "User declined the action." },
    });
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining(`${archiveDisplayName} (ID: ${sessionId})`),
    );
    expect((await read()).history.some((s) => s.id === sessionId)).toBe(true);
    // History keeps its pending ID until the asynchronous delete completes.
    // A consumed approval must nevertheless be unusable a second time.
    const beforeDelete = await read();
    const approvedDelete = Message.AgentRequest({
      requestId: "replay-test",
      action: { _tag: "ConfirmedHistoryDelete" },
      confirmationVersion: beforeDelete.agentConfirmationVersion,
    });
    const first = update(beforeDelete, approvedDelete);
    expect(first.commands).toHaveLength(2); // Delete + reply; do not execute these test commands.
    expect(first.model.pendingHistoryDelete).not.toBeNull();
    const replay = update(first.model, approvedDelete);
    expect(replay.commands).toHaveLength(1); // Reply only, no deletion.
    expect(replay.model).toBe(first.model);
    await act({ _tag: "ConfirmedHistoryDelete" });
    await wait((s) => !s.history.some((s) => s.id === sessionId));
    await act({ _tag: "Navigate", route: { _tag: "TemplatesTab" } });
    await wait((s) => s.route._tag === "TemplatesTab");
    await act({ _tag: "RequestedDeleteTemplate", id: templateId, name: "Misleading label" });
    expect((await read()).pendingDelete?.name).toBe(`${name} edited`);
    await expect
      .poll(() => document.querySelector('[role="dialog"]')?.textContent)
      .toContain(`${name} edited`);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
      "Misleading label",
    );
    await act({ _tag: "ConfirmedDeleteTemplate" });
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining(`${name} edited (ID: ${templateId})`),
    );
    await wait((s) => !s.templates.some((t) => t.id === templateId));
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(document.querySelector(".app-shell main")).not.toBeNull();
    await expect(
      invoke("optio_action", { action: { _tag: "GotTemplates", templates: [] } }),
    ).resolves.toEqual({ isError: true, error: { message: "Invalid tool input." } });
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    handle.dispose();
    await Effect.runPromise(store.shutdown());
    container.remove();
  }
}, 60_000);
