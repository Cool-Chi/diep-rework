import {
  BASE_BARREL_LENGTH,
  BASE_BARREL_WIDTH,
  BASE_TANK_RADIUS,
} from './constants';

export interface BarrelConfig {
  length: number; // 砲管長度（世界單位）
  width: number; // 砲管底座寬度（世界單位）
  tipWidth?: number; // 砲管口寬度（可選喇叭口，如 Machine Gun）
  offsetX: number; // 安裝縱向偏移
  offsetY: number; // 安裝橫向偏移
  angle: number; // 砲管朝向弧度（相對坦克角度）
  spread: number; // 散射角半幅（弧度）
  fireDelayRatio: number; // 開火相位延遲比例 (0~1，如 Twin 為 0 與 0.5)
  reloadMultiplier: number; // 裝填冷卻時間倍率 (Sniper 1.5, Machine Gun 0.67)
  recoilMultiplier: number; // 後座力係數
  bulletSpeedMultiplier: number;
  bulletDamageMultiplier: number;
  bulletPenMultiplier: number;
  bulletSizeMultiplier: number;
}

export type TankClassId =
  | 'basic'
  | 'twin'
  | 'sniper'
  | 'machine_gun'
  | 'flank_guard'
  | 'triple_shot'
  | 'assassin'
  | 'destroyer'
  | 'twin_flank';

export interface TankDefinition {
  id: TankClassId;
  name: string;
  tier: 1 | 2 | 3;
  requiredLevel: number;
  bodyRadius: number;
  barrels: BarrelConfig[];
  fovMultiplier: number;
  cardColor: number; // 卡牌專屬主題色
  parentClassId?: TankClassId;
  evolutions: TankClassId[];
}

/** Tier 1: 基礎坦克 (Basic Tank) */
export const BASIC_TANK_DEFINITION: TankDefinition = {
  id: 'basic',
  name: 'Basic Tank',
  tier: 1,
  requiredLevel: 1,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0x00b2e1,
  evolutions: ['twin', 'sniper', 'machine_gun', 'flank_guard'],
  barrels: [
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 1.0,
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 2: 雙砲坦克 (Twin) - 平行雙管交替射擊 */
export const TWIN_TANK_DEFINITION: TankDefinition = {
  id: 'twin',
  name: 'Twin',
  tier: 2,
  requiredLevel: 15,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'basic',
  evolutions: ['triple_shot'], // M4b 延伸為 triple_shot
  barrels: [
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: -12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.75,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.5, // 0.5 相位交替開火
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.75,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 2: 狙擊手 (Sniper) - 長砲管、高初速、超遠視野 (FOV 1.111) */
export const SNIPER_TANK_DEFINITION: TankDefinition = {
  id: 'sniper',
  name: 'Sniper',
  tier: 2,
  requiredLevel: 15,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.111, // 原版 Wiki 視野 +11.1%
  cardColor: 0x00b2e1, // 藍色系
  parentClassId: 'basic',
  evolutions: ['assassin'], // M4b 延伸為 assassin
  barrels: [
    {
      length: 50, // 砲管延伸至 50 單位
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.5, // 裝填時間增長至 1.5x
      recoilMultiplier: 1.25,
      bulletSpeedMultiplier: 1.5, // 子彈速度 1.5x
      bulletDamageMultiplier: 1.25, // 子彈殺傷力提升
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 2: 機槍 (Machine Gun) - 喇叭口砲管、高射速、錐形散射 */
export const MACHINE_GUN_TANK_DEFINITION: TankDefinition = {
  id: 'machine_gun',
  name: 'Machine Gun',
  tier: 2,
  requiredLevel: 15,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0x00e16e, // 綠色系
  parentClassId: 'basic',
  evolutions: ['destroyer'], // M4b 延伸為 destroyer
  barrels: [
    {
      length: 42, // 原版機槍長度約 42 單位
      width: BASE_BARREL_WIDTH,
      tipWidth: 27, // 梯形外擴喇叭口（底座寬度 18 的 1.5 倍）
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0.2, // 散射角半幅 0.20 rad
      fireDelayRatio: 0,
      reloadMultiplier: 0.67, // 裝填冷卻降低至 0.67x（約 10 ticks）
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 0.9,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 2: 側衛 (Flank Guard) - 前後雙向獨立開火 */
export const FLANK_GUARD_TANK_DEFINITION: TankDefinition = {
  id: 'flank_guard',
  name: 'Flank Guard',
  tier: 2,
  requiredLevel: 15,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xbf7ff5, // 紫色系
  parentClassId: 'basic',
  evolutions: ['twin_flank'], // M4b 延伸為 twin_flank
  barrels: [
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 1.0,
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: 30, // 後管略短為 30 單位
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI, // 180 度背向
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.8,
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 3: 三連發 (Triple Shot) - 正前方與兩側 45 度三向射擊 */
export const TRIPLE_SHOT_TANK_DEFINITION: TankDefinition = {
  id: 'triple_shot',
  name: 'Triple Shot',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'twin',
  evolutions: [],
  barrels: [
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 4, // -45 度
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 4, // +45 度
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 3: 暗殺者 (Assassin) - 超長砲管、極限初速、超遠視野 (FOV 1.25) */
export const ASSASSIN_TANK_DEFINITION: TankDefinition = {
  id: 'assassin',
  name: 'Assassin',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.25, // 原版 Wiki 視野 +25%
  cardColor: 0x00b2e1, // 藍色系
  parentClassId: 'sniper',
  evolutions: [],
  barrels: [
    {
      length: 60, // 砲管延伸至 60 單位
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.67,
      recoilMultiplier: 1.25,
      bulletSpeedMultiplier: 1.6, // 子彈速度 1.6x
      bulletDamageMultiplier: 1.3,
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

/** Tier 3: 毀滅者 (Destroyer) - 巨型重砲口 (寬度 36)、巨砲彈、強大後座力 */
export const DESTROYER_TANK_DEFINITION: TankDefinition = {
  id: 'destroyer',
  name: 'Destroyer',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0x00e16e, // 綠色系
  parentClassId: 'machine_gun',
  evolutions: [],
  barrels: [
    {
      length: 42,
      width: 36, // 兩倍寬巨型砲管
      tipWidth: 36,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 3.0, // 裝填時間 3.0x (高威力慢速)
      recoilMultiplier: 3.5, // 3.5x 強烈後座力 (火箭推進)
      bulletSpeedMultiplier: 0.85,
      bulletDamageMultiplier: 3.0, // 3x 毀滅殺傷力
      bulletPenMultiplier: 2.5, // 2.5x 巨彈穿透
      bulletSizeMultiplier: 2.0, // 2x 巨型砲彈
    },
  ],
};

/** Tier 3: 雙向側衛 (Twin Flank) - 前後雙向各 2 管交替射擊 (共 4 管) */
export const TWIN_FLANK_TANK_DEFINITION: TankDefinition = {
  id: 'twin_flank',
  name: 'Twin Flank',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xbf7ff5, // 紫色系
  parentClassId: 'flank_guard',
  evolutions: [],
  barrels: [
    // 前方雙管
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: -12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.6,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.6,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
    // 後方雙管
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: -12,
      angle: Math.PI,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.6,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 12,
      angle: Math.PI,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.6,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.7,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

export const TANKS_CONFIG: Record<TankClassId, TankDefinition> = {
  basic: BASIC_TANK_DEFINITION,
  twin: TWIN_TANK_DEFINITION,
  sniper: SNIPER_TANK_DEFINITION,
  machine_gun: MACHINE_GUN_TANK_DEFINITION,
  flank_guard: FLANK_GUARD_TANK_DEFINITION,
  triple_shot: TRIPLE_SHOT_TANK_DEFINITION,
  assassin: ASSASSIN_TANK_DEFINITION,
  destroyer: DESTROYER_TANK_DEFINITION,
  twin_flank: TWIN_FLANK_TANK_DEFINITION,
};
