import { describe, it, expect, vi } from "vitest";
import {
  eventMatchesScope,
  publishEvent,
  subscribe,
  type EngramEvent,
} from "./events";

const GLOBAL: Omit<EngramEvent, "ts"> = { type: "controls.changed" };
const ENGRAM_1: Omit<EngramEvent, "ts"> = { type: "presence.changed", engramId: 1 };
const CONV_7: Omit<EngramEvent, "ts"> = { type: "message.created", conversationId: 7 };
const ENGRAM_1_CONV_7: Omit<EngramEvent, "ts"> = {
  type: "artifact.completed",
  engramId: 1,
  conversationId: 7,
};

function stamp(e: Omit<EngramEvent, "ts">): EngramEvent {
  return { ...e, ts: new Date().toISOString() };
}

describe("eventMatchesScope", () => {
  it("global events reach every subscriber regardless of scope", () => {
    expect(eventMatchesScope(stamp(GLOBAL), {})).toBe(true);
    expect(eventMatchesScope(stamp(GLOBAL), { engramId: 1 })).toBe(true);
    expect(eventMatchesScope(stamp(GLOBAL), { conversationId: 7 })).toBe(true);
  });

  it("a subscriber with no scope gets ONLY global events (no cross-scope leak)", () => {
    expect(eventMatchesScope(stamp(ENGRAM_1), {})).toBe(false);
    expect(eventMatchesScope(stamp(CONV_7), {})).toBe(false);
    expect(eventMatchesScope(stamp(ENGRAM_1_CONV_7), {})).toBe(false);
  });

  it("matches on engramId only when the subscriber asked for that engram", () => {
    expect(eventMatchesScope(stamp(ENGRAM_1), { engramId: 1 })).toBe(true);
    expect(eventMatchesScope(stamp(ENGRAM_1), { engramId: 2 })).toBe(false);
    expect(eventMatchesScope(stamp(ENGRAM_1), { conversationId: 7 })).toBe(false);
  });

  it("matches on conversationId only when the subscriber asked for that conversation", () => {
    expect(eventMatchesScope(stamp(CONV_7), { conversationId: 7 })).toBe(true);
    expect(eventMatchesScope(stamp(CONV_7), { conversationId: 8 })).toBe(false);
    expect(eventMatchesScope(stamp(CONV_7), { engramId: 1 })).toBe(false);
  });

  it("a dual-scoped event matches if EITHER key matches the subscriber", () => {
    expect(eventMatchesScope(stamp(ENGRAM_1_CONV_7), { engramId: 1 })).toBe(true);
    expect(eventMatchesScope(stamp(ENGRAM_1_CONV_7), { conversationId: 7 })).toBe(true);
    expect(eventMatchesScope(stamp(ENGRAM_1_CONV_7), { engramId: 2, conversationId: 8 })).toBe(
      false,
    );
  });

  it("treats engramId/conversationId 0 as a real id, not absent", () => {
    const zero = stamp({ type: "presence.changed", engramId: 0 });
    expect(eventMatchesScope(zero, { engramId: 0 })).toBe(true);
    expect(eventMatchesScope(zero, {})).toBe(false);
  });
});

describe("publishEvent + subscribe", () => {
  it("delivers a matching event to a scoped subscriber and stamps ts", () => {
    const seen: EngramEvent[] = [];
    const unsubscribe = subscribe({ conversationId: 7 }, (e) => seen.push(e));
    publishEvent({ type: "message.created", conversationId: 7, data: { id: 1 } });
    unsubscribe();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe("message.created");
    expect(typeof seen[0]?.ts).toBe("string");
  });

  it("does NOT deliver another scope's event (server-side filtering)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe({ conversationId: 7 }, listener);
    publishEvent({ type: "presence.changed", engramId: 99 });
    publishEvent({ type: "message.created", conversationId: 8 });
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it("delivers global events to all subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe({ engramId: 3 }, listener);
    publishEvent({ type: "controls.changed", data: { paused: true } });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    publishEvent({ type: "controls.changed", data: { paused: false } });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
