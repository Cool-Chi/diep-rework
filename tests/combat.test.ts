import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ShapeSystem } from '../src/systems/ShapeSystem';

describe('Combat and Collision System (M2)', () => {
  it('Lv1 bullet kills Square in 2 shots', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 生成方塊 (HP=10, 撞擊反傷=2, 受傷倍率=1.0)
    const sIdx = shapeSystem.spawnShape('square', 100, 100);
    const square = shapeSystem.shapes[sIdx];
    expect(square.hp).toBe(10);

    let destroyedBy: number | null = null;
    eventBus.onShapeDestroyed((_kind, killerId) => {
      destroyedBy = killerId;
    });

    // 2. 第 1 發子彈命中 (Basic Tank: HP=2, Damage=7)
    const b1Idx = bulletPool.acquire();
    const b1 = bulletPool.items[b1Idx];
    b1.init(b1Idx, 42, 100, 100, 0, 0, 8, 2, 7, 75);

    collisionSystem.update(
      [],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    // 第 1 發子彈耗盡生命死亡，方塊剩 3 滴血
    expect(b1.active).toBe(false);
    expect(square.active).toBe(true);
    expect(square.hp).toBe(3);
    expect(destroyedBy).toBeNull();

    // 3. 第 2 發子彈命中 (HP=2, Damage=7)
    const b2Idx = bulletPool.acquire();
    const b2 = bulletPool.items[b2Idx];
    b2.init(b2Idx, 42, 100, 100, 0, 0, 8, 2, 7, 75);

    collisionSystem.update(
      [],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    // 第 2 發子彈摧毀方塊，觸發事件
    expect(b2.active).toBe(false);
    expect(square.active).toBe(false);
    expect(square.hp).toBeLessThanOrEqual(0);
    expect(destroyedBy).toBe(42);
  });

  it('Lv1 bullet kills Pentagon in 22 shots', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 生成五邊形 (HP=100, 受傷倍率=2/3, 每次受傷 7 * 2/3 = 14/3)
    const pIdx = shapeSystem.spawnShape('pentagon', 200, 200);
    const pentagon = shapeSystem.shapes[pIdx];
    expect(pentagon.hp).toBe(100);

    let shotsFired = 0;
    while (pentagon.active && shotsFired < 50) {
      shotsFired++;
      const bIdx = bulletPool.acquire();
      const b = bulletPool.items[bIdx];
      b.init(bIdx, 1, 200, 200, 0, 0, 8, 2, 7, 75);

      collisionSystem.update(
        [],
        bulletPool,
        shapeSystem.shapes,
        shapeSystem,
        eventBus,
      );

      // 第 21 發後五邊形應仍存活 (剩約 2 滴血)
      if (shotsFired === 21) {
        expect(pentagon.active).toBe(true);
        expect(pentagon.hp).toBeCloseTo(2, 1);
      }
    }

    // 剛好第 22 發擊破五邊形
    expect(shotsFired).toBe(22);
    expect(pentagon.active).toBe(false);
  });

  it('Weakened bullet (HP=1) deals proportional half damage (3.5)', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const sIdx = shapeSystem.spawnShape('square', 300, 300);
    const square = shapeSystem.shapes[sIdx];
    expect(square.hp).toBe(10);

    // 子彈 HP=1，方塊對子彈傷害=2，折減比例 1/2 = 0.5，造成 7 * 0.5 = 3.5 傷害
    const bIdx = bulletPool.acquire();
    const b = bulletPool.items[bIdx];
    b.init(bIdx, 1, 300, 300, 0, 0, 8, 1, 7, 75);

    collisionSystem.update(
      [],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    expect(b.active).toBe(false);
    expect(square.active).toBe(true);
    expect(square.hp).toBe(6.5);
  });

  it('Tank hitting Square in 1 tick kills Square and tank takes 8 damage', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const tank = new Tank(1, 400, 400);
    expect(tank.hp).toBe(50);
    expect(tank.bodyDamage).toBe(20);

    const sIdx = shapeSystem.spawnShape('square', 400, 400);
    const square = shapeSystem.shapes[sIdx];
    expect(square.hp).toBe(10);
    expect(square.bodyDamage).toBe(8);

    collisionSystem.update(
      [tank],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    // 坦克撞擊傷害 20 直接擊殺方塊 (HP 10)
    expect(square.active).toBe(false);
    // 坦克承受方塊撞擊傷害 8
    expect(tank.hp).toBe(42);
  });

  it('Overlapping shapes push apart over multiple ticks and do not deal damage', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 兩顆重疊方塊
    const s1 = shapeSystem.spawnShape('square', 500, 500);
    const s2 = shapeSystem.spawnShape('square', 505, 500);
    const shape1 = shapeSystem.shapes[s1];
    const shape2 = shapeSystem.shapes[s2];

    const initialDist = Math.hypot(shape2.x - shape1.x, shape2.y - shape1.y);
    expect(initialDist).toBe(5);

    for (let tick = 0; tick < 10; tick++) {
      shapeSystem.update();
      collisionSystem.update(
        [],
        bulletPool,
        shapeSystem.shapes,
        shapeSystem,
        eventBus,
      );
    }

    // 形狀間不扣血
    expect(shape1.hp).toBe(10);
    expect(shape2.hp).toBe(10);

    // 相互推開至半徑和 (13+13=26) 附近
    const finalDist = Math.hypot(shape2.x - shape1.x, shape2.y - shape1.y);
    expect(finalDist).toBeGreaterThan(initialDist);
    expect(finalDist).toBeGreaterThanOrEqual(20);
  });

  it('Owner immunity: bullets do not collide with shooter', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const tank = new Tank(77, 600, 600);
    const bIdx = bulletPool.acquire();
    const bullet = bulletPool.items[bIdx];
    bullet.init(bIdx, 77, 600, 600, 0, 0, 8, 2, 7, 75);

    collisionSystem.update(
      [tank],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    // 同源不互撞
    expect(bullet.active).toBe(true);
    expect(tank.hp).toBe(50);
  });

  it('High-speed bullet does not tunnel through small shapes (swept sub-stepping)', () => {
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 方塊在 (700, 700)，半徑 13
    const sIdx = shapeSystem.spawnShape('square', 700, 700);
    const square = shapeSystem.shapes[sIdx];

    // 高速子彈一步位移 80 單位 (從 660 瞬移到 740，跨過方塊)
    const bIdx = bulletPool.acquire();
    const bullet = bulletPool.items[bIdx];
    bullet.init(bIdx, 1, 660, 700, 80, 0, 8, 2, 7, 75);
    bullet.x = 740;
    bullet.y = 700;

    collisionSystem.update(
      [],
      bulletPool,
      shapeSystem.shapes,
      shapeSystem,
      eventBus,
    );

    // 掃掠檢測成功捕獲命中，方塊扣血且子彈被消耗
    expect(bullet.active).toBe(false);
    expect(square.hp).toBe(3);
  });

  it('Shape population stays at 500, ratio approximately 70/22/8', () => {
    const shapeSystem = new ShapeSystem();
    shapeSystem.fillToTarget();

    expect(shapeSystem.activeCount).toBe(500);

    let squares = 0;
    let triangles = 0;
    let pentagons = 0;

    for (let i = 0; i < shapeSystem.shapes.length; i++) {
      const s = shapeSystem.shapes[i];
      if (s.active) {
        if (s.kind === 'square') squares++;
        else if (s.kind === 'triangle') triangles++;
        else if (s.kind === 'pentagon') pentagons++;
      }
    }

    expect(squares + triangles + pentagons).toBe(500);
    // 70% 方塊 ~ 350
    expect(squares).toBeGreaterThan(280);
    expect(squares).toBeLessThan(420);
    // 22% 三角 ~ 110
    expect(triangles).toBeGreaterThan(60);
    expect(triangles).toBeLessThan(160);
    // 8% 五邊形 ~ 40
    expect(pentagons).toBeGreaterThan(15);
    expect(pentagons).toBeLessThan(75);
  });
});
