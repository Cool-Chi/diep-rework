import {
  BASE_BARREL_LENGTH,
  BASE_BARREL_WIDTH,
  BASE_TANK_RADIUS,
} from './constants';

export interface BarrelConfig {
  length: number; // 砲管長度（世界單位）
  width: number; // 砲管寬度（世界單位）
  tipWidth?: number; // 砲管口寬度（可選喇叭口）
  offsetX: number; // 安裝縱向偏移
  offsetY: number; // 安裝橫向偏移
  angle: number; // 砲管朝向弧度（相對坦克角度）
  spread: number; // 散射角半幅（弧度）
  recoilMultiplier: number; // 後座力係數
  bulletSpeedMultiplier: number;
  bulletDamageMultiplier: number;
  bulletPenMultiplier: number;
  bulletSizeMultiplier: number;
}

export type TankClassId = 'basic';

export interface TankDefinition {
  id: TankClassId;
  name: string;
  tier: 1 | 2 | 3;
  requiredLevel: number;
  bodyRadius: number;
  barrels: BarrelConfig[];
  fovMultiplier: number;
}

export const BASIC_TANK_DEFINITION: TankDefinition = {
  id: 'basic',
  name: 'Basic Tank',
  tier: 1,
  requiredLevel: 1,
  bodyRadius: BASE_TANK_RADIUS,
  fovMultiplier: 1.0,
  barrels: [
    {
      length: BASE_BARREL_LENGTH,
      width: BASE_BARREL_WIDTH,
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      spread: 0,
      recoilMultiplier: 1.0,
      bulletSpeedMultiplier: 1.0,
      bulletDamageMultiplier: 1.0,
      bulletPenMultiplier: 1.0,
      bulletSizeMultiplier: 1.0,
    },
  ],
};

export const TANKS_CONFIG: Record<TankClassId, TankDefinition> = {
  basic: BASIC_TANK_DEFINITION,
};
