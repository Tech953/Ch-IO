import { describe, it, expect } from "vitest";
import { spaceAllowsInitiative, statusForSpace, describeMovement } from "./hub";

describe("spaceAllowsInitiative", () => {
  it("mirrors the space's allowsInitiative flag", () => {
    expect(spaceAllowsInitiative({ allowsInitiative: true })).toBe(true);
    expect(spaceAllowsInitiative({ allowsInitiative: false })).toBe(false);
  });
});

describe("statusForSpace", () => {
  it("is active in an initiative-allowing space", () => {
    expect(statusForSpace({ allowsInitiative: true })).toBe("active");
  });

  it("is resting in a rest/quiescence (no-initiative) space", () => {
    expect(statusForSpace({ allowsInitiative: false })).toBe("resting");
  });
});

describe("describeMovement — activity classification", () => {
  const commons: { name: string; allowsInitiative: boolean } = {
    name: "The Commons",
    allowsInitiative: true,
  };
  const archive = { name: "The Archive", allowsInitiative: true };
  const rest = { name: "Quiescence Hollow", allowsInitiative: false };

  it("classifies a first placement (no previous space) as enter", () => {
    const { kind, summary } = describeMovement("Arezo", commons, null);
    expect(kind).toBe("enter");
    expect(summary).toContain("Arezo");
    expect(summary).toContain("The Commons");
  });

  it("classifies moving into a rest zone as rest", () => {
    const { kind, summary } = describeMovement("Arezo", rest, commons);
    expect(kind).toBe("rest");
    expect(summary).toContain("rest");
    expect(summary).toContain("Quiescence Hollow");
  });

  it("classifies leaving a rest zone as wake", () => {
    const { kind, summary } = describeMovement("Arezo", commons, rest);
    expect(kind).toBe("wake");
    expect(summary).toContain("woke");
    expect(summary).toContain("Quiescence Hollow");
    expect(summary).toContain("The Commons");
  });

  it("classifies a normal space-to-space move as move", () => {
    const { kind, summary } = describeMovement("Arezo", archive, commons);
    expect(kind).toBe("move");
    expect(summary).toContain("The Commons");
    expect(summary).toContain("The Archive");
  });

  it("prefers rest over wake when moving from one rest zone to another", () => {
    const otherRest = { name: "Stillwell", allowsInitiative: false };
    const { kind } = describeMovement("Arezo", otherRest, rest);
    expect(kind).toBe("rest");
  });
});
