import { describe, expect, it, vi } from "vite-plus/test";

import { init, update } from "../main";
import { Message } from "../messages";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));
const start = {
  ...init("#/start").model,
  sessionNameInput: "Race B",
};

describe("starting while another tab's session is live", () => {
  it("joins it, keeps the typed name, and explains why until dismissed or left", () => {
    const joined = update(
      start,
      Message.SessionStarted({ sessionId: "a", joinedExisting: true }),
    ).model;
    expect(joined.joinedExistingSession).toBe(true);
    expect(joined.sessionNameInput).toBe("Race B");
    expect(update(joined, Message.DismissedJoinedSession()).model.joinedExistingSession).toBe(
      false,
    );
    const left = update(joined, Message.GotRoute({ route: { _tag: "HistoryTab" } })).model;
    expect(left.joinedExistingSession).toBe(false);
  });

  it("starts normally without the notice", () => {
    const started = update(
      start,
      Message.SessionStarted({ sessionId: "b", joinedExisting: false }),
    ).model;
    expect(started.joinedExistingSession).toBe(false);
    expect(started.sessionNameInput).toBe("");
  });
});
