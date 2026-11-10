import { HYPER_REGEN_TICKS } from '../config/constants';
import {
  getHealthRegenPerTick,
  STAT_HEALTH_REGEN,
} from '../config/stats.config';
import type { Tank } from '../entities/Tank';

/**
 * 生命恢復系統 (RegenSystem)
 * 負責每個模擬 tick 推進自然生命恢復與 30 秒加速回血 (Hyper Regen)
 */
export class RegenSystem {
  /**
   * 每個模擬 tick 更新所有坦克的生命恢復狀態
   * @param tanks 場上坦克列表
   * @param currentTick 當前模擬 tick 編號
   */
  public update(tanks: Tank[], currentTick: number): void {
    const len = tanks.length;
    for (let i = 0; i < len; i++) {
      const tank = tanks[i];
      if (!tank.active || tank.hp >= tank.maxHp) continue;

      const isHyper = currentTick - tank.lastDamageTick >= HYPER_REGEN_TICKS;
      let regen = tank.regenPerTick;

      if (isHyper) {
        regen = getHealthRegenPerTick(
          tank.maxHp,
          tank.statLevels[STAT_HEALTH_REGEN],
          true,
        );
      }

      if (regen > 0) {
        tank.hp = Math.min(tank.maxHp, tank.hp + regen);
      }
    }
  }
}
