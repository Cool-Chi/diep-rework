import {
  BULLET_COLLISION_DAMPING,
  BULLET_COLLISION_DEFLECTION_FACTOR,
  BULLET_COLLISION_PUSH_FACTOR,
  BULLET_COLLISION_RESTITUTION,
  BULLET_KNOCKBACK_FACTOR,
  COLLISION_PUSH_FACTOR,
  TANK_BODY_CONTACT_COOLDOWN_TICKS,
  TANK_COLLISION_SEPARATION_IMPULSE,
} from '../config/constants';
import type { EventBus } from '../core/EventBus';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import {
  decodeEntityIndex,
  decodeEntityType,
  ENTITY_TYPE_BULLET,
  ENTITY_TYPE_SHAPE,
  ENTITY_TYPE_TANK,
  encodeEntityCode,
  SpatialHash,
} from '../physics/SpatialHash';
import type { ShapeSystem } from './ShapeSystem';

/**
 * 碰撞結算系統 (CollisionSystem)
 * 負責維護 SpatialHash、子彈防穿透掃掠結算、子彈相消物理、形狀/坦克推開衝量與比例傷害計算
 */
export class CollisionSystem {
  public readonly spatialHash: SpatialHash;
  public pushFactor = COLLISION_PUSH_FACTOR;
  public knockbackFactor = BULLET_KNOCKBACK_FACTOR;
  public bulletPushFactor = BULLET_COLLISION_PUSH_FACTOR;
  public bulletDamping = BULLET_COLLISION_DAMPING;
  public bulletRestitution = BULLET_COLLISION_RESTITUTION;
  public bulletDeflectionFactor = BULLET_COLLISION_DEFLECTION_FACTOR;
  public bulletClashCount = 0;

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
    currentTick = 0,
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

    const bulletCap = bulletPool.capacity;
    for (let b = 0; b < bulletCap; b++) {
      if (bulletPool.isActive(b)) {
        const bullet = bulletPool.items[b];
        this.spatialHash.insert(
          bullet.x,
          bullet.y,
          encodeEntityCode(ENTITY_TYPE_BULLET, b),
        );
      }
    }

    // 2. 子彈碰撞檢測（線段掃掠防穿透 + 比例傷害公式 + 子彈相消物理）
    for (let b = 0; b < bulletCap; b++) {
      if (!bulletPool.isActive(b)) continue;
      const bullet = bulletPool.items[b];

      // 依據子彈移動軌跡中點與位移半徑進行掃掠式空間雜湊查詢，防高速穿透與大體型坦克漏檢
      const sweepDx = bullet.x - bullet.prevX;
      const sweepDy = bullet.y - bullet.prevY;
      const sweepDist = Math.sqrt(sweepDx * sweepDx + sweepDy * sweepDy);
      const midX = bullet.prevX + sweepDx * 0.5;
      const midY = bullet.prevY + sweepDy * 0.5;
      const queryRadius = bullet.radius + sweepDist * 0.5;

      const candidateCount = this.spatialHash.query(
        midX,
        midY,
        queryRadius,
        50, // 最大候選實體半徑涵蓋 Lv 45 巨型坦克 (半徑 ~40) 與大型形狀
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
            eventBus.emitBulletHit(bullet.x, bullet.y, 0xfffae0);

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
              eventBus.emitShapeDestroyed(
                shape.kind,
                bullet.ownerId,
                shape.x,
                shape.y,
              );
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

          // 非活躍或自身發射之子彈免疫
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

            // 子彈撞擊實體必然受反傷損耗或銷毀，杜絕穿透幽靈彈
            bullet.hp -= dTargetToBullet;
            if (bullet.hp <= 0) {
              bullet.active = false;
              bulletPool.release(b);
            }

            eventBus.emitBulletHit(bullet.x, bullet.y, bullet.color);

            // 若目標非處於無敵保護狀態，正常扣除坦克生命
            if (!targetTank.isGodMode && targetTank.invulnerableTicks <= 0) {
              targetTank.hp -= damageDealt;
              targetTank.lastDamageTick = currentTick;

              if (targetTank.hp <= 0) {
                targetTank.active = false;
                eventBus.emitTankDied(
                  targetTank.id,
                  bullet.ownerId,
                  targetTank.x,
                  targetTank.y,
                );
              }
            } else if (targetTank.invulnerableTicks > 0) {
              // 受擊時提前消耗護盾 ticks，避免站立 AI 長時間無敵
              targetTank.invulnerableTicks = Math.max(
                0,
                targetTank.invulnerableTicks - 25,
              );
            }
          }
        } else if (type === ENTITY_TYPE_BULLET) {
          // 子彈與子彈碰撞結算 (Bullet-vs-Bullet Clash)
          // 避免自碰與重複結算相同子彈對 (只在 idx > b 時處理)
          if (idx <= b) continue;
          if (!bulletPool.isActive(idx)) continue;
          const otherBullet = bulletPool.items[idx];
          if (!otherBullet.active || otherBullet.hp <= 0) continue;
          // 同一主人發射的子彈不互撞免疫
          if (bullet.ownerId === otherBullet.ownerId) continue;

          // 碰撞判定：先靜態圓形距離檢測，再相對線段掃掠防穿透
          const minDist = bullet.radius + otherBullet.radius;
          const dx = otherBullet.x - bullet.x;
          const dy = otherBullet.y - bullet.y;
          const distSq = dx * dx + dy * dy;

          let isColliding = distSq <= minDist * minDist;
          if (!isColliding) {
            // 相對掃掠：從上一 tick 相對向量到當前相對向量，檢測相對於 (0,0) 的距離
            const relPrevX = otherBullet.prevX - bullet.prevX;
            const relPrevY = otherBullet.prevY - bullet.prevY;
            isColliding = this.testSweptCircle(
              relPrevX,
              relPrevY,
              dx,
              dy,
              0,
              0,
              minDist,
            );
          }

          if (isColliding) {
            this.bulletClashCount++;

            // 1. 雙向快照比例傷害 (Snapshot Proportional Damage)
            const factorA =
              otherBullet.damage > 0
                ? Math.min(1.0, bullet.hp / otherBullet.damage)
                : 1.0;
            const factorB =
              bullet.damage > 0
                ? Math.min(1.0, otherBullet.hp / bullet.damage)
                : 1.0;

            const damageToB = bullet.damage * factorA;
            const damageToA = otherBullet.damage * factorB;

            bullet.hp -= damageToA;
            otherBullet.hp -= damageToB;

            // 2. 撞擊火花特效（觸發專屬子彈相消破片火花）
            const sparkX = (bullet.x + otherBullet.x) * 0.5;
            const sparkY = (bullet.y + otherBullet.y) * 0.5;
            eventBus.emitBulletHit(sparkX, sparkY, 0xfffae0);
            eventBus.emitBulletClash(
              sparkX,
              sparkY,
              bullet.radius,
              otherBullet.radius,
              bullet.color,
              otherBullet.color,
            );

            // 3. 質量反比推開與彈性偏轉衝量 (質量 m = r^2)
            const mA = bullet.radius * bullet.radius;
            const mB = otherBullet.radius * otherBullet.radius;
            const invTotal = 1 / (mA + mB);

            let dist = Math.sqrt(distSq);
            let nx = 1;
            let ny = 0;
            if (dist > 0.0001) {
              nx = dx / dist;
              ny = dy / dist;
            } else {
              dist = 0.0001;
            }

            // 重疊分離推開
            if (dist < minDist) {
              const overlap = minDist - dist;
              bullet.x -=
                nx * overlap * (mB * invTotal) * this.bulletPushFactor;
              bullet.y -=
                ny * overlap * (mB * invTotal) * this.bulletPushFactor;
              otherBullet.x +=
                nx * overlap * (mA * invTotal) * this.bulletPushFactor;
              otherBullet.y +=
                ny * overlap * (mA * invTotal) * this.bulletPushFactor;
            }

            // 法向相對速度與彈性偏轉衝量
            const rvx = otherBullet.vx - bullet.vx;
            const rvy = otherBullet.vy - bullet.vy;
            const velAlongNormal = rvx * nx + rvy * ny;

            if (velAlongNormal < 0) {
              const impulseMag =
                -(1 + this.bulletRestitution) *
                velAlongNormal *
                this.bulletDeflectionFactor;

              bullet.vx -= nx * (mB * invTotal) * impulseMag;
              bullet.vy -= ny * (mB * invTotal) * impulseMag;
              otherBullet.vx += nx * (mA * invTotal) * impulseMag;
              otherBullet.vy += ny * (mA * invTotal) * impulseMag;
            }

            // 速度阻尼
            bullet.vx *= this.bulletDamping;
            bullet.vy *= this.bulletDamping;
            otherBullet.vx *= this.bulletDamping;
            otherBullet.vy *= this.bulletDamping;

            // 4. 生命歸零回收處理
            if (otherBullet.hp <= 0) {
              otherBullet.active = false;
              bulletPool.release(idx);
            }
            if (bullet.hp <= 0) {
              bullet.active = false;
              bulletPool.release(b);
              break;
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
          tank.y -= ny * overlap * (mTank * invTotal) * this.pushFactor;
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

          // 雙向撞擊傷害（非無敵狀態下結算）
          if (tank.invulnerableTicks <= 0) {
            const damageToShape = tank.bodyDamage * shape.damageTakenMultiplier;
            const damageToTank = shape.bodyDamage;

            shape.hp -= damageToShape;
            if (!tank.isGodMode) {
              tank.hp -= damageToTank;
              tank.lastDamageTick = currentTick;
            }

            if (shape.hp <= 0) {
              shape.active = false;
              shapeSystem.activeCount--;
              eventBus.emitShapeDestroyed(
                shape.kind,
                tank.id,
                shape.x,
                shape.y,
              );
            }

            if (tank.hp <= 0 && !tank.isGodMode) {
              tank.active = false;
              eventBus.emitTankDied(tank.id, -1, tank.x, tank.y);
            }
          }
        }
      }
    }

    // 4. 坦克 vs 坦克碰撞（推開、衝量與雙向撞擊傷害）
    for (let t = 0; t < tankCount; t++) {
      const tankA = tanks[t];
      if (!tankA.active) continue;

      const candidateCount = this.spatialHash.query(
        tankA.x,
        tankA.y,
        tankA.radius,
        25,
      );

      for (let c = 0; c < candidateCount; c++) {
        const code = this.spatialHash.queryResults[c];
        if (decodeEntityType(code) !== ENTITY_TYPE_TANK) continue;

        const otherId = decodeEntityIndex(code);
        if (otherId <= tankA.id) continue; // 每對坦克每 tick 僅結算一次

        let tankB: Tank | null = null;
        for (let j = 0; j < tankCount; j++) {
          if (tanks[j].id === otherId) {
            tankB = tanks[j];
            break;
          }
        }
        if (!tankB?.active) continue;

        const dx = tankB.x - tankA.x;
        const dy = tankB.y - tankA.y;
        const distSq = dx * dx + dy * dy;
        const minDist = tankA.radius + tankB.radius;

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
          const mA = tankA.radius * tankA.radius;
          const mB = tankB.radius * tankB.radius;
          const invTotal = 1 / (mA + mB);

          // 質量反比推開
          tankA.x -= nx * overlap * (mB * invTotal) * this.pushFactor;
          tankA.y -= ny * overlap * (mB * invTotal) * this.pushFactor;
          tankB.x += nx * overlap * (mA * invTotal) * this.pushFactor;
          tankB.y += ny * overlap * (mA * invTotal) * this.pushFactor;

          // 彈性碰撞衝量 (restitution = 0.4) 與相撞法向彈開衝量
          const rvx = tankB.vx - tankA.vx;
          const rvy = tankB.vy - tankA.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const restitution = 0.4;
            const j = (-(1 + restitution) * velAlongNormal) / (1 / mA + 1 / mB);
            tankA.vx -= (j / mA) * nx;
            tankA.vy -= (j / mA) * ny;
            tankB.vx += (j / mB) * nx;
            tankB.vy += (j / mB) * ny;
          }

          // 額外賦予乾淨俐落的相向彈開衝量，避免兩車粘滯重疊
          const sepSpeed = TANK_COLLISION_SEPARATION_IMPULSE;
          tankA.vx -= nx * sepSpeed * (mB * invTotal);
          tankA.vy -= ny * sepSpeed * (mB * invTotal);
          tankB.vx += nx * sepSpeed * (mA * invTotal);
          tankB.vy += ny * sepSpeed * (mA * invTotal);

          // 雙向撞擊傷害（非無敵且冷卻達標時結算，防止 0.08 秒瞬間融化）
          if (tankA.invulnerableTicks <= 0 && tankB.invulnerableTicks <= 0) {
            const cooldownPassedA =
              tankA.lastBodyContactTick === 0 ||
              currentTick - tankA.lastBodyContactTick >=
                TANK_BODY_CONTACT_COOLDOWN_TICKS;
            const cooldownPassedB =
              tankB.lastBodyContactTick === 0 ||
              currentTick - tankB.lastBodyContactTick >=
                TANK_BODY_CONTACT_COOLDOWN_TICKS;

            if (cooldownPassedA || cooldownPassedB) {
              tankA.lastBodyContactTick = currentTick;
              tankB.lastBodyContactTick = currentTick;

              const damageToA = tankB.bodyDamageToTank;
              const damageToB = tankA.bodyDamageToTank;

              if (!tankA.isGodMode) {
                tankA.hp -= damageToA;
                tankA.lastDamageTick = currentTick;
                if (tankA.hp <= 0) {
                  tankA.active = false;
                  eventBus.emitTankDied(tankA.id, tankB.id, tankA.x, tankA.y);
                }
              }

              if (!tankB.isGodMode) {
                tankB.hp -= damageToB;
                tankB.lastDamageTick = currentTick;
                if (tankB.hp <= 0) {
                  tankB.active = false;
                  eventBus.emitTankDied(tankB.id, tankA.id, tankB.x, tankB.y);
                }
              }
            }
          }
        }
      }
    }

    // 5. 形狀 vs 形狀碰撞（純推開與衝量，不造成傷害）
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
