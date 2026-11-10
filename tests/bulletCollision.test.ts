import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ShapeSystem } from '../src/systems/ShapeSystem';

describe('Bullet-vs-Bullet Collision Physics (M8 Phase 2)', () => {
  let pool: ObjectPool<Bullet>;
  let collisionSystem: CollisionSystem;
  let shapeSystem: ShapeSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    pool = new ObjectPool<Bullet>(100, () => new Bullet());
    collisionSystem = new CollisionSystem();
    shapeSystem = new ShapeSystem();
    eventBus = new EventBus();
  });

  it('should ignore bullets belonging to the same ownerId', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // 同一主人 (ownerId = 1) 發射兩顆重疊子彈
    bA.init(idxA, 1, 100, 100, 10, 0, 9, 2, 7);
    bB.init(idxB, 1, 105, 100, 10, 0, 9, 2, 7);

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(bA.active).toBe(true);
    expect(bB.active).toBe(true);
    expect(bA.hp).toBe(2);
    expect(bB.hp).toBe(2);
    expect(collisionSystem.bulletClashCount).toBe(0);
  });

  it('should simultaneously annihilate two symmetric basic bullets head-on', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // 兩顆 Basic 子彈 (hp=2, dmg=7) 對撞
    bA.init(idxA, 1, 100, 100, 12, 0, 9, 2, 7);
    bB.init(idxB, 2, 110, 100, -12, 0, 9, 2, 7);

    let sparkCount = 0;
    eventBus.onBulletHit(() => {
      sparkCount++;
    });

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(collisionSystem.bulletClashCount).toBe(1);
    expect(sparkCount).toBe(1);
    expect(bA.active).toBe(false);
    expect(bB.active).toBe(false);
    expect(bA.hp).toBeLessThanOrEqual(0);
    expect(bB.hp).toBeLessThanOrEqual(0);
  });

  it('should allow Destroyer bullet to crush Gunner bullet and survive with minimal damage', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // Destroyer (hp=16, dmg=42, radius=18) vs Gunner (hp=1, dmg=3.5, radius=5)
    bA.init(idxA, 1, 100, 100, 10, 0, 18, 16, 42);
    bB.init(idxB, 2, 110, 100, -14, 0, 5, 1, 3.5);

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(collisionSystem.bulletClashCount).toBe(1);
    // Gunner 被碾碎
    expect(bB.active).toBe(false);
    expect(bB.hp).toBeLessThanOrEqual(0);
    // Destroyer 存活，僅損失約 3.5 * (1/42) ≈ 0.0833 滴血
    expect(bA.active).toBe(true);
    expect(bA.hp).toBeCloseTo(16 - 3.5 / 42, 3);
  });

  it('should progressively weaken and eventually destroy a Destroyer bullet with a stream of small bullets', () => {
    const idxA = pool.acquire();
    const bA = pool.items[idxA];
    // 一顆 hp=0.2 的殘血 Destroyer 子彈
    bA.init(idxA, 1, 100, 100, 10, 0, 18, 0.2, 42);

    const idxB = pool.acquire();
    const bB = pool.items[idxB];
    // 一顆 Basic 子彈
    bB.init(idxB, 2, 110, 100, -10, 0, 9, 2, 7);

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(collisionSystem.bulletClashCount).toBe(1);
    // 殘血 Destroyer 被擊毀
    expect(bA.active).toBe(false);
    expect(bA.hp).toBeLessThanOrEqual(0);
  });

  it('should apply mass-inverse micro-push and damping on surviving bullets', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // 兩顆大血量高耐久子彈相碰但不致死 (測試物理衝量與阻尼)
    // A: radius 20, hp 50, dmg 1, vx = 5
    // B: radius 10, hp 50, dmg 1, vx = -5
    bA.init(idxA, 1, 100, 100, 5, 0, 20, 50, 1);
    bB.init(idxB, 2, 120, 100, -5, 0, 10, 50, 1);

    const prevVxA = bA.vx;
    const prevVxB = bB.vx;

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(collisionSystem.bulletClashCount).toBe(1);
    expect(bA.active).toBe(true);
    expect(bB.active).toBe(true);

    // 兩者皆受阻尼 (0.94) 減速
    expect(Math.abs(bA.vx)).toBeLessThan(Math.abs(prevVxA));
    expect(Math.abs(bB.vx)).toBeLessThan(Math.abs(prevVxB));

    // 質量較小者 (B: radius 10, m=100) 相對於質量較大者 (A: radius 20, m=400) 獲得更大的衝量變化
    const deltaVxA = Math.abs(bA.vx - prevVxA);
    const deltaVxB = Math.abs(bB.vx - prevVxB);
    expect(deltaVxB).toBeGreaterThan(deltaVxA);
  });

  it('should significantly deflect surviving bullets during a glancing oblique clash', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // A 與 B 以垂直偏移 8 單位掠射
    bA.init(idxA, 1, 100, 100, 10, 0, 9, 30, 5);
    bB.init(idxB, 2, 112, 108, -10, 0, 9, 30, 5);

    let clashTriggered = false;
    let sparkCount = 0;
    eventBus.onBulletClash((_x, _y, _rA, _rB) => {
      clashTriggered = true;
      sparkCount += 12;
    });

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(clashTriggered).toBe(true);
    expect(sparkCount).toBeGreaterThanOrEqual(8);
    expect(bA.active).toBe(true);
    expect(bB.active).toBe(true);

    // 兩子彈在 Y 軸獲得顯著且方向相反的偏轉速度
    expect(Math.abs(bA.vy)).toBeGreaterThan(2.0);
    expect(Math.abs(bB.vy)).toBeGreaterThan(2.0);
    expect(Math.sign(bA.vy)).toBe(-Math.sign(bB.vy));

    // 計算偏折角 > 15 度
    const angleA =
      (Math.atan2(Math.abs(bA.vy), Math.abs(bA.vx)) * 180) / Math.PI;
    expect(angleA).toBeGreaterThan(15.0);
  });

  it('should detect high-speed swept circle collision between two bullets passing within 1 tick', () => {
    const idxA = pool.acquire();
    const idxB = pool.acquire();
    const bA = pool.items[idxA];
    const bB = pool.items[idxB];

    // 在上一 tick：A 在 90，B 在 130（相距 40，大於 radius 9+9=18）
    // 在當前 tick：A 飛至 120，B 飛至 80（已交錯穿過，相距 40）
    bA.init(idxA, 1, 120, 100, 30, 0, 9, 2, 7);
    bA.prevX = 90;
    bA.prevY = 100;

    bB.init(idxB, 2, 80, 100, -30, 0, 9, 2, 7);
    bB.prevX = 130;
    bB.prevY = 100;

    collisionSystem.update([], pool, [], shapeSystem, eventBus, 1);

    expect(collisionSystem.bulletClashCount).toBe(1);
    expect(bA.active).toBe(false);
    expect(bB.active).toBe(false);
  });
});
