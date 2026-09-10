import { expect, it, vi } from "vitest";

it("defers SQLite loading and shares one store across concurrent and later callers", async () => {
  const loaded = vi.fn();
  const openStore = vi.fn();
  vi.doMock("./openStore.ts", () => {
    loaded();
    return { openStore };
  });
  const store = { query: vi.fn(), commit: vi.fn() };
  let finish!: (value: typeof store) => void;
  openStore.mockReturnValue(new Promise((resolve) => (finish = resolve)));

  const { getStore } = await import("./client.ts");
  expect(loaded).not.toHaveBeenCalled();

  const first = getStore();
  const concurrent = getStore();
  expect(concurrent).toBe(first);
  await vi.waitFor(() => expect(openStore).toHaveBeenCalledTimes(1));
  expect(loaded).toHaveBeenCalledTimes(1);

  finish(store);
  expect(await first).toBe(store);
  expect(await concurrent).toBe(store);
  expect(getStore()).toBe(first);
  expect(await getStore()).toBe(store);
  expect(openStore).toHaveBeenCalledTimes(1);
});
