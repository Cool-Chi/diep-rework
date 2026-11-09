import {
  BULLET_KNOCKBACK_FACTOR,
  COLLISION_PUSH_FACTOR,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import type { EventBus } from '../core/EventBus';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import {
  decodeEntityIndex,
  decodeEntityType,
  ENTITY_TYPE_SHAPE,
  ENTITY_TYPE_TANK,
  encodeEntityCode,
  SpatialHash,
} from '../physics/SpatialHash';
import type { ShapeSystem } from './ShapeSystem';

/**
 * 碰撞結算系統 (CollisionSystem)
 * 負責維護 SpatialHash、子彈防穿透掃掠結算、形狀/坦克推開衝量與比例傷害計算
 */
export class CollisionSystem {
  public readonly spatialHash: SpatialHash;
  public pushFactor = COLLISION_PUSH_FACTOR;
  public knockbackFactor = BULLET_KNOCKBACK_FACTOR;

  constructor(spatialHash?: SpatialHash) {
    this.spatialHash = spatialHash ?? new SpatialHash();
  }

  /**
   * 每個模擬 tick 執行完整碰撞檢測與物理響應
   */
  public update(
    tanks: Tank[],
    bulletPool: ObjectPool<Bullet>,
    shapes: Shape[],
    shapeSystem: ShapeSystem,
    eventBus: EventBus,
  ): void {
    // 1. 重建空間雜湊網格 (SpatialHash)
    this.spatialHash.clear();

    const tankCount = tanks.length;
    for (let t = 0; t < tankCount; t++) {
      const tank = tanks[t];
      if (tank.active) {
        this.spatialHash.insert(
          tank.x,
          tank.y,
          encodeEntityCode(ENTITY_TYPE_TANK, tank.id),
        );
      }
    }

    const shapeCapacity = shapes.length;
    for (let s = 0; s < shapeCapacity; s++) {
      const shape = shapes[s];
      if (shape.active) {
        this.spatialHash.insert(
          shape.x,
          shape.y,
          encodeEntityCode(ENTITY_TYPE_SHAPE, shape.id),
        );
      }
    }

    // 2. 子彈碰撞檢測（線段掃掠防穿透 + 比例傷害公式）
    const bulletCap = bulletPool.capacity;
    for (let b = 0; b < bulletCap; b++) {
      if (!bulletPool.isActive(b)) continue;
      const bullet = bulletPool.items[b];

      // 查詢子彈周圍可能候選目標
      const candidateCount = this.spatialHash.query(
        bullet.x,
        bullet.y,
        bullet.radius,
        25,
      );

      for (let c = 0; c < candidateCount; c++) {
        if (!bullet.active || bullet.hp <= 0) break;

        const code = this.spatialHash.queryResults[c];
        const type = decodeEntityType(code);
        const idx = decodeEntityIndex(code);

        if (type === ENTITY_TYPE_SHAPE) {
          const shape = shapes[idx];
          if (!shape.active) continue;

          // 線段掃掠檢測：bullet.prev -> bullet.cur 與圓形相交
          if (
            this.testSweptCircle(
              bullet.prevX,
              bullet.prevY,
              bullet.x,
              bullet.y,
              shape.x,
              shape.y,
              bullet.radius + shape.radius,
            )
          ) {
            // 原版比例扣血公式：
            // 形狀對子彈反傷基準為 2（Lv1 滿血子彈 HP=2 剛好承受 2 點反傷並打出全額傷害）
            const dTargetToBullet = 2;
            const factor = Math.min(1.0, bullet.hp / dTargetToBullet);
            const damageDealt =
              bullet.damage * factor * shape.damageTakenMultiplier;

            // 子彈扣除生命
            bullet.hp -= dTargetToBullet;
            if (bullet.hp <= 0) {
              bullet.active = false;
              bulletPool.release(b);
            }

            // 形狀承受傷害
            shape.hp -= damageDealt;

            // 施加擊退衝量
            const bdx = bullet.x - bullet.prevX;
            const bdy = bullet.y - bullet.prevY;
            const bspd = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bspd > 0.0001) {
              const knockback =
                (this.knockbackFactor * bullet.damage) / shape.radius;
              shape.vx += (bdx / bspd) * knockback;
              shape.vy += (bdy / bspd) * knockback;
            }

            // 形狀摧毀判定
            if (shape.hp <= 0) {
              shape.active = false;
              shapeSystem.activeCount--;
              eventBus.emitShapeDestroyed(shape.kind, bullet.ownerId);
            }
          }
        } else if (type === ENTITY_TYPE_TANK) {
          // 尋找對應坦克
          let targetTank: Tank | null = null;
          for (let t = 0; t < tankCount; t++) {
            if (tanks[t].id === idx) {
              targetTank = tanks[t];
              break;
            }
          }

          // 同源子彈免疫
          if (!targetTank?.active || targetTank.id === bullet.ownerId) {
            continue;
          }

          if (
            this.testSweptCircle(
              bullet.prevX,
              bullet.prevY,
              bullet.x,
              bullet.y,
              targetTank.x,
              targetTank.y,
              bullet.radius + targetTank.radius,
            )
          ) {
            const dTargetToBullet = targetTank.bodyDamageToBullet;
            const factor = Math.min(1.0, bullet.hp / dTargetToBullet);
            const damageDealt = bullet.damage * factor;

            bullet.hp -= dTargetToBullet;
            if (bullet.hp <= 0) {
              bullet.active = false;
              bulletPool.release(b);
            }

            targetTank.hp -= damageDealt;
            if (targetTank.hp <= 0) {
              eventBus.emitTankDied(targetTank.id);
              targetTank.respawn(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5);
            }
          }
        }
      }
    }

    // 3. 坦克 vs 形狀碰撞（推開、衝量與雙向撞擊傷害）
    for (let t = 0; t < tankCount; t++) {
      const tank = tanks[t];
      if (!tank.active) continue;

      const candidateCount = this.spatialHash.query(
        tank.x,
        tank.y,
        tank.radius,
        25,
      );

      for (let c = 0; c < candidateCount; c++) {
        const code = this.spatialHash.queryResults[c];
        if (decodeEntityType(code) !== ENTITY_TYPE_SHAPE) continue;

        const sIdx = decodeEntityIndex(code);
        const shape = shapes[sIdx];
        if (!shape.active) continue;

        const dx = shape.x - tank.x;
        const dy = shape.y - tank.y;
        const distSq = dx * dx + dy * dy;
        const minDist = tank.radius + shape.radius;

        if (distSq < minDist * minDist) {
          let dist = Math.sqrt(distSq);
          let nx = 1;
          let ny = 0;
          if (dist > 0.0001) {
            nx = dx / dist;
            ny = dy / dist;
          } else {
            dist = 0.0001;
          }

          const overlap = minDist - dist;
          const mTank = tank.radius * tank.radius;
          const mShape = shape.radius * shape.radius;
          const invTotal = 1 / (mTank + mShape);

          // 質量反比推開
          tank.x -= nx * overlap * (mShape * invTotal) * this.pushFactor;
          tank.y -= ny * overlap * (mShape * invTotal) * this.pushFactor;
          shape.x += nx * overlap * (mTank * invTotal) * this.pushFactor;
          shape.y += ny * overlap * (mTank * invTotal) * this.pushFactor;

          // 彈性碰撞衝量
          const rvx = shape.vx - tank.vx;
          const rvy = shape.vy - tank.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const restitution = 0.4;
            const j =
              (-(1 + restitution) * velAlongNormal) / (1 / mTank + 1 / mShape);
            tank.vx -= (j / mTank) * nx;
            tank.vy -= (j / mTank) * ny;
            shape.vx += (j / mShape) * nx;
            shape.vy += (j / mShape) * ny;
          }

          // 雙向撞擊傷害
          const damageToShape = tank.bodyDamage * shape.damageTakenMultiplier;
          const damageToTank = shape.bodyDamage;

          shape.hp -= damageToShape;
          tank.hp -= damageToTank;

          if (shape.hp <= 0) {
            shape.active = false;
            shapeSystem.activeCount--;
            eventBus.emitShapeDestroyed(shape.kind, tank.id);
          }

          if (tank.hp <= 0) {
            eventBus.emitTankDied(tank.id);
            tank.respawn(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5);
          }
        }
      }
    }

    // 4. 形狀 vs 形狀碰撞（純推開與衝量，不造成傷害）
    for (let s = 0; s < shapeCapacity; s++) {
      const shapeA = shapes[s];
      if (!shapeA.active) continue;

      const candidateCount = this.spatialHash.query(
        shapeA.x,
        shapeA.y,
        shapeA.radius,
        25,
      );

      for (let c = 0; c < candidateCount; c++) {
        const code = this.spatialHash.queryResults[c];
        if (decodeEntityType(code) !== ENTITY_TYPE_SHAPE) continue;

        const otherIdx = decodeEntityIndex(code);
        // 保證每對形狀僅處理一次
        if (otherIdx <= s) continue;

        const shapeB = shapes[otherIdx];
        if (!shapeB.active) continue;

        const dx = shapeB.x - shapeA.x;
        const dy = shapeB.y - shapeA.y;
        const distSq = dx * dx + dy * dy;
        const minDist = shapeA.radius + shapeB.radius;

        if (distSq < minDist * minDist) {
          let dist = Math.sqrt(distSq);
          let nx = 1;
          let ny = 0;
          if (dist > 0.0001) {
            nx = dx / dist;
            ny = dy / dist;
          } else {
            dist = 0.0001;
          }

          const overlap = minDist - dist;
          const mA = shapeA.radius * shapeA.radius;
          const mB = shapeB.radius * shapeB.radius;
          const invTotal = 1 / (mA + mB);

          shapeA.x -= nx * overlap * (mB * invTotal) * this.pushFactor;
          shapeA.y -= ny * overlap * (mB * invTotal) * this.pushFactor;
          shapeB.x += nx * overlap * (mA * invTotal) * this.pushFactor;
          shapeB.y += ny * overlap * (mA * invTotal) * this.pushFactor;

          const rvx = shapeB.vx - shapeA.vx;
          const rvy = shapeB.vy - shapeA.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const restitution = 0.5;
            const j = (-(1 + restitution) * velAlongNormal) / (1 / mA + 1 / mB);
            shapeA.vx -= (j / mA) * nx;
            shapeA.vy -= (j / mA) * ny;
            shapeB.vx += (j / mB) * nx;
            shapeB.vy += (j / mB) * ny;
          }
        }
      }
    }
  }

  /**
   * 檢測線段 (x0, y0) -> (x1, y1) 是否與圓形 (cx, cy, radius) 重疊相交
   * 用於高速移動物體防穿透（Swept Circle Collision）
   */
  public testSweptCircle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    radius: number,
  ): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy;

    let t = 0;
    if (l2 > 0.000001) {
      t = ((cx - x0) * dx + (cy - y0) * dy) / l2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }

    const px = x0 + t * dx;
    const py = y0 + t * dy;
    const distSq = (cx - px) * (cx - px) + (cy - py) * (cy - py);

    return distSq <= radius * radius;
  }
}
