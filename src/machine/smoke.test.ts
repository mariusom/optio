import { describe, expect, it } from "vitest";

import { Machine } from "@typeonce/effect-machine";
import { MachineTest } from "@typeonce/effect-machine/testing";
import { Effect, Schema } from "effect";

const State = Schema.TaggedUnion({
  Running: { count: Schema.Number },
});

const States = Machine.states({
  Idle: {},
  Running: State.cases.Running,
});

const CounterEvent = Machine.events(
  Schema.TaggedUnion({
    Start: {},
    Increment: {},
    Stop: {},
  }),
);

const Counter = Machine.make({
  id: "Counter",
  states: States.states,
  events: CounterEvent,
  initial: (to) => to.Idle(),
}).handle({
  Idle: {
    on: {
      Start: (to) => to.full.Running().resolve(({ target }) => target.from({ count: 0 })),
    },
  },
  Running: {
    on: {
      Increment: (to) =>
        to.full.Running().resolve(({ state, target }) => target.from({ count: state.count + 1 })),
      Stop: (to) => to.full.Idle(),
    },
  },
});

const Emissions = Machine.emittedEvents(
  Schema.TaggedUnion({
    Incremented: { count: Schema.Number },
  }),
);

const Emitter = Machine.make({
  id: "Emitter",
  states: States.states,
  events: CounterEvent,
  emittedEvents: Emissions,
  initial: (to) => to.Idle(),
}).handle({
  Idle: {
    on: {
      Start: (to) =>
        to.full.Running().resolve(({ target }, enqueue) => {
          enqueue.emit(Emissions.Incremented({ count: 0 }));
          return target.from({ count: 0 });
        }),
    },
  },
  Running: {
    on: {
      Increment: (to) =>
        to.full.Running().resolve(({ state, target }, enqueue) => {
          enqueue.emit(Emissions.Incremented({ count: state.count + 1 }));
          return target.from({ count: state.count + 1 });
        }),
      Stop: (to) => to.full.Idle(),
    },
  },
});

describe("effect-machine smoke", () => {
  it("planInitial + plan are runSync-able and return emissions", () => {
    const initial = Effect.runSync(Machine.planInitial(Emitter)).state;
    const next = Effect.runSync(Machine.plan(Emitter, initial, { _tag: "Start" }));
    expect(next.next.path).toBe("Running");
    expect(next.emittedEvents).toEqual([{ _tag: "Incremented", count: 0 }]);
    const inc = Effect.runSync(Machine.plan(Emitter, next.next, { _tag: "Increment" }));
    expect(inc.emittedEvents).toEqual([{ _tag: "Incremented", count: 1 }]);
    expect(inc.next.value).toMatchObject({ count: 1 });
  });

  it("plans transitions with MachineTest", async () => {
    const trace = await Effect.runPromise(
      MachineTest.run(Counter, {
        events: [{ _tag: "Start" }, { _tag: "Increment" }],
      }),
    );
    const last = trace.final;
    console.log("LAST:", JSON.stringify(last));
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
        return s.value;
      }),
    );
    expect(state).toMatchObject({ _tag: "Running", count: 1 });
  });
});
