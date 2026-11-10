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
  bulletLifespanTicks?: number; // 子彈飛行壽命 (ticks，未填則使用預設 BULLET_LIFESPAN_TICKS = 75)
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
  | 'twin_flank'
  | 'quad_tank'
  | 'hunter'
  | 'gunner'
  | 'tri_angle'
  | 'triplet'
  | 'penta_shot'
  | 'octo_tank'
  | 'ranger'
  | 'predator'
  | 'annihilator'
  | 'booster'
  | 'fighter';

export interface TankDefinition {
  id: TankClassId;
  name: string;
  tier: 1 | 2 | 3 | 4;
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
      bulletLifespanTicks: 75,
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
  evolutions: ['triple_shot', 'quad_tank', 'twin_flank'],
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
      bulletPenMultiplier: 0.9,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
      bulletPenMultiplier: 0.9,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
  evolutions: ['assassin', 'hunter'],
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
      bulletDamageMultiplier: 1.2, // 子彈殺傷力提升
      bulletPenMultiplier: 1.1,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 105,
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
  evolutions: ['destroyer', 'gunner'],
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
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 65,
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
  evolutions: ['tri_angle', 'quad_tank', 'twin_flank'],
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
      bulletLifespanTicks: 75,
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
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 3: 三連發 (Triple Shot) - 正前方與兩側 45 度三向射擊 (兩側在底層，中央在表層) */
export const TRIPLE_SHOT_TANK_DEFINITION: TankDefinition = {
  id: 'triple_shot',
  name: 'Triple Shot',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'twin',
  evolutions: ['triplet', 'penta_shot'],
  barrels: [
    // 兩側砲管（索引 0, 1 先繪製於底層）
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
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 中央主砲管（索引 2 後繪製於表層，重疊處維持完整描邊）
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
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
  evolutions: ['ranger'],
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
      bulletDamageMultiplier: 1.25,
      bulletPenMultiplier: 1.15,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 125,
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
  evolutions: ['annihilator'],
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
      bulletSpeedMultiplier: 0.75, // 原版比 Machine Gun 慢 1.5x (~0.75x)
      bulletDamageMultiplier: 3.5, // 3.5x 毀滅殺傷力 (原版 wiki 30/7 ~ 4.28x)
      bulletPenMultiplier: 2.0, // 2x 巨彈穿透 (原版 wiki doubled)
      bulletSizeMultiplier: 2.0, // 2x 巨型砲彈
      bulletLifespanTicks: 70,
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
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
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
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 3: 四向坦克 (Quad Tank) - 四向 90 度十字發射 (0, 90, 180, 270) */
export const QUAD_TANK_DEFINITION: TankDefinition = {
  id: 'quad_tank',
  name: 'Quad Tank',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'twin',
  evolutions: ['octo_tank'],
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
      recoilMultiplier: 0.25,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.75,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 2, // 90 度
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.25,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.75,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI, // 180 度
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.25,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.75,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 2, // 270 度
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.25,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.75,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 3: 獵人 (Hunter) - 同軸疊管交替射擊 (底層短粗重彈 + 表層長細輕彈) */
export const HUNTER_TANK_DEFINITION: TankDefinition = {
  id: 'hunter',
  name: 'Hunter',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.15, // 原版 Wiki 視野約 +15%
  cardColor: 0x00b2e1, // 藍色系
  parentClassId: 'sniper',
  evolutions: ['predator'],
  barrels: [
    // 底層砲管 (先畫，位於後方)：較短較粗 (寬 24, 長 38)
    {
      length: 38,
      width: 24,
      tipWidth: 24,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.5,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.25,
      bulletDamageMultiplier: 0.95,
      bulletPenMultiplier: 0.9,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 95,
    },
    // 表層砲管 (後畫，覆蓋在上方)：較長較細 (寬 18, 長 48)
    {
      length: 48,
      width: 18,
      tipWidth: 18,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.25, // 0.25 相位差二連發
      reloadMultiplier: 1.5,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.35,
      bulletDamageMultiplier: 0.75,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.75,
      bulletLifespanTicks: 95,
    },
  ],
};

/** Tier 3: 砲手 (Gunner) - 4 根密集平行小口徑管 (外側短管在底層、內側長管在表層) */
export const GUNNER_TANK_DEFINITION: TankDefinition = {
  id: 'gunner',
  name: 'Gunner',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0x00e16e, // 綠色系
  parentClassId: 'machine_gun',
  evolutions: [],
  barrels: [
    // 外側左管 (長 30, offsetY -12, 索引 0 先畫於底層)
    {
      length: 30,
      width: 10,
      offsetX: 0,
      offsetY: -12,
      angle: 0,
      spread: 0.05,
      fireDelayRatio: 0.25,
      reloadMultiplier: 0.67,
      recoilMultiplier: 0.4,
      bulletSpeedMultiplier: 1.25,
      bulletDamageMultiplier: 0.45,
      bulletPenMultiplier: 0.55,
      bulletSizeMultiplier: 0.5,
      bulletLifespanTicks: 70,
    },
    // 外側右管 (長 30, offsetY 12, 索引 1 先畫於底層)
    {
      length: 30,
      width: 10,
      offsetX: 0,
      offsetY: 12,
      angle: 0,
      spread: 0.05,
      fireDelayRatio: 0.75,
      reloadMultiplier: 0.67,
      recoilMultiplier: 0.4,
      bulletSpeedMultiplier: 1.25,
      bulletDamageMultiplier: 0.45,
      bulletPenMultiplier: 0.55,
      bulletSizeMultiplier: 0.5,
      bulletLifespanTicks: 70,
    },
    // 內側左管 (長 38, offsetY -5, 索引 2 後畫於表層)
    {
      length: 38,
      width: 10,
      offsetX: 0,
      offsetY: -5,
      angle: 0,
      spread: 0.05,
      fireDelayRatio: 0,
      reloadMultiplier: 0.67,
      recoilMultiplier: 0.4,
      bulletSpeedMultiplier: 1.25,
      bulletDamageMultiplier: 0.45,
      bulletPenMultiplier: 0.55,
      bulletSizeMultiplier: 0.5, // 半徑 4.5 (觸發 smallTexture)
      bulletLifespanTicks: 70,
    },
    // 內側右管 (長 38, offsetY 5, 索引 3 後畫於表層)
    {
      length: 38,
      width: 10,
      offsetX: 0,
      offsetY: 5,
      angle: 0,
      spread: 0.05,
      fireDelayRatio: 0.5,
      reloadMultiplier: 0.67,
      recoilMultiplier: 0.4,
      bulletSpeedMultiplier: 1.25,
      bulletDamageMultiplier: 0.45,
      bulletPenMultiplier: 0.55,
      bulletSizeMultiplier: 0.5,
      bulletLifespanTicks: 70,
    },
  ],
};

/** Tier 3: 三角坦克 (Tri-Angle) - 前主砲 + 雙後置推進反衝噴射管 (高機動力) */
export const TRI_ANGLE_TANK_DEFINITION: TankDefinition = {
  id: 'tri_angle',
  name: 'Tri-Angle',
  tier: 3,
  requiredLevel: 30,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xbf7ff5, // 紫色系
  parentClassId: 'flank_guard',
  evolutions: ['booster', 'fighter'],
  barrels: [
    // 前方主砲
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
      bulletLifespanTicks: 75,
    },
    // 後方左推進管 (150 度)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: (5 * Math.PI) / 6,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.6, // 強烈後座力衝量推動前進
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.4,
      bulletPenMultiplier: 0.4,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 60,
    },
    // 後方右推進管 (-150 度)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -(5 * Math.PI) / 6,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.6,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.4,
      bulletPenMultiplier: 0.4,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 60,
    },
  ],
};

/** Tier 4: 三重砲 (Triplet) - 前方三管密集平行射擊 (兩側在底層，中央長管在表層) */
export const TRIPLET_TANK_DEFINITION: TankDefinition = {
  id: 'triplet',
  name: 'Triplet',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'triple_shot',
  evolutions: [],
  barrels: [
    // 左側砲管 (長 36, 延遲 0.5，索引 0 先畫於底層)
    {
      length: 36,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: -12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.85,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 右側砲管 (長 36, 延遲 0.5，索引 1 先畫於底層)
    {
      length: 36,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 12,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.85,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 中間長砲管 (長 44, 延遲 0，索引 2 後畫於表層，重疊處維持完整輪廓)
    {
      length: 44,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.7,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.85,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 4: 五連發 (Penta Shot) - 前方五向扇形覆蓋 (外側底層 -> 內側中層 -> 中央表層疊合) */
export const PENTA_SHOT_TANK_DEFINITION: TankDefinition = {
  id: 'penta_shot',
  name: 'Penta Shot',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'triple_shot',
  evolutions: [],
  barrels: [
    // 外側左管 (-45 度，長 32，索引 0 最底層)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 4,
      spread: 0,
      fireDelayRatio: 0.67,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 外側右管 (+45 度，長 32，索引 1 最底層)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 4,
      spread: 0,
      fireDelayRatio: 0.67,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 內側左管 (-22.5 度，長 38，索引 2 中間層)
    {
      length: 38,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 8,
      spread: 0,
      fireDelayRatio: 0.33,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 內側右管 (+22.5 度，長 38，索引 3 中間層)
    {
      length: 38,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 8,
      spread: 0,
      fireDelayRatio: 0.33,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 中央主管 (最長 44 單位，索引 4 最表層，完整描邊突出)
    {
      length: 44,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.6,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 4: 八向坦克 (Octo Tank) - 八方全方位散射 (4 主軸與 4 對角線交替開火) */
export const OCTO_TANK_DEFINITION: TankDefinition = {
  id: 'octo_tank',
  name: 'Octo Tank',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xffe869, // 黃色系
  parentClassId: 'quad_tank',
  evolutions: [],
  barrels: [
    // 4 根主軸管 (0, 90, 180, 270 度，相位 0)
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 2,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 2,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    // 4 根對角線管 (45, 135, 225, 315 度，相位 0.5 交替)
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 4,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: (3 * Math.PI) / 4,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -(3 * Math.PI) / 4,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 4,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.15,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.65,
      bulletPenMultiplier: 0.75,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 4: 遊俠 (Ranger) - 極限長管、全遊戲最高視野 (FOV 1.428) 與超高速彈 */
export const RANGER_TANK_DEFINITION: TankDefinition = {
  id: 'ranger',
  name: 'Ranger',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.428, // 原版 Wiki 視野 +42.8%
  cardColor: 0x00b2e1, // 藍色系
  parentClassId: 'assassin',
  evolutions: [],
  barrels: [
    {
      length: 70, // 長達 70 單位超長身管
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.8,
      recoilMultiplier: 1.5,
      bulletSpeedMultiplier: 1.8, // 1.8x 極限初速
      bulletDamageMultiplier: 1.4,
      bulletPenMultiplier: 1.25,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 140, // 遠程飛行壽命
    },
  ],
};

/** Tier 4: 掠奪者 (Predator) - 三重疊管 (大中小三彈梯次射擊，FOV 1.35，38/48/58 階梯鏡筒) */
export const PREDATOR_TANK_DEFINITION: TankDefinition = {
  id: 'predator',
  name: 'Predator',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.35, // 原版 Wiki 視野 +35%
  cardColor: 0x00b2e1, // 藍色系
  parentClassId: 'hunter',
  evolutions: [],
  barrels: [
    // 底層砲管 (最粗最短，寬 26, 長 38，相位 0，發射巨彈)
    {
      length: 38,
      width: 26,
      tipWidth: 26,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.75,
      recoilMultiplier: 1.25,
      bulletSpeedMultiplier: 1.3,
      bulletDamageMultiplier: 0.95,
      bulletPenMultiplier: 0.9,
      bulletSizeMultiplier: 1.0,
      bulletLifespanTicks: 110,
    },
    // 中層砲管 (寬 20, 長 48，相位 0.2，發射中彈)
    {
      length: 48,
      width: 20,
      tipWidth: 20,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.2,
      reloadMultiplier: 1.75,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.45,
      bulletDamageMultiplier: 0.8,
      bulletPenMultiplier: 0.85,
      bulletSizeMultiplier: 0.85,
      bulletLifespanTicks: 110,
    },
    // 頂層砲管 (最細最長，寬 15, 長 58，相位 0.4，發射高速輕彈)
    {
      length: 58,
      width: 15,
      tipWidth: 15,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0.4,
      reloadMultiplier: 1.75,
      recoilMultiplier: 0.8,
      bulletSpeedMultiplier: 1.6,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.7,
      bulletLifespanTicks: 110,
    },
  ],
};

/** Tier 4: 殲滅者 (Annihilator) - 寬 48 長 38 厚重方口身管、超巨型砲彈、火箭推進級後座力 */
export const ANNIHILATOR_TANK_DEFINITION: TankDefinition = {
  id: 'annihilator',
  name: 'Annihilator',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0x00e16e, // 綠色系
  parentClassId: 'destroyer',
  evolutions: [],
  barrels: [
    {
      length: 38,
      width: 48, // 寬達 48 巨型口徑身管 (長度 38 形成原版方厚剪影)
      tipWidth: 48,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 3.25,
      recoilMultiplier: 4.5, // 4.5x 火箭推進衝量
      bulletSpeedMultiplier: 0.75,
      bulletDamageMultiplier: 3.8,
      bulletPenMultiplier: 2.2,
      bulletSizeMultiplier: 2.67, // 半徑約 24.0 (觸發 hugeTexture 巨彈貼圖)
      bulletLifespanTicks: 70,
    },
  ],
};

/** Tier 4: 推進者 (Booster) - 主砲 + 雙排 4 根後置噴射管 (外側底層 -> 內側表層疊管) */
export const BOOSTER_TANK_DEFINITION: TankDefinition = {
  id: 'booster',
  name: 'Booster',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xbf7ff5, // 紫色系
  parentClassId: 'tri_angle',
  evolutions: [],
  barrels: [
    // 外側左噴射管 (155 度, 長 28, 相位 0.5 交替，索引 0 最底層)
    {
      length: 28,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: (155 * Math.PI) / 180,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 55,
    },
    // 外側右噴射管 (-155 度, 長 28, 相位 0.5 交替，索引 1 最底層)
    {
      length: 28,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -(155 * Math.PI) / 180,
      spread: 0,
      fireDelayRatio: 0.5,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 55,
    },
    // 內側左噴射管 (145 度, 長 34, 相位 0，索引 2 中間表層覆蓋外側)
    {
      length: 34,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: (145 * Math.PI) / 180,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 55,
    },
    // 內側右噴射管 (-145 度, 長 34, 相位 0，索引 3 中間表層覆蓋外側)
    {
      length: 34,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -(145 * Math.PI) / 180,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 55,
    },
    // 前主砲 (索引 4，前方突出)
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
      bulletLifespanTicks: 75,
    },
  ],
};

/** Tier 4: 戰鬥機 (Fighter) - 前主砲 + 左右 90 度側翼打擊管 + 雙後置推進管 */
export const FIGHTER_TANK_DEFINITION: TankDefinition = {
  id: 'fighter',
  name: 'Fighter',
  tier: 4,
  requiredLevel: 45,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  cardColor: 0xbf7ff5, // 紫色系
  parentClassId: 'tri_angle',
  evolutions: [],
  barrels: [
    // 前主砲
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
      bulletLifespanTicks: 75,
    },
    // 左側翼管 (-90 度, 長 34)
    {
      length: 34,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -Math.PI / 2,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 70,
    },
    // 右側翼管 (+90 度, 長 34)
    {
      length: 34,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: Math.PI / 2,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 0.5,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.7,
      bulletPenMultiplier: 0.8,
      bulletSizeMultiplier: 0.9,
      bulletLifespanTicks: 70,
    },
    // 後方左推進管 (150 度)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: (5 * Math.PI) / 6,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.4,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 60,
    },
    // 後方右推進管 (-150 度)
    {
      length: 32,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: -(5 * Math.PI) / 6,
      spread: 0,
      fireDelayRatio: 0,
      reloadMultiplier: 1.0,
      recoilMultiplier: 1.4,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 0.35,
      bulletPenMultiplier: 0.35,
      bulletSizeMultiplier: 0.8,
      bulletLifespanTicks: 60,
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
  quad_tank: QUAD_TANK_DEFINITION,
  hunter: HUNTER_TANK_DEFINITION,
  gunner: GUNNER_TANK_DEFINITION,
  tri_angle: TRI_ANGLE_TANK_DEFINITION,
  triplet: TRIPLET_TANK_DEFINITION,
  penta_shot: PENTA_SHOT_TANK_DEFINITION,
  octo_tank: OCTO_TANK_DEFINITION,
  ranger: RANGER_TANK_DEFINITION,
  predator: PREDATOR_TANK_DEFINITION,
  annihilator: ANNIHILATOR_TANK_DEFINITION,
  booster: BOOSTER_TANK_DEFINITION,
  fighter: FIGHTER_TANK_DEFINITION,
};
