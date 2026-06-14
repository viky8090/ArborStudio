import { describe, it, expect } from 'vitest';
import { LaunchRunBody, EventFrame } from './index';

describe('contracts', () => {
  it('LaunchRunBody accepts minimal input', () => {
    const r = LaunchRunBody.parse({ goal: 'Test' });
    expect(r.mode).toBe('auto');
    expect(r.maxCycles).toBe(20);
    expect(r.skills).toEqual([]);
  });

  it('EventFrame validates the v field', () => {
    const evt = EventFrame.parse({
      v: 1,
      type: 'run.started',
      ts: Date.now(),
      run_id: 'r_test',
      data: {},
    });
    expect(evt.v).toBe(1);
  });
});
