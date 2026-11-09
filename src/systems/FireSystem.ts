import {
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BASE_RECOIL_IMPULSE,
  BULLET_INHERIT_TANK_VELOCITY,
  BULLET_LIFESPAN_TICKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import {
  getBulletDamage,
  getBulletPenetration,
  getReloadTicks,
} from '../config/stats.config';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Tank } from '../entities/Tank';

/**
 * 射擊系統 (FireSystem)
 * 負責裝填冷卻推進、依據 BarrelConfig 發射子彈、後座力衝量施加與子彈生命週期維護
 */
export class FireSystem {
  /**
   * 每個模擬 tick 更新指定坦克的開火邏輯
   * @param tank 坦克實體
   * @param bulletPool 子彈物件池
   * @param reloadPoints 裝填屬性加點 (M2 預設 0)
   * @param bulletPenPoints 子彈穿透加點 (M2 預設 0)
   * @param bulletDmgPoints 子彈傷害加點 (M2 預設 0)
   */
  public updateTankFiring(
    tank: Tank,
    bulletPool: ObjectPool<Bullet>,
    reloadPoints = 0,
    bulletPenPoints = 0,
    bulletDmgPoints = 0,
  ): void {
    if (!tank.active) return;

    // 1. 更新瞄準朝向
    const aimDx = tank.input.aimX - tank.x;
    const aimDy = tank.input.aimY - tank.y;
    if (aimDx * aimDx + aimDy * aimDy > 0.001) {
      tank.rotation = Math.atan2(aimDy, aimDx);
    }

    const barrels = tank.definition.barrels;
    const barrelCount = barrels.length;

    // 2. 推進各砲管裝填冷卻
    for (let b = 0; b < barrelCount; b++) {
      if (tank.barrelCooldowns[b] > 0) {
        tank.barrelCooldowns[b]--;
      }
    }

    // 3. 若有射擊意圖，依序檢查各砲管冷卻並發射
    if (tank.input.shooting) {
      const reloadTicks = getReloadTicks(reloadPoints);

      for (let b = 0; b < barrelCount; b++) {
        if (tank.barrelCooldowns[b] <= 0) {
          const barrel = barrels[b];

          // 計算砲管絕對朝向角與散射角
          const totalAngle = tank.rotation + barrel.angle;
          const spreadOffset =
            barrel.spread > 0 ? (Math.random() - 0.5) * 2 * barrel.spread : 0;
          const fireAngle = totalAngle + spreadOffset;

          // 計算砲管口世界座標（砲管自安裝偏移點向外延伸 barrel.length）
          const cosBase = Math.cos(tank.rotation);
          const sinBase = Math.sin(tank.rotation);
          // 安裝底座世界座標
          const mountX =
            tank.x + barrel.offsetX * cosBase - barrel.offsetY * sinBase;
          const mountY =
            tank.y + barrel.offsetX * sinBase + barrel.offsetY * cosBase;
          // 砲口世界座標
          const tipX = mountX + barrel.length * Math.cos(totalAngle);
          const tipY = mountY + barrel.length * Math.sin(totalAngle);

          // 計算子彈初速
          const speed = BASE_BULLET_SPEED * barrel.bulletSpeedMultiplier;
          const vx =
            Math.cos(fireAngle) * speed +
            tank.vx * BULLET_INHERIT_TANK_VELOCITY;
          const vy =
            Math.sin(fireAngle) * speed +
            tank.vy * BULLET_INHERIT_TANK_VELOCITY;

          // 子彈屬性
          const radius = BASE_BULLET_RADIUS * barrel.bulletSizeMultiplier;
          const hp =
            getBulletPenetration(bulletPenPoints) * barrel.bulletPenMultiplier;
          const damage =
            getBulletDamage(bulletDmgPoints) * barrel.bulletDamageMultiplier;

          // 從池中借用子彈實體
          const bulletIdx = bulletPool.acquire();
          if (bulletIdx !== -1) {
            const bullet = bulletPool.items[bulletIdx];
            bullet.init(
              bulletIdx,
              tank.id,
              tipX,
              tipY,
              vx,
              vy,
              radius,
              hp,
              damage,
              BULLET_LIFESPAN_TICKS,
            );

            // 施加反方向後座力衝量
            const recoil = BASE_RECOIL_IMPULSE * barrel.recoilMultiplier;
            tank.vx -= Math.cos(fireAngle) * recoil;
            tank.vy -= Math.sin(fireAngle) * recoil;

            // 重置該砲管冷卻
            tank.barrelCooldowns[b] = reloadTicks;
          }
        }
      }
    }
  }

  /**
   * 每個模擬 tick 更新場上所有子彈的位置與壽命衰減
   * @param bulletPool 子彈物件池
   */
  public updateBullets(bulletPool: ObjectPool<Bullet>): void {
    const cap = bulletPool.capacity;
    for (let i = 0; i < cap; i++) {
      if (bulletPool.isActive(i)) {
        const bullet = bulletPool.items[i];
        bullet.remainingTicks--;

        // 壽命耗盡或生命歸零或越過世界邊界時回收
        if (
          bullet.remainingTicks <= 0 ||
          bullet.hp <= 0 ||
          bullet.x < -100 ||
          bullet.x > WORLD_WIDTH + 100 ||
          bullet.y < -100 ||
          bullet.y > WORLD_HEIGHT + 100
        ) {
          bullet.active = false;
          bulletPool.release(i);
        } else {
          bullet.prepareStep();
          bullet.x += bullet.vx;
          bullet.y += bullet.vy;
        }
      }
    }
  }
}
