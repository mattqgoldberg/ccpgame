import { describe, expect, it } from 'vitest';
import { dotKinds } from './RequestDots';

describe('request dots', () => {
  it('shows more dots for more traffic, up to a cap', () => {
    expect(dotKinds(0, undefined, 0)).toHaveLength(0);
    expect(dotKinds(3, undefined, 0).length).toBeLessThan(dotKinds(100, undefined, 0).length);
    expect(dotKinds(1_000_000, undefined, 0)).toHaveLength(8);
  });

  it('colors dots by traffic mix', () => {
    const kinds = dotKinds(255, { static: 50, dynamic: 50, junk: 0 }, 0);
    expect(kinds.filter((k) => k === 'static')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'dynamic')).toHaveLength(4);
  });

  it('turns the failing share red', () => {
    const kinds = dotKinds(255, { static: 0, dynamic: 100, junk: 0 }, 0.5);
    expect(kinds).toHaveLength(8);
    expect(kinds.filter((k) => k === 'failed')).toHaveLength(4);
    expect(dotKinds(255, { static: 0, dynamic: 100, junk: 0 }, 1).every((k) => k === 'failed')).toBe(true);
  });
});
