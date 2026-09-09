import { describe, expect, it } from "@effect/vitest";

import { Machine } from "@typeonce/effect-machine";
import { MachineTest } from "@typeonce/effect-machine/testing";
import { Effect, Schema } from "effect";

const State = Schema.TaggedUnion({
  Running: { count: Schema.Number },
});

const States = Machine.state({
  initial: "Idle",
  states: {
    Idle: {},
    Running: State.cases.Running,
  },
});

const CounterEvent = Machine.eventsFromSchemas(
  Schema.TaggedUnion({
    Start: {},
    Increment: {},
    Stop: {},
  }),
);

const targets = Machine.targets(States);

const Counter = Machine.make({
  id: "Counter",
  root: States,
  events: CounterEvent,
}).handle({
  states: {
    Idle: {
      on: {
        Start: { target: targets.root.Running, from: () => ({ count: 0 }) },
      },
    },
    Running: {
      on: {
        Increment: {
          target: targets.root.Running,
          from: ({ state }) => ({ count: state.count + 1 }),
        },
        Stop: { target: targets.root.Idle },
      },
    },
  },
});

const Emissions = Machine.emittedEventsFromSchemas(
  Schema.TaggedUnion({
    Incremented: { count: Schema.Number },
  }),
);

const Emitter = Machine.make({
  id: "Emitter",
  root: States,
  events: CounterEvent,
  emittedEvents: Emissions,
  branches: {
    running: { next: { target: targets.root.Running } },
  },
}).handle({
  states: {
    Idle: {
      on: {
        Start: {
          branches: "running",
          resolve: ({ select }, enqueue) => {
            enqueue.emit(Emissions.Incremented({ count: 0 }));
            return select.next.from({ count: 0 });
          },
        },
      },
    },
    Running: {
      on: {
        Increment: {
          branches: "running",
          resolve: ({ state, select }, enqueue) => {
            enqueue.emit(Emissions.Incremented({ count: state.count + 1 }));
            return select.next.from({ count: state.count + 1 });
          },
        },
        Stop: { target: targets.root.Idle },
      },
    },
  },
});

describe("effect-machine smoke", () => {
  it.effect("planInitial + plan return emissions", () =>
    Effect.gen(function* () {
      const initial = (yield* Machine.planInitial(Emitter)).state;
      const next = yield* Machine.plan(Emitter, initial, { _tag: "Start" });
      expect(next.next.state.path).toBe("Running");
      expect(next.emittedEvents).toEqual([{ _tag: "Incremented", count: 0 }]);
      const inc = yield* Machine.plan(Emitter, next.next, { _tag: "Increment" });
      expect(inc.emittedEvents).toEqual([{ _tag: "Incremented", count: 1 }]);
      expect(inc.next.state.value).toMatchObject({ count: 1 });
    }),
  );

  it("plans transitions with MachineTest", async () => {
    const trace = await Effect.runPromise(
      MachineTest.run(Counter, {
        events: [{ _tag: "Start" }, { _tag: "Increment" }],
      }),
    );
    const last = trace.final;
    expect(JSON.stringify(last)).toContain('"count":1');
  });

  it("runs a machine with Machine.start", async () => {
    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* Machine.start(Counter);
        yield* ref.send(CounterEvent.Start());
        yield* ref.send(CounterEvent.Increment());
        yield* Effect.sleep("50 millis");
        const s = yield* ref.state;
        yield* ref.stop;
        return s.state.value;
      }),
    );
    expect(state).toMatchObject({ _tag: "Running", count: 1 });
  });
});
