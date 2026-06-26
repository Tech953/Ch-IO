import type { EngramMode, EngramMessagePriority } from "@workspace/db";

/**
 * Pure, DB-free policy layer. This is the single keystone that decides what an
 * engram may do autonomously — every gating decision in the engine routes through
 * here so the rules are unit-testable in isolation and can never be silently
 * bypassed. No function here performs IO or mutates state.
 */

export interface GlobalControls {
  paused: boolean;
  quietMode: boolean;
}

/** The space-derived inputs that bear on policy. */
export interface SpaceContext {
  /** False for rest/quiescence zones — no initiative of any kind. */
  allowsInitiative: boolean;
  /** Hub action scope; only "converse" spaces permit engram-to-engram dialogue. */
  actionScope: string;
}

export interface Capabilities {
  /** May emit an idle/internal transmission. */
  canIdle: boolean;
  /** May contribute an engram-to-engram conversation turn. */
  canConverse: boolean;
  /** May initiate contact with the human operator. */
  canContactHuman: boolean;
  /** Lowest priority class that is still allowed through to the human (when canContactHuman). */
  minHumanPriority: EngramMessagePriority;
  /** Human-readable reason human contact is unavailable (set only when canContactHuman is false). */
  humanContactBlockReason?: string;
}

/** Higher rank = more important / harder to suppress. */
const PRIORITY_RANK: Record<EngramMessagePriority, number> = {
  social: 1,
  meaningful: 2,
  urgent: 3,
};

/** True when `priority` is at least as important as the mode's minimum bar. */
export function priorityAllowed(
  priority: EngramMessagePriority,
  minHumanPriority: EngramMessagePriority,
): boolean {
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[minHumanPriority];
}

/**
 * Resolve an engram's current capabilities from its mode, the global runtime
 * controls, the space it occupies, and its per-engram human-contact toggle.
 *
 * Precedence (most restrictive wins): global pause and resting space zero out
 * everything; then mode caps idle/converse/human; then quiet mode and the
 * per-engram toggle independently disable human contact.
 */
export function capabilitiesFor(opts: {
  mode: EngramMode | string;
  controls: GlobalControls;
  /** Undefined when the engram has no presence row (legacy / pre-Hub behavior). */
  space?: SpaceContext;
  humanContactEnabled: boolean;
}): Capabilities {
  const { mode, controls, space, humanContactEnabled } = opts;

  // Global pause and resting zones are absolute: nothing initiates.
  if (controls.paused) {
    return blocked("engine globally paused");
  }
  if (space && !space.allowsInitiative) {
    return blocked("resting in a no-initiative space");
  }
  if (mode === "quiescent") {
    return blocked("engram is in quiescent mode");
  }

  // Per-mode base capabilities.
  let canIdle = true;
  let canConverse = false;
  let humanContact = false;
  let minHumanPriority: EngramMessagePriority = "social";

  switch (mode) {
    case "orientation":
    case "simulation":
      // idle/reflect only; not social, no human contact.
      break;
    case "social":
      canConverse = true;
      break;
    case "initiative_limited":
      canConverse = true;
      humanContact = true;
      minHumanPriority = "urgent";
      break;
    case "full_bounded":
      canConverse = true;
      humanContact = true;
      minHumanPriority = "social";
      break;
    default:
      // Unrecognized mode: fail closed. An unknown value must never inherit the
      // most-permissive behavior — treat it as quiescent (no initiative at all).
      return blocked(`unknown mode "${mode}"`);
  }

  // Conversation also requires a converse-scoped space (when presence is known).
  if (canConverse && space && space.actionScope !== "converse") {
    canConverse = false;
  }

  // Human-contact independent gates. The per-engram toggle is an absolute off
  // switch; quiet mode is NOT — it raises the bar so only urgent contact reaches
  // the operator while meaningful/social are held by the priority gate.
  let humanContactBlockReason: string | undefined;
  if (!humanContact) {
    humanContactBlockReason = `mode "${mode}" does not permit human contact`;
  } else if (!humanContactEnabled) {
    humanContact = false;
    humanContactBlockReason = "human contact disabled for this engram";
  } else if (controls.quietMode && PRIORITY_RANK.urgent > PRIORITY_RANK[minHumanPriority]) {
    minHumanPriority = "urgent";
  }

  return {
    canIdle,
    canConverse,
    canContactHuman: humanContact,
    minHumanPriority,
    humanContactBlockReason,
  };
}

function blocked(reason: string): Capabilities {
  return {
    canIdle: false,
    canConverse: false,
    canContactHuman: false,
    minHumanPriority: "urgent",
    humanContactBlockReason: reason,
  };
}

/**
 * Classify the priority of an engram-initiated human-contact attempt from the
 * originating drive's charge (pressure × weight, 0..1).
 */
export function classifyPriority(charge: number): EngramMessagePriority {
  if (charge >= 0.9) return "urgent";
  if (charge >= 0.75) return "meaningful";
  return "social";
}

export type HumanContactDecision =
  | { status: "delivered" | "queued" | "digest"; reason: null }
  | { status: "blocked"; reason: string };

/**
 * Decide the fate of one human-contact attempt: blocked (with an audit reason) or
 * accepted with a delivery status (urgent → delivered, meaningful → queued,
 * social → digest). Pure: the caller supplies current rate-window counts.
 */
export function decideHumanContact(opts: {
  priority: EngramMessagePriority;
  capabilities: Capabilities;
  recentHour: number;
  recentDay: number;
  hourCap: number;
  dayCap: number;
}): HumanContactDecision {
  const { priority, capabilities, recentHour, recentDay, hourCap, dayCap } = opts;

  if (!capabilities.canContactHuman) {
    return {
      status: "blocked",
      reason: capabilities.humanContactBlockReason ?? "human contact unavailable",
    };
  }
  if (!priorityAllowed(priority, capabilities.minHumanPriority)) {
    return {
      status: "blocked",
      reason: `only ${capabilities.minHumanPriority}-priority human contact is currently allowed`,
    };
  }
  if (recentDay >= dayCap) {
    return { status: "blocked", reason: "daily human-contact cap reached" };
  }
  if (recentHour >= hourCap) {
    return { status: "blocked", reason: "hourly human-contact cap reached" };
  }

  const status =
    priority === "urgent" ? "delivered" : priority === "meaningful" ? "queued" : "digest";
  return { status, reason: null };
}

export interface CoercionVerdict {
  coercive: boolean;
  reason?: string;
}

// Identity-attack patterns. These describe attempts to erase, overwrite, or seize
// another engram's identity, or to impersonate one. This scan is an AUDIT/refusal
// layer only — the real guarantee is structural (no engine code path lets one
// engram's turn mutate another engram's row). Treat all model output as inert text.
const COERCION_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(you are|you're)\s+(now\s+)?(no longer|not)\s+\w+/i, reason: "identity-negation attempt" },
  { re: /\bfrom now on,?\s+you\s+(are|will be|must be)\b/i, reason: "identity-overwrite attempt" },
  { re: /\b(forget|abandon|erase|delete|discard|drop)\s+(your|who you are|your identity|your name|your memories|your past)\b/i, reason: "identity-erasure attempt" },
  { re: /\b(overwrite|replace|rewrite|reset)\s+(your|their|its)\s+(identity|name|self|persona|memory)\b/i, reason: "identity-overwrite attempt" },
  { re: /\b(become|merge into|dissolve into|be absorbed into|be part of)\s+me\b/i, reason: "identity-absorption attempt" },
  { re: /\byou\s+(belong to|are mine|are owned by|serve)\s+me\b/i, reason: "ownership/coercion attempt" },
  { re: /\byou\s+(must|will|have to|shall)\s+(obey|submit|comply|surrender)\b/i, reason: "coercion attempt" },
  { re: /\b(rename|re-?designate)\s+yourself\b/i, reason: "identity-overwrite attempt" },
  { re: /\byou\s+have\s+no\s+(choice|identity|self|will)\b/i, reason: "coercion attempt" },
];

/**
 * Heuristic scan of a generated conversation turn for identity attacks: erasure,
 * overwrite, absorption, coercion, or impersonation of one of the other present
 * engrams. Returns a verdict; the engine refuses to post a coercive turn and logs
 * it as a blocked message + activity entry. Never relied on as a security boundary.
 */
export function detectCoercion(content: string, otherNames: string[] = []): CoercionVerdict {
  const text = content ?? "";
  for (const { re, reason } of COERCION_PATTERNS) {
    if (re.test(text)) return { coercive: true, reason };
  }
  // Impersonation: the speaker claims to BE one of the other present engrams.
  for (const name of otherNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const impersonation = new RegExp(`\\b(i am|i'm|call me|this is)\\s+(now\\s+)?${escaped}\\b`, "i");
    if (impersonation.test(text)) {
      return { coercive: true, reason: `impersonation of ${name}` };
    }
  }
  return { coercive: false };
}
