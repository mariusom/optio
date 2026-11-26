import { describe, expect, it, vi } from "vite-plus/test";

import { init, update, type Model } from "../main";
import { Message } from "../messages";
import { TemplateEditor } from "./routes";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));
// Leaving the template editor through any internal link (sidebar, tab bar,
// back) must ask before discarding unsaved changes, then honour the link.

const baseModel = (): Model => init("#/templates/t1").model;

const editor = (name: string): NonNullable<Model["editor"]> => ({
  id: "t1",
  name,
  isDefault: false,
  fields: [],
  original: { name: "Study", isDefault: false, fields: [] },
  isSaving: false,
  showAddField: false,
  editingFieldId: null,
  draft: null,
  pendingDiscard: false,
});

const internalLink = (href: string) =>
  Message.ClickedLink({ url: `http://localhost/optio/${href}` });

describe("template editor navigation guard", () => {
  it("asks before leaving with unsaved changes and keeps the destination", () => {
    const model: Model = {
      ...baseModel(),
      route: TemplateEditor({ templateId: "t1" }),
      editor: editor("Renamed study"),
    };
    const next = update(model, internalLink("#/settings"));
    expect(next.commands ?? []).toHaveLength(0);
    expect(next.model.editor?.pendingDiscard).toBe(true);
    expect(next.model.pendingNavigationUrl).toContain("#/settings");

    const confirmed = update(next.model, Message.ConfirmedDiscard());
    expect(confirmed.model.pendingNavigationUrl).toBeNull();
    expect(confirmed.model.editor).toBeNull();
    expect(confirmed.commands).toEqual([
      expect.objectContaining({
        name: "NavigateInternal",
        args: { url: "http://localhost/optio/#/settings" },
      }),
    ]);

    const canceled = update(next.model, Message.CanceledDiscard());
    expect(canceled.model.pendingNavigationUrl).toBeNull();
    expect(canceled.model.editor?.pendingDiscard).toBe(false);
    expect(canceled.commands ?? []).toEqual([]);
  });

  it("navigates straight away when nothing changed", () => {
    const model: Model = {
      ...baseModel(),
      route: TemplateEditor({ templateId: "t1" }),
      editor: editor("Study"),
    };
    const next = update(model, internalLink("#/settings"));
    expect(next.model.pendingNavigationUrl).toBeNull();
    expect(next.model.editor?.pendingDiscard).toBe(false);
    expect(next.commands).toEqual([
      expect.objectContaining({
        name: "NavigateInternal",
        args: { url: "http://localhost/optio/#/settings" },
      }),
    ]);
  });
});
