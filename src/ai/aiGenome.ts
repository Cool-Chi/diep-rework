import defaultGenomeJson from '../config/aiGenome.json';
import type { TankClassId } from '../config/tanks.config';

/**
 * M9 可訓練戰術基因組 (AiGenome)
 * 預設值 100% 還原 M8 行為（所有權重 1.0、遲滯 1.25、危機曲線 0.55/0.35）。
 *
 * 【M8 凍結紅線】以下項目「不屬於」基因組，載入時一律忽略：
 *   AI_INTERCEPT_MAX_ANGLE (0.62 rad)、AI_INTERCEPT_LOCK_TICKS (4)、邊界切線滑動邏輯。
 * 所有欄位於載入時 clamp 至 GENE_SPECS 的安全範圍，確保演化無法破壞零抖動底座。
 */
export interface AiGenome {
  version: number;
  vectorWeights: {
    combat: number;
    retreat: number;
    farm: number;
    evade: number;
    border: number;
  };
  engageDistanceRatio: {
    twin: number;
    sniper: number;
    machineGun: number;
    flank: number;
  };
  retreatCurve: {
    hpStart: number;
    slope: number;
  };
  targetSwitch: {
    stickiness: number;
  };
}

export type GenomeBranch = 'twin' | 'sniper' | 'machineGun' | 'flank';

/** 職業 → 理想交戰距離比分支；basic 與未列職業回傳 null（比例固定 1.0） */
export function getGenomeBranch(classId: TankClassId): GenomeBranch | null {
  switch (classId) {
    case 'twin':
    case 'triple_shot':
    case 'triplet':
    case 'penta_shot':
      return 'twin';
    case 'sniper':
    case 'assassin':
    case 'hunter':
    case 'ranger':
    case 'predator':
      return 'sniper';
    case 'machine_gun':
    case 'gunner':
    case 'destroyer':
    case 'annihilator':
      return 'machineGun';
    case 'flank_guard':
    case 'twin_flank':
    case 'quad_tank':
    case 'octo_tank':
    case 'tri_angle':
    case 'booster':
    case 'fighter':
      return 'flank';
    default:
      return null;
  }
}

export interface GeneSpec {
  /** 展平鍵，如 vectorWeights.combat */
  key: string;
  min: number;
  max: number;
}

/** 基因展平規格與安全範圍（演化器以此順序將基因組視為實數向量） */
export const GENE_SPECS: readonly GeneSpec[] = [
  { key: 'vectorWeights.combat', min: 0.6, max: 1.6 },
  { key: 'vectorWeights.retreat', min: 0.6, max: 1.6 },
  { key: 'vectorWeights.farm', min: 0.5, max: 1.5 },
  { key: 'vectorWeights.evade', min: 0.7, max: 1.6 },
  { key: 'vectorWeights.border', min: 0.8, max: 1.8 }, // 下限 0.8 保證牆角排斥力不被削弱到死鎖
  { key: 'engageDistanceRatio.twin', min: 0.7, max: 1.4 },
  { key: 'engageDistanceRatio.sniper', min: 0.7, max: 1.4 },
  { key: 'engageDistanceRatio.machineGun', min: 0.7, max: 1.4 },
  { key: 'engageDistanceRatio.flank', min: 0.7, max: 1.4 },
  { key: 'retreatCurve.hpStart', min: 0.4, max: 0.7 },
  { key: 'retreatCurve.slope', min: 1.5, max: 5.0 },
  { key: 'targetSwitch.stickiness', min: 1.15, max: 1.6 }, // 下限 1.15 防止多目標乒乓換鎖
];

function getByKey(g: AiGenome, key: string): number {
  const dot = key.indexOf('.');
  const group = key.slice(0, dot) as keyof AiGenome;
  const field = key.slice(dot + 1);
  const obj = g[group] as unknown as Record<string, number>;
  return obj[field];
}

function setByKey(g: AiGenome, key: string, value: number): void {
  const dot = key.indexOf('.');
  const group = key.slice(0, dot) as keyof AiGenome;
  const field = key.slice(dot + 1);
  const obj = g[group] as unknown as Record<string, number>;
  obj[field] = value;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : Math.min(v, max);
}

export function cloneGenome(g: AiGenome): AiGenome {
  return {
    version: g.version,
    vectorWeights: { ...g.vectorWeights },
    engageDistanceRatio: { ...g.engageDistanceRatio },
    retreatCurve: { ...g.retreatCurve },
    targetSwitch: { ...g.targetSwitch },
  };
}

/**
 * 驗證並載入基因組：缺漏/非有限數值回退為預設值，其餘 clamp 至安全範圍，未知欄位（含凍結紅線欄位）一律忽略。
 * @param raw 任意來源 JSON（熱載入、演化器輸出）
 */
export function sanitizeGenome(raw: unknown): AiGenome {
  const result = cloneGenome(defaultGenomeJson as AiGenome);
  if (typeof raw !== 'object' || raw === null) return result;
  const source = raw as Record<string, unknown>;
  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i];
    const dot = spec.key.indexOf('.');
    const group = source[spec.key.slice(0, dot)];
    if (typeof group !== 'object' || group === null) continue;
    const value = (group as Record<string, unknown>)[spec.key.slice(dot + 1)];
    if (typeof value === 'number' && Number.isFinite(value)) {
      setByKey(result, spec.key, clamp(value, spec.min, spec.max));
    }
  }
  return result;
}

/** 預設基因組（還原 M8 行為） */
export const DEFAULT_GENOME: AiGenome = sanitizeGenome(defaultGenomeJson);

export function genomeToVector(g: AiGenome): number[] {
  const out: number[] = [];
  for (let i = 0; i < GENE_SPECS.length; i++) {
    out.push(getByKey(g, GENE_SPECS[i].key));
  }
  return out;
}

export function vectorToGenome(vec: readonly number[]): AiGenome {
  const g = cloneGenome(DEFAULT_GENOME);
  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i];
    setByKey(
      g,
      spec.key,
      clamp(vec[i] ?? getByKey(g, spec.key), spec.min, spec.max),
    );
  }
  return g;
}
