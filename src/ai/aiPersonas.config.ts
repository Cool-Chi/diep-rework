import type { TankClassId } from '../config/tanks.config';

/**
 * M9 AI 人設 (Persona) 設定
 * 所有數值皆為 TODO(tune)：無原版對應數據，由 M9 演化訓練與 /goal 迭代微調。
 * 人設只決定「行為」（反應、瞄準誤差、勸架/包夾意識、後座力趕路、配點品質）；
 * 配點主流派仍由職業查表決定（見 aiTactics.applyAiBuild）。
 */
export type PersonaId = 'newbie' | 'aggressor' | 'tactician' | 'apex';

export const PERSONA_IDS: readonly PersonaId[] = [
  'newbie',
  'aggressor',
  'tactician',
  'apex',
];

/**
 * 4 大 AI 人設專屬底盤代表色 (高對比 diep.io 視覺色調)
 * 玩家本體恆為天藍色 (0x00b2e1)
 */
export const PERSONA_COLORS: Readonly<Record<PersonaId, number>> = {
  apex: 0xffaa00, // 耀眼金橙 (Amber Gold)：伺服器霸主高階獵手
  tactician: 0xbf7ff5, // 薰衣草紫 (Soft Purple)：冷靜風箏與控場老手
  aggressor: 0xf14e54, // 珊瑚赤紅 (Coral Red)：狂戰衝鋒與高侵略交火
  newbie: 0x00e16e, // 清新薄荷綠 (Mint Green)：初生農夫
};

/** 人設縮寫標籤（供除錯標籤與多坦克名稱顯示） */
export const PERSONA_TAGS: Readonly<Record<PersonaId, string>> = {
  apex: 'APEX',
  tactician: 'TACTICIAN',
  aggressor: 'AGGRESSOR',
  newbie: 'NEWBIE',
};

export interface AiPersona {
  /** 決策刷新間隔 (ticks)：目標重選、瞄準誤差重抽樣、後座力趕路擲骰皆只在刷新時發生 */
  reactionIntervalTicks: number;
  /** 瞄準角誤差標準差 (rad)，刷新時抽樣一次後保持穩定（嚴禁每 tick 重抽，避免砲管微顫） */
  aimNoiseRad: number;
  /** 預判提前量折扣 0~1（乘上 9.2 彈速下的飛行時間） */
  leadFactor: number;
  /** 殘血勸架傾向 0~1：偏好攻擊低血量敵人 */
  thirdPartyBias: number;
  /** 多敵包夾規避意識 0~1：近距離敵人 ≥ 2 時提早轉為撤退 */
  multiEnemyAwareness: number;
  /** 面對強大敵人的畏懼與主動避退敏感度 0~1.5（見到實力懸殊的強者即使滿血亦優先撤退保命） */
  intimidationSensitivity: number;
  /** 非戰鬥時利用後座力開火趕路的傾向 0~1（僅限允許的職業，見 getRecoilBoostMode） */
  recoilBoostChance: number;
  /** 次優配點機率（Newbie 專用：改用隨機流派，仍受 minStatFloor 保底） */
  suboptimalBuildChance: number;
  /** 非主流派職業（如 BALANCED 類）偏好的流派；null 代表依職業查表 */
  neutralBuildBias: 'GLASS_CANNON' | 'RAMMER' | 'KITER' | null;
  /**
   * 屬性最低保障點數（索引 0:Regen 1:MaxHP 2:BodyDmg 3:BulletSpd 4:BulletPen 5:BulletDmg 6:Reload 7:MoveSpd）
   * 點數不足時依 Reload > BulletPen > BulletSpd > BulletDmg > MaxHP > MoveSpd 輪流補齊，杜絕廢角。
   */
  minStatFloor: readonly number[];
}

export const AI_PERSONAS: Readonly<Record<PersonaId, AiPersona>> = {
  newbie: {
    reactionIntervalTicks: 8,
    aimNoiseRad: 0.14,
    leadFactor: 0.5,
    thirdPartyBias: 0.1,
    multiEnemyAwareness: 0.2,
    intimidationSensitivity: 1.2,
    recoilBoostChance: 0,
    suboptimalBuildChance: 0.3,
    neutralBuildBias: null,
    minStatFloor: [0, 1, 0, 1, 2, 1, 2, 1],
  },
  aggressor: {
    reactionIntervalTicks: 4,
    aimNoiseRad: 0.08,
    leadFactor: 0.75,
    thirdPartyBias: 0.4,
    multiEnemyAwareness: 0.3,
    intimidationSensitivity: 0.4,
    recoilBoostChance: 0.3,
    suboptimalBuildChance: 0,
    neutralBuildBias: 'GLASS_CANNON',
    minStatFloor: [0, 1, 0, 2, 2, 2, 3, 1],
  },
  tactician: {
    reactionIntervalTicks: 3,
    aimNoiseRad: 0.05,
    leadFactor: 0.9,
    thirdPartyBias: 0.6,
    multiEnemyAwareness: 0.7,
    intimidationSensitivity: 1.0,
    recoilBoostChance: 0.5,
    suboptimalBuildChance: 0,
    neutralBuildBias: 'KITER',
    minStatFloor: [0, 1, 0, 2, 3, 2, 3, 3],
  },
  apex: {
    reactionIntervalTicks: 2,
    aimNoiseRad: 0.02, // 保留 0.02 rad 誤差，避免變成完美自瞄
    leadFactor: 1.0,
    thirdPartyBias: 0.9,
    multiEnemyAwareness: 0.9,
    intimidationSensitivity: 0.1,
    recoilBoostChance: 0.9,
    suboptimalBuildChance: 0,
    neutralBuildBias: null,
    minStatFloor: [0, 2, 0, 3, 3, 3, 4, 3],
  },
};

/**
 * 未指派人設 (persona === null) 的坦克沿用 M8 行為：
 * 每 tick 刷新、無瞄準誤差、完整提前量、無勸架/包夾/後座力趕路。
 */
export const LEGACY_PERSONA: AiPersona = {
  reactionIntervalTicks: 1,
  aimNoiseRad: 0,
  leadFactor: 1,
  thirdPartyBias: 0,
  multiEnemyAwareness: 0,
  intimidationSensitivity: 0,
  recoilBoostChance: 0,
  suboptimalBuildChance: 0,
  neutralBuildBias: null,
  minStatFloor: [0, 0, 0, 0, 0, 0, 0, 0],
};

/** 場上人設分佈比例（Newbie 40% / Aggressor 25% / Tactician 25% / Apex 10%） */
export const PERSONA_RATIOS: Readonly<Record<PersonaId, number>> = {
  newbie: 0.4,
  aggressor: 0.25,
  tactician: 0.25,
  apex: 0.1,
};

/**
 * 依 AI 槽位編號回傳固定人設（40 台 → 16/10/10/4），重生沿用同一人設。
 */
export function personaForSlot(slot: number, total: number): PersonaId {
  const newbieCount = Math.round(total * PERSONA_RATIOS.newbie);
  const aggressorCount = Math.round(total * PERSONA_RATIOS.aggressor);
  const tacticianCount = Math.round(total * PERSONA_RATIOS.tactician);
  if (slot < newbieCount) return 'newbie';
  if (slot < newbieCount + aggressorCount) return 'aggressor';
  if (slot < newbieCount + aggressorCount + tacticianCount) return 'tactician';
  return 'apex';
}

export type RecoilBoostMode = 'rear' | 'backfire' | 'none';

/**
 * 後座力趕路職業合理性限制（AI_MAX_TURN_RATE_PER_TICK = 0.2 存在轉向時間成本）：
 * - rear：自帶背向砲管，無需轉頭，朝前進方向瞄準即可由後砲推進（Tri-Angle / Booster / Fighter）
 * - backfire：高後座力職業，僅在感知範圍內無敵方威脅時才把砲口轉向背後（Destroyer / Annihilator / Machine Gun / Penta Shot）
 * - none：其餘職業，狙擊系（Sniper / Assassin / Hunter / Ranger / Predator）絕對禁止為趕路轉向背後
 */
export function getRecoilBoostMode(classId: TankClassId): RecoilBoostMode {
  switch (classId) {
    case 'tri_angle':
    case 'booster':
    case 'fighter':
      return 'rear';
    case 'destroyer':
    case 'annihilator':
    case 'machine_gun':
    case 'penta_shot':
      return 'backfire';
    default:
      return 'none';
  }
}
