import type { PersonaId } from '../ai/aiPersonas.config';
import {
  BASE_BULLET_SPEED,
  BASE_TANK_RADIUS,
  COLOR_TANK_BLUE,
  MAX_TANK_BARRELS,
  SPAWN_INVULNERABLE_TICKS,
} from '../config/constants';
import {
  BASIC_TANK_DEFINITION,
  type TankDefinition,
} from '../config/tanks.config';

export interface InputCommand {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shooting: boolean;
}

export { MAX_TANK_BARRELS };

/**
 * 坦克實體模型（純扁平數值，遵循 Zero-Allocation 鐵律）
 */
export class Tank {
  public id: number;
  public active = true;

  // 暱稱、陣營色彩與 AI 標記
  public name = 'Player';
  public color: number = COLOR_TANK_BLUE;
  public isAi = false;

  // 重生無敵保護與肉搏冷卻狀態
  public invulnerableTicks = 0; // 重生無敵剩餘 ticks (75 ticks = 3 秒)
  public lastBodyContactTick = 0; // 上次承受肉搏撞擊之 tick (用於防秒殺冷卻)
  public isGodMode = false; // 無敵模式（不受任何子彈、形狀或敵方肉搏傷害）

  // AI 戰術狀態機 (包含滯後防抖計時器)
  public aiState: 'farming' | 'engaging' | 'retreating' = 'farming';
  public aiStateTimer = 0; // 當前狀態已維持的 ticks
  public aiTargetId = -1; // 當前鎖定目標 ID
  public aiStrafeDirection = 1; // 側向環繞方向 (1 或 -1)
  public aiTargetShapeId = -1; // 當前鎖定之形狀 ID (農怪防抖)
  public aiTargetStickinessTimer = 0; // 當前形狀已鎖定 ticks
  public aiCurrentAimAngle = 0; // AI 當前虛擬砲管朝向弧度 (用於擬人化平滑旋轉)
  public aiInterceptBulletIdx = -1; // 當前鎖定攔截之子彈索引 (Pool Index)
  public aiInterceptTimer = 0; // 攔截鎖定維持 ticks (預設 10 ticks 防抖)

  // M9 人設狀態（persona === null 代表沿用 M8 行為：每 tick 決策、無瞄準誤差）
  public persona: PersonaId | null = null;
  public aiDecisionTimer = 0; // 距下次決策刷新剩餘 ticks（<= 0 時刷新）
  public aiNoiseOffset = 0; // 瞄準角偏移 (rad)，僅在決策刷新/換目標時抽樣一次並保持穩定
  public aiSkillJitter = 1; // 每次重生於人設範圍內的技巧抖動係數
  public aiRecoilBoost = false; // 本決策週期是否啟用後座力趕路（刷新時擲骰）
  public aiNearEnemyCount = 0; // 上次搜尋時近距離 (450) 敵方坦克數

  // 扁平世界座標（唯一真值，以 25 單位/格為基準）
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public vx = 0;
  public vy = 0;
  public radius: number;
  public rotation = 0; // 砲管/本體朝向（弧度）
  public prevRotation = 0; // 上一模擬 tick 砲管朝向（供高刷渲染插值）

  // 等級與技能點狀態
  public level = 1;
  public score = 0;
  public statPoints = 0;
  public readonly statLevels = new Uint8Array(8); // 8 項屬性加點 (0 ~ 7)
  public lastDamageTick = 0; // 上次受傷模擬 tick 編號（用於 30 秒加速回血）

  // 衍生戰鬥屬性 (由 recomputeDerivedStats 統一重算與快取)
  public hp = 50;
  public maxHp = 50;
  public regenPerTick = 0; // 基礎每 tick 自然回血量
  public bodyDamage = 20; // 撞擊傷害基準 (對形狀: (p=0: (0+5)*4))
  public bodyDamageToTank = 30; // 撞擊傷害基準 (對坦克: (p=0: (0+5)*6))
  public bodyDamageToBullet = 5; // 撞擊傷害基準 (對子彈: (p=0: p+5))
  public bulletHp = 1.2; // 子彈生命值 (穿透力，原版基準 1.2)
  public bulletDamage = 7; // 子彈殺傷力
  public reloadTicks = 15; // 射擊裝填間隔 ticks
  public bulletSpeed: number = BASE_BULLET_SPEED; // 子彈初速
  public moveAccelScale = 1.0; // 移動加速度縮放倍率

  public reloadCooldown = 0; // 當前剩餘裝填冷卻 tick 數
  public readonly barrelCooldowns = new Int32Array(MAX_TANK_BARRELS); // 固定預配砲管獨立冷卻 (零 GC)
  public readonly barrelRecoils = new Float32Array(MAX_TANK_BARRELS); // 各砲管即時後座力收縮偏移 (世界單位)
  public readonly prevBarrelRecoils = new Float32Array(MAX_TANK_BARRELS); // 上一 tick 後座力收縮偏移 (供高刷渲染插值)

  // 坦克定義 (Tier 1 ~ Tier 3)
  public definition: TankDefinition = BASIC_TANK_DEFINITION;

  // 預先配置、重複使用的 InputCommand 物件，供 InputManager (玩家) 或 AISystem (AI) 寫入
  public readonly input: InputCommand = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    shooting: false,
  };

  constructor(
    id: number,
    startX: number,
    startY: number,
    radius: number = BASE_TANK_RADIUS,
  ) {
    this.id = id;
    this.x = startX;
    this.y = startY;
    this.prevX = startX;
    this.prevY = startY;
    this.radius = radius;
    this.resetBarrelCooldowns();
  }

  /**
   * 切換職業定義並重設砲管冷卻狀態
   */
  public setClass(definition: TankDefinition): void {
    this.definition = definition;
    this.resetBarrelCooldowns();
    this.barrelRecoils.fill(0);
    this.prevBarrelRecoils.fill(0);
  }

  /**
   * 重設砲管冷卻（依照相位延遲比例初始化）
   */
  public resetBarrelCooldowns(): void {
    const barrels = this.definition.barrels;
    const len = barrels.length;
    for (let b = 0; b < MAX_TANK_BARRELS; b++) {
      if (b < len) {
        const ratio = barrels[b].fireDelayRatio || 0;
        this.barrelCooldowns[b] = Math.round(this.reloadTicks * ratio);
      } else {
        this.barrelCooldowns[b] = 0;
      }
    }
  }

  /**
   * 重生並重置狀態
   */
  public respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.active = true;
    this.invulnerableTicks = SPAWN_INVULNERABLE_TICKS;
    this.lastBodyContactTick = 0;
    this.rotation = 0;
    this.prevRotation = 0;
    this.aiInterceptBulletIdx = -1;
    this.aiInterceptTimer = 0;
    this.aiDecisionTimer = 0;
    this.aiNoiseOffset = 0;
    this.aiRecoilBoost = false;
    this.aiNearEnemyCount = 0;
    this.resetBarrelCooldowns();
    this.barrelRecoils.fill(0);
    this.prevBarrelRecoils.fill(0);
  }

  /**
   * 重設等級與屬性點數為初始狀態 (Lv 1)
   */
  public resetStats(): void {
    this.level = 1;
    this.score = 0;
    this.statPoints = 0;
    this.statLevels.fill(0);
    this.lastDamageTick = 0;
  }

  /**
   * 每個模擬 tick 開始前先將當前座標與朝向拷貝至上一 tick 座標，供渲染插值
   */
  public prepareStep(): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevRotation = this.rotation;
    this.prevBarrelRecoils.set(this.barrelRecoils);
  }
}
