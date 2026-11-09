import { describe, expect, it } from 'vitest';
import { ObjectPool } from '../src/core/ObjectPool';

describe('ObjectPool', () => {
  it('應能依序借出所有容量，容量耗盡時回傳 -1 且不拋出例外', () => {
    const capacity = 10;
    const pool = new ObjectPool(capacity, (i) => ({ id: i }));

    expect(pool.getActiveCount()).toBe(0);

    const acquired: number[] = [];
    for (let i = 0; i < capacity; i++) {
      const idx = pool.acquire();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(capacity);
      expect(acquired.includes(idx)).toBe(false);
      acquired.push(idx);
    }

    expect(pool.getActiveCount()).toBe(capacity);

    // 容量耗盡
    const overflowIdx = pool.acquire();
    expect(overflowIdx).toBe(-1);
  });

  it('釋放索引後可再次借用，且禁止重複釋放同一索引', () => {
    const pool = new ObjectPool(5, (i) => ({ id: i }));
    const idx0 = pool.acquire();
    const idx1 = pool.acquire();
    expect(idx1).toBeGreaterThanOrEqual(0);

    expect(pool.getActiveCount()).toBe(2);

    // 正常釋放 idx0
    const ok = pool.release(idx0);
    expect(ok).toBe(true);
    expect(pool.getActiveCount()).toBe(1);

    // 重複釋放同一索引應失敗
    const dupOk = pool.release(idx0);
    expect(dupOk).toBe(false);
    expect(pool.getActiveCount()).toBe(1);

    // 釋放無效索引應失敗
    expect(pool.release(-1)).toBe(false);
    expect(pool.release(999)).toBe(false);

    // 再次借出應能取得剛釋放的索引
    const reacquired = pool.acquire();
    expect(reacquired).toBe(idx0);
    expect(pool.getActiveCount()).toBe(2);
  });
});
