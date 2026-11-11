import { TOTAL_STATS } from '../config/stats.config';
import type { TankClassId } from '../config/tanks.config';
import { recomputeDerivedStats } from '../core/deriveStats';
import { createRandomSeed, Mulberry32, type Rng } from '../core/rng';
import type { Tank } from '../entities/Tank';
import { AI_PERSONAS, LEGACY_PERSONA } from './aiPersonas.config';

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

const defaultRng: Rng = new Mulberry32(createRandomSeed());

export function getRandomBotColor(rng: Rng = defaultRng): number {
  const idx = rng.nextInt(BOT_PALETTE.length);
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

export type BuildArchetypeId = keyof typeof AI_BUILD_ARCHETYPES;

const ARCHETYPE_IDS: readonly BuildArchetypeId[] = [
  'GLASS_CANNON',
  'RAMMER',
  'BALANCED',
  'KITER',
];

/** 保底點數補齊順序：Reload > BulletPen > BulletSpd > BulletDmg > MaxHP > MoveSpd */
const FLOOR_FILL_ORDER: readonly number[] = [6, 4, 3, 5, 1, 7, 0, 2];

/**
 * 依職業查表取得主流派（職業決定配點，不隨機）
 */
export function getClassBuildArchetype(cid: TankClassId): BuildArchetypeId {
  if (
    cid === 'sniper' ||
    cid === 'assassin' ||
    cid === 'hunter' ||
    cid === 'ranger' ||
    cid === 'predator'
  ) {
    return 'KITER';
  }
  if (cid === 'destroyer' || cid === 'annihilator') {
    return 'GLASS_CANNON';
  }
  if (
    cid === 'twin' ||
    cid === 'triple_shot' ||
    cid === 'machine_gun' ||
    cid === 'gunner' ||
    cid === 'triplet'
  ) {
    return 'GLASS_CANNON';
  }
  if (cid === 'tri_angle' || cid === 'booster') {
    return 'RAMMER';
  }
  return 'BALANCED';
}

/**
 * 為 AI 坦克分配可支配的技能點數
 * - 主流派由職業查表決定；BALANCED 類職業可依人設偏好微調（Aggressor 偏玻璃大砲、Tactician 偏風箏）
 * - Newbie 有機率改用隨機流派（次優配點），但所有人設皆受 minStatFloor 保底，杜絕廢角
 * @param rng 注入的確定性 PRNG（訓練可重現）
 */
export function applyAiBuild(tank: Tank, rng: Rng = defaultRng): void {
  if (tank.statPoints <= 0) return;

  const persona = tank.persona ? AI_PERSONAS[tank.persona] : LEGACY_PERSONA;
  let archetype = getClassBuildArchetype(tank.definition.id);

  if (archetype === 'BALANCED' && persona.neutralBuildBias) {
    archetype = persona.neutralBuildBias;
  }
  if (
    persona.suboptimalBuildChance > 0 &&
    rng.chance(persona.suboptimalBuildChance)
  ) {
    archetype = ARCHETYPE_IDS[rng.nextInt(ARCHETYPE_IDS.length)];
  }
  const preference: readonly number[] = AI_BUILD_ARCHETYPES[archetype];

  // 1. 保底點數：輪流補齊，點數不足時優先保證輸出與射速
  const floor = persona.minStatFloor;
  let progressed = true;
  while (tank.statPoints > 0 && progressed) {
    progressed = false;
    for (let i = 0; i < FLOOR_FILL_ORDER.length && tank.statPoints > 0; i++) {
      const stat = FLOOR_FILL_ORDER[i];
      if (
        tank.statLevels[stat] < (floor[stat] ?? 0) &&
        tank.statLevels[stat] < 7
      ) {
        tank.statLevels[stat]++;
        tank.statPoints--;
        progressed = true;
      }
    }
  }

  // 2. 依流派優先順序將剩餘點數分配至上限 7
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
    case 'ranger':
      return 620;
    case 'predator':
      return 560;
    case 'assassin':
      return 520;
    case 'hunter':
      return 480;
    case 'sniper':
      return 460;
    case 'annihilator':
      return 240;
    case 'destroyer':
      return 250;
    case 'booster':
      return 200;
    case 'tri_angle':
      return 220;
    case 'fighter':
      return 300;
    case 'octo_tank':
      return 280;
    case 'penta_shot':
    case 'machine_gun':
      return 320;
    case 'quad_tank':
      return 300;
    case 'triplet':
    case 'twin':
    case 'triple_shot':
    case 'twin_flank':
    case 'gunner':
      return 360;
    default:
      return 340;
  }
}
