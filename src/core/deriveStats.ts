import { BASE_TANK_RADIUS } from '../config/constants';
import {
  getBodyDamage,
  getBulletDamage,
  getBulletPenetration,
  getBulletSpeed,
  getHealthRegenPerTick,
  getMaxHealth,
  getMovementSpeedMultiplier,
  getReloadTicks,
  STAT_BODY_DAMAGE,
  STAT_BULLET_DAMAGE,
  STAT_BULLET_PENETRATION,
  STAT_BULLET_SPEED,
  STAT_HEALTH_REGEN,
  STAT_MAX_HEALTH,
  STAT_MOVEMENT_SPEED,
  STAT_RELOAD,
  sizeFactor,
} from '../config/stats.config';
import type { Tank } from '../entities/Tank';

/**
 * 依據坦克當前等級與 8 項屬性加點，重新計算所有衍生屬性並快取至 Tank 扁平欄位中
 * 嚴格規範：僅在「升級」或「加點」時呼叫，絕不在每 tick 的模擬迴圈中重算
 *
 * 【設計決策 - 血量同步成長】：
 * 當 maxHp 提升時（升級或投資 maxHealth），當前 hp 同步增加相同差額（hp += delta），
 * 避免加點後血量百分比反而驟降的非預期手感體驗。
 *
 * @param tank 坦克實體
 */
export function recomputeDerivedStats(tank: Tank): void {
  // 1. 最大生命與當前生命同步增幅
  const oldMaxHp = tank.maxHp;
  const newMaxHp = getMaxHealth(tank.level, tank.statLevels[STAT_MAX_HEALTH]);
  tank.maxHp = newMaxHp;
  if (newMaxHp > oldMaxHp) {
    tank.hp = Math.min(newMaxHp, tank.hp + (newMaxHp - oldMaxHp));
  } else if (tank.hp > newMaxHp) {
    tank.hp = newMaxHp;
  }

  // 2. 坦克尺寸成長 (Lv 1 基準 25 單位，每級 +1%)
  tank.radius = BASE_TANK_RADIUS * sizeFactor(tank.level);

  // 3. 撞擊傷害
  tank.bodyDamage = getBodyDamage(tank.statLevels[STAT_BODY_DAMAGE], 'shape');
  tank.bodyDamageToTank = getBodyDamage(
    tank.statLevels[STAT_BODY_DAMAGE],
    'tank',
  );
  tank.bodyDamageToBullet = getBodyDamage(
    tank.statLevels[STAT_BODY_DAMAGE],
    'bullet',
  );

  // 4. 子彈規格
  tank.bulletHp = getBulletPenetration(
    tank.statLevels[STAT_BULLET_PENETRATION],
  );
  tank.bulletDamage = getBulletDamage(tank.statLevels[STAT_BULLET_DAMAGE]);
  tank.reloadTicks = getReloadTicks(tank.statLevels[STAT_RELOAD]);
  tank.bulletSpeed = getBulletSpeed(tank.statLevels[STAT_BULLET_SPEED]);

  // 5. 移動速度與自然回血
  tank.moveAccelScale = getMovementSpeedMultiplier(
    tank.level,
    tank.statLevels[STAT_MOVEMENT_SPEED],
  );
  tank.regenPerTick = getHealthRegenPerTick(
    tank.maxHp,
    tank.statLevels[STAT_HEALTH_REGEN],
    false,
  );
}
