import { TOTAL_STATS } from '../config/stats.config';
import type { TankClassId } from '../config/tanks.config';
import { recomputeDerivedStats } from '../core/deriveStats';
import type { Tank } from '../entities/Tank';

/**
 * 柔和且符合原版 diep.io 視覺氛圍的 FFA 敵人底盤色彩庫
 * （避免高飽和刺眼色彩，採用精選自然色調）
 */
export const BOT_PALETTE: readonly number[] = [
  0xf14e54, // 經典珊瑚紅 (Coral Red)
  0x00e16e, // 翠綠/薄荷綠 (Mint Green)
  0xbf7ff5, // 薰衣草紫 (Soft Purple)
  0xffe869, // 琥珀/向日葵黃 (Amber Yellow)
  0xe58842, // 暖橙/焦糖橙 (Warm Orange)
  0x42e5ad, // 湖水青/薄荷藍 (Seafoam Cyan)
];

export function getRandomBotColor(): number {
  const idx = Math.floor(Math.random() * BOT_PALETTE.length);
  return BOT_PALETTE[idx] ?? 0xf14e54;
}

/**
 * 4 大經典戰鬥加點流派（對應 8 項屬性優先投資權重）
 * 索引：0:Regen, 1:MaxHP, 2:BodyDmg, 3:BulletSpd, 4:BulletPen, 5:BulletDmg, 6:Reload, 7:MoveSpd
 */
export const AI_BUILD_ARCHETYPES = {
  // 1. 純玻璃大砲流（狙擊、雙管、重砲偏好）
  GLASS_CANNON: [3, 4, 5, 6, 7, 1, 0, 2],
  // 2. 撞擊肉盾流（近戰肉搏、高生命高移速）
  RAMMER: [1, 2, 7, 0, 3, 5, 6, 4],
  // 3. 穩健均衡流（綜合射程與生存力）
  BALANCED: [4, 5, 6, 1, 3, 7, 0, 2],
  // 4. 極限風箏流（高移速高彈速）
  KITER: [7, 3, 5, 4, 6, 1, 0, 2],
} as const;

/**
 * 為 AI 坦克分配可支配的技能點數
 */
export function applyAiBuild(tank: Tank): void {
  if (tank.statPoints <= 0) return;

  // 依職業選取合理流派偏好
  let preference: readonly number[] = AI_BUILD_ARCHETYPES.BALANCED;
  const cid = tank.definition.id;

  if (cid === 'sniper' || cid === 'assassin') {
    preference = AI_BUILD_ARCHETYPES.KITER;
  } else if (cid === 'destroyer') {
    preference = AI_BUILD_ARCHETYPES.GLASS_CANNON;
  } else if (cid === 'twin' || cid === 'triple_shot' || cid === 'machine_gun') {
    preference = AI_BUILD_ARCHETYPES.GLASS_CANNON;
  } else if (cid === 'flank_guard' || cid === 'twin_flank') {
    preference = AI_BUILD_ARCHETYPES.BALANCED;
  }

  // 依優先順序將剩餘點數分配至上限 7
  let pIdx = 0;
  while (tank.statPoints > 0 && pIdx < TOTAL_STATS) {
    const stat = preference[pIdx];
    if (tank.statLevels[stat] < 7) {
      tank.statLevels[stat]++;
      tank.statPoints--;
    } else {
      pIdx++;
    }
  }

  recomputeDerivedStats(tank);
}

/**
 * 依坦克職業取得最舒適交火距離（世界單位）
 */
export function getOptimalCombatDistance(classId: TankClassId): number {
  switch (classId) {
    case 'assassin':
      return 520;
    case 'sniper':
      return 460;
    case 'destroyer':
      return 250;
    case 'machine_gun':
      return 320;
    case 'twin':
    case 'triple_shot':
    case 'twin_flank':
      return 360;
    default:
      return 340;
  }
}
