/**
 * Lightweight, zero-dependency Finite State Machine engine.
 *
 * Elevates:
 * - UX: Canonical labels, descriptions, tones, and progress steps across Web & Mobile.
 * - DX: Type-safe states, explicit transition graphs, and non-breaking guards.
 * - AX: Machine-readable registry & introspection (`describeStateMachine`) for agents.
 */

export type StateTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export interface StateMeta<TState extends string = string> {
  /** Human-friendly label for UI badges & timelines */
  label: string;
  /** Short timeline/stepper label when space is constrained */
  shortLabel?: string;
  /** Plain-English explanation of what this state means */
  description: string;
  /** Semantic UI tone for consistent badge/status coloring */
  tone: StateTone;
  /** Optional 0-based progression index for linear steppers (-1 for off-track/exception states) */
  stepIndex?: number;
  /** Whether this state represents a terminal end of the lifecycle */
  terminal?: boolean;
  /** Optional domain flags (e.g. canCancel, isActiveDelivery, requiresAction) */
  flags?: Record<string, boolean>;
  /** Optional legacy/alias raw strings that normalize to this canonical state */
  aliases?: readonly string[];
  /** Explicit next states (duplicated on transition map for quick meta lookup) */
  next?: readonly TState[];
}

export interface StateMachineDefinition<
  TName extends string,
  TState extends string,
> {
  /** Unique machine identifier */
  id: TName;
  /** Human & agent-readable domain summary */
  description: string;
  /** Backing database table and column (for AX/DX traceability) */
  source: {
    table: string;
    column: string;
  };
  /** Initial state when entity is created */
  initial: TState;
  /** Ordered canonical states */
  states: readonly TState[];
  /** Directed graph of valid state transitions */
  transitions: Record<TState, readonly TState[]>;
  /** UX & domain metadata per state */
  meta: Record<TState, StateMeta<TState>>;
}

export function defineStateMachine<
  TName extends string,
  TState extends string,
>(
  definition: StateMachineDefinition<TName, TState>,
): StateMachineDefinition<TName, TState> {
  return definition;
}

/**
 * Normalizes a raw/legacy status string into a canonical state if known,
 * or returns `null` if unrecognized (never throws).
 */
export function normalizeState<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  rawState: string | null | undefined,
): TState | null {
  if (!rawState) return null;
  const normalized = rawState.trim().toLowerCase();
  if ((machine.states as readonly string[]).includes(normalized)) {
    return normalized as TState;
  }
  for (const state of machine.states) {
    const aliases = machine.meta[state]?.aliases;
    if (aliases?.some((a) => a.toLowerCase() === normalized)) {
      return state;
    }
  }
  return null;
}

/**
 * Checks whether transitioning from `from` to `to` is valid in the machine.
 */
export function canTransition<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  from: string | null | undefined,
  to: TState,
): boolean {
  const canonicalFrom = normalizeState(machine, from);
  if (!canonicalFrom) return false;
  return machine.transitions[canonicalFrom]?.includes(to) ?? false;
}

/**
 * Returns the list of valid next states from the current state.
 */
export function getNextStates<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  current: string | null | undefined,
): readonly TState[] {
  const canonical = normalizeState(machine, current);
  if (!canonical) return [];
  return machine.transitions[canonical] ?? [];
}

/**
 * Returns true if the state has no valid outgoing transitions.
 */
export function isTerminalState<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  state: string | null | undefined,
): boolean {
  const canonical = normalizeState(machine, state);
  if (!canonical) return false;
  return (
    Boolean(machine.meta[canonical]?.terminal) ||
    (machine.transitions[canonical]?.length ?? 0) === 0
  );
}

/**
 * Retrieves UX metadata for any raw state with a safe fallback so UI never crashes
 * on unexpected or legacy DB values.
 */
export function getStateMeta<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  rawState: string | null | undefined,
): StateMeta<TState> & { state: TState | string; isKnown: boolean } {
  const canonical = normalizeState(machine, rawState);
  if (canonical) {
    return {
      ...machine.meta[canonical],
      state: canonical,
      isKnown: true,
    };
  }
  const fallbackLabel = rawState
    ? rawState.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';
  return {
    state: rawState ?? 'unknown',
    isKnown: false,
    label: fallbackLabel,
    shortLabel: fallbackLabel,
    description: `Unrecognized ${machine.id} state: ${rawState ?? 'null'}`,
    tone: 'neutral',
    stepIndex: -1,
    terminal: false,
  };
}

/**
 * Non-breaking transition validator for DX/AX diagnostics.
 * Returns `{ valid, reason }` instead of throwing unless `strict: true` is passed.
 */
export function validateTransition<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
  from: string | null | undefined,
  to: TState,
  options?: { strict?: boolean },
): { valid: boolean; reason?: string } {
  const canonicalFrom = normalizeState(machine, from);
  if (!canonicalFrom) {
    const reason = `[${machine.id}] Unknown source state "${from}" -> "${to}"`;
    if (options?.strict) throw new Error(reason);
    return { valid: false, reason };
  }
  if (!machine.transitions[canonicalFrom].includes(to)) {
    const allowed = machine.transitions[canonicalFrom].join(', ') || 'none (terminal)';
    const reason = `[${machine.id}] Invalid transition "${canonicalFrom}" -> "${to}". Allowed: ${allowed}`;
    if (options?.strict) throw new Error(reason);
    return { valid: false, reason };
  }
  return { valid: true };
}

/**
 * Machine-readable summary for AI agents (AX) and developer docs (DX).
 */
export function describeStateMachine<TName extends string, TState extends string>(
  machine: StateMachineDefinition<TName, TState>,
) {
  return {
    id: machine.id,
    description: machine.description,
    source: machine.source,
    initial: machine.initial,
    states: machine.states.map((s) => ({
      state: s,
      label: machine.meta[s].label,
      tone: machine.meta[s].tone,
      terminal: isTerminalState(machine, s),
      allowedNext: machine.transitions[s],
      flags: machine.meta[s].flags ?? {},
    })),
  };
}
