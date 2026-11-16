import { describe, expect, it } from 'vitest';
import {
  STATE_MACHINE_REGISTRY,
  canTransition,
  describeAllStateMachines,
  getStateMeta,
  isTerminalState,
  normalizeState,
  orderStateMachine,
  sendOrderStateMachine,
  validateTransition,
} from './index';
import { STATE_MACHINE_REGISTRY as MOBILE_REGISTRY } from '../../../mobile/src/state-machines';

describe('LinkUp Explicit State Machines', () => {
  it('maintains valid graph integrity across all registered machines', () => {
    for (const [name, machine] of Object.entries(STATE_MACHINE_REGISTRY)) {
      expect(machine.states).toContain(machine.initial);

      for (const state of machine.states) {
        expect(machine.meta[state], `${name}.${state} missing meta`).toBeDefined();
        expect(machine.meta[state].label.length).toBeGreaterThan(0);

        const nextStates = machine.transitions[state];
        expect(Array.isArray(nextStates), `${name}.${state} transitions missing`).toBe(true);
        for (const target of nextStates) {
          expect(
            machine.states,
            `${name}.${state} -> ${target} points to unknown state`,
          ).toContain(target);
        }

        if (machine.meta[state].terminal) {
          expect(
            nextStates.length,
            `Terminal state ${name}.${state} should not have outgoing transitions`,
          ).toBe(0);
        }
      }
    }
  });

  it('normalizes legacy aliases and handles unknown states without throwing', () => {
    expect(normalizeState(orderStateMachine, 'assigned')).toBe('accepted');
    expect(normalizeState(orderStateMachine, 'BROADCAST')).toBe('awaiting_agent');
    expect(normalizeState(sendOrderStateMachine, 'started')).toBe('assigned_rider');
    expect(normalizeState(orderStateMachine, 'non_existent_status')).toBeNull();

    const fallbackMeta = getStateMeta(orderStateMachine, 'custom_legacy_state');
    expect(fallbackMeta.isKnown).toBe(false);
    expect(fallbackMeta.label).toBe('Custom Legacy State');
  });

  it('enforces transition rules and terminal states', () => {
    expect(canTransition(orderStateMachine, 'awaiting_agent', 'accepted')).toBe(true);
    expect(canTransition(orderStateMachine, 'cancelled', 'delivered')).toBe(false);
    expect(isTerminalState(orderStateMachine, 'cancelled')).toBe(true);
    expect(isTerminalState(sendOrderStateMachine, 'delivered')).toBe(true);
    expect(isTerminalState(sendOrderStateMachine, 'finding_rider')).toBe(false);

    const invalid = validateTransition(sendOrderStateMachine, 'delivered', 'pickup');
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('Invalid transition');
  });

  it('provides machine-readable introspection for AX/DX', () => {
    const manifest = describeAllStateMachines();
    expect(manifest.length).toBe(Object.keys(STATE_MACHINE_REGISTRY).length);
    expect(manifest.find((m) => m.id === 'order')?.source.table).toBe('orders');
  });

  it('keeps Web and Mobile state machine registries in 100% parity', () => {
    expect(Object.keys(MOBILE_REGISTRY)).toEqual(Object.keys(STATE_MACHINE_REGISTRY));
    for (const key of Object.keys(STATE_MACHINE_REGISTRY) as Array<
      keyof typeof STATE_MACHINE_REGISTRY
    >) {
      expect(MOBILE_REGISTRY[key].states).toEqual(STATE_MACHINE_REGISTRY[key].states);
      expect(MOBILE_REGISTRY[key].transitions).toEqual(STATE_MACHINE_REGISTRY[key].transitions);
      expect(MOBILE_REGISTRY[key].meta).toEqual(STATE_MACHINE_REGISTRY[key].meta);
    }
  });
});

