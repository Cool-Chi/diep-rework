import {
  AI_MAX_TURN_RATE_PER_TICK,
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BASE_RECOIL_IMPULSE,
  BULLET_INHERIT_TANK_VELOCITY,
  BULLET_LIFESPAN_TICKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import { sizeFactor } from '../config/stats.config';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Tank } from '../entities/Tank';

/**
 * 射擊系統 (FireSystem)
 * 負責裝填冷卻推進、依據 BarrelConfig 發射子彈、後座力衝量施加與子彈生命週期維護
 */
export class FireSystem {
  public bulletSpeed = BASE_BULLET_SPEED;
  public recoilImpulse = BASE_RECOIL_IMPULSE;

  /**
   * 每個模擬 tick 更新指定坦克的開火邏輯
   * @param tank 坦克實體
   * @param bulletPool 子彈物件池
   */
  public updateTankFiring(tank: Tank, bulletPool: ObjectPool<Bullet>): void {
    if (!tank.active) return;

    // 1. 更新瞄準朝向（AI 坦克套用擬人化平滑角速度限制，杜絕機械式瞬間甩頭）
    const aimDx = tank.input.aimX - tank.x;
    const aimDy = tank.input.aimY - tank.y;
    if (aimDx * aimDx + aimDy * aimDy > 0.001) {
      const targetAngle = Math.atan2(aimDy, aimDx);
      if (tank.isAi) {
        let delta = targetAngle - tank.rotation;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;

        const maxTurn = AI_MAX_TURN_RATE_PER_TICK;
        const step = Math.sign(delta) * Math.min(Math.abs(delta), maxTurn);
        tank.rotation += step;
        while (tank.rotation > Math.PI) tank.rotation -= Math.PI * 2;
        while (tank.rotation < -Math.PI) tank.rotation += Math.PI * 2;
      } else {
        tank.rotation = targetAngle;
      }
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
      if (tank.invulnerableTicks > 0) {
        tank.invulnerableTicks = 0;
      }

      // AI 射擊門檻：若砲管正處於大幅度轉向（夾角大於約 48 度）且非逃逸加速，暫緩開火
      if (tank.isAi && tank.aiState !== 'retreating') {
        const aimDx = tank.input.aimX - tank.x;
        const aimDy = tank.input.aimY - tank.y;
        const targetAngle = Math.atan2(aimDy, aimDx);
        let delta = targetAngle - tank.rotation;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) > 0.85) {
          return;
        }
      }
      const reloadTicks = tank.reloadTicks;
      const s = sizeFactor(tank.level);

      for (let b = 0; b < barrelCount; b++) {
        if (tank.barrelCooldowns[b] <= 0) {
          const barrel = barrels[b];

          // 計算砲管絕對朝向角與散射角
          const totalAngle = tank.rotation + barrel.angle;
          const spreadOffset =
            barrel.spread > 0 ? (Math.random() - 0.5) * 2 * barrel.spread : 0;
          const fireAngle = totalAngle + spreadOffset;

          // 計算砲管口世界座標（砲管與安裝點隨坦克體型等比放大）
          const cosBase = Math.cos(tank.rotation);
          const sinBase = Math.sin(tank.rotation);
          // 安裝底座世界座標
          const mountX =
            tank.x + (barrel.offsetX * cosBase - barrel.offsetY * sinBase) * s;
          const mountY =
            tank.y + (barrel.offsetX * sinBase + barrel.offsetY * cosBase) * s;
          // 砲口世界座標
          const tipX = mountX + barrel.length * s * Math.cos(totalAngle);
          const tipY = mountY + barrel.length * s * Math.sin(totalAngle);

          // 計算子彈初速 (支援 DebugOverlay 微調覆寫或坦克衍生速度)
          const baseSpeed =
            this.bulletSpeed !== BASE_BULLET_SPEED
              ? this.bulletSpeed
              : tank.bulletSpeed;
          const speed = baseSpeed * barrel.bulletSpeedMultiplier;
          const vx =
            Math.cos(fireAngle) * speed +
            tank.vx * BULLET_INHERIT_TANK_VELOCITY;
          const vy =
            Math.sin(fireAngle) * speed +
            tank.vy * BULLET_INHERIT_TANK_VELOCITY;

          // 子彈屬性（以 BASE_BULLET_RADIUS 結合砲管尺寸乘數，Destroyer 為 2.0x = 18 單位對齊砲管寬度 36）
          let sizeMult = barrel.bulletSizeMultiplier;
          if (tank.definition.id === 'machine_gun') {
            // Machine Gun 噴射彈幕隨機微浮動 0.85 ~ 1.10
            sizeMult *= 0.85 + Math.random() * 0.25;
          }
          const radius = BASE_BULLET_RADIUS * s * sizeMult;
          const hp = tank.bulletHp * barrel.bulletPenMultiplier;
          const damage = tank.bulletDamage * barrel.bulletDamageMultiplier;
          const lifespan = barrel.bulletLifespanTicks ?? BULLET_LIFESPAN_TICKS;

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
              lifespan,
              tank.color,
            );

            // 施加反方向後座力衝量
            const recoil = this.recoilImpulse * barrel.recoilMultiplier;
            tank.vx -= Math.cos(fireAngle) * recoil;
            tank.vy -= Math.sin(fireAngle) * recoil;

            // 計算該砲管的裝填時間並重置冷卻
            const bReload = Math.max(
              1,
              Math.round(reloadTicks * barrel.reloadMultiplier),
            );
            tank.barrelCooldowns[b] = bReload;

            // 若本砲管為基準砲管 (fireDelayRatio === 0)，為處於閒置的其他砲管注入相位偏移，保證完美交替開火
            if (barrel.fireDelayRatio === 0) {
              for (let ob = 0; ob < barrelCount; ob++) {
                if (
                  ob !== b &&
                  barrels[ob].fireDelayRatio > 0 &&
                  tank.barrelCooldowns[ob] <= 0
                ) {
                  const obReload = Math.max(
                    1,
                    Math.round(reloadTicks * barrels[ob].reloadMultiplier),
                  );
                  tank.barrelCooldowns[ob] = Math.max(
                    1,
                    Math.round(obReload * barrels[ob].fireDelayRatio),
                  );
                }
              }
            }
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
