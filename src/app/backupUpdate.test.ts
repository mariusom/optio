import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it, vi } from "vitest";

import { init, update } from "../main";
import { Message } from "../messages";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));
// provide self for @livestore/adapter-web shared-worker stub (node env)
(globalThis as unknown as { self?: unknown }).self ??= globalThis;

const start = init(Option.getOrThrow(fromString("https://optio.test/#/settings"))).model;
const names = (result: ReturnType<typeof update>) =>
  (result.commands ?? []).map((command) => command.name);

describe("backup actions", () => {
  it("ignores a second download or restore while one is running", () => {
    const busy = update(start, Message.ClickedDownloadBackup());
    expect(names(busy)).toEqual(["DownloadBackup"]);
    expect(names(update(busy.model, Message.ClickedDownloadBackup()))).toEqual([]);
    expect(names(update(busy.model, Message.ChoseBackupFile()))).toEqual([]);
  });

  it("says a restore is running, then reports it only once saved", () => {
    const restoring = update(start, Message.ChoseBackupFile());
    expect(names(restoring)).toEqual(["RestoreBackup"]);
    expect(restoring.model.backupNotice?.text).toBe(
      "Restoring… keep Optio open until this finishes.",
    );
    const counts = { templates: 1, sessions: 2, skipped: 0 };
    const saved = update(restoring.model, Message.BackupRestored({ ...counts, saved: true }));
    expect(saved.model.backupNotice?.text).toBe("Restored 1 template and 2 sessions.");
    expect(saved.model.backupBusy).toBe(false);
    const slow = update(restoring.model, Message.BackupRestored({ ...counts, saved: false }));
    expect(slow.model.backupNotice?.text).toContain("still saving");
  });
});
