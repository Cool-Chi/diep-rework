import {
  AI_ARENA_CENTER_X,
  AI_ARENA_CENTER_Y,
  AI_ARENA_SIZE,
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BULLET_LIFESPAN_TICKS,
  COLOR_TANK_BLUE,
  COLOR_TRIANGLE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import { TANKS_CONFIG, type TankClassId } from '../config/tanks.config';
import { recomputeDerivedStats } from '../core/deriveStats';
import type { Game } from '../core/Game';
import type { Tank } from '../entities/Tank';

export type TestBulletType =
  | 'basic'
  | 'destroyer'
  | 'annihilator'
  | 'gunner'
  | 'twin'
  | 'sniper';

export interface BulletPreset {
  radius: number;
  hp: number;
  damage: number;
  speed: number;
  color: number;
}

export const BULLET_PRESETS: Record<TestBulletType, BulletPreset> = {
  basic: {
    radius: BASE_BULLET_RADIUS, // 9
    hp: 1.2,
    damage: 7,
    speed: BASE_BULLET_SPEED, // 9.2
    color: COLOR_TANK_BLUE, // 0x00b2e1
  },
  destroyer: {
    radius: BASE_BULLET_RADIUS * 2.0, // 18
    hp: 16,
    damage: 42,
    speed: 10.0,
    color: COLOR_TANK_BLUE,
  },
  annihilator: {
    radius: BASE_BULLET_RADIUS * 2.67, // ~24
    hp: 18,
    damage: 45,
    speed: 9.5,
    color: COLOR_TANK_BLUE,
  },
  gunner: {
    radius: BASE_BULLET_RADIUS * 0.55, // ~5
    hp: 1,
    damage: 3.5,
    speed: 14.0,
    color: COLOR_TRIANGLE, // 0xfc7677
  },
  twin: {
    radius: BASE_BULLET_RADIUS, // 9
    hp: 2,
    damage: 6.5,
    speed: BASE_BULLET_SPEED,
    color: COLOR_TRIANGLE,
  },
  sniper: {
    radius: BASE_BULLET_RADIUS, // 9
    hp: 3,
    damage: 12,
    speed: 18.0,
    color: COLOR_TANK_BLUE,
  },
};

export interface SpawnClashOptions {
  distance?: number;
  center?: { x: number; y: number };
  bulletCountB?: number;
  streamSpacing?: number;
  clearExisting?: boolean;
  colorA?: number;
  colorB?: number;
}

export interface ClashBenchmarkResult {
  scenario: string;
  totalRuns: number;
  clashDetectedCount: number;
  clashRate: number;
  avgRemainingHpA: number;
  avgRemainingHpB: number;
  avgSurvivalTicksA: number;
  avgSurvivalTicksB: number;
  timeTakenMs: number;
  pushFactor: number;
  damping: number;
}

/**
 * 智能體自主測試與調試接口 (AgentTestInterface)
 * 供 Agent 透過 browsermcp 自動觸發彈幕相消物理基準測試、參數調校與數據採樣
 */
export class AgentTestInterface {
  private game: Game;
  public isSandboxActive = false;
  public sandboxDummyTank: Tank | null = null;
  public sandboxDummyClass: TankClassId = 'basic';

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * 啟動小型子彈相撞測試沙盒：
   * 清除場上所有其他 AI 與幾何形狀，在玩家前方生成一隻固定朝玩家連續開火的測試靶機
   */
  public startBulletSandbox(dummyClass: TankClassId = 'basic'): void {
    this.isSandboxActive = true;
    this.sandboxDummyClass = dummyClass;

    // 1. 暫停自動生成與補滿，並清空場上 AI 與形狀、子彈
    this.game.spawnSystem.isSpawningPaused = true;
    this.game.spawnSystem.clearAllAi();
    this.game.shapeSystem.isAutoFillPaused = true;
    this.game.shapeSystem.clearAll();
    this.clearAllBullets();

    // 2. 玩家保持無敵
    this.game.playerTank.isGodMode = true;
    this.game.playerTank.hp = this.game.playerTank.maxHp;

    // 3. 配置第 1 隻 AI 坦克為 Target Dummy
    const dummy = this.game.spawnSystem.aiTanks[0];
    if (dummy) {
      const def = TANKS_CONFIG[dummyClass] ?? TANKS_CONFIG.basic;
      dummy.respawn(this.game.playerTank.x + 360, this.game.playerTank.y);
      dummy.name = 'Target Dummy';
      dummy.setClass(def);
      dummy.level = Math.max(1, def.requiredLevel);
      dummy.color = 0xfc7677; // 紅色靶機
      dummy.isAi = true;
      dummy.isGodMode = true; // 靶機也無敵，避免被玩家打死後中斷測試
      dummy.invulnerableTicks = 0;
      dummy.active = true;
      dummy.rotation = Math.PI; // 朝左指向玩家
      dummy.prevRotation = Math.PI;
      recomputeDerivedStats(dummy);
      dummy.hp = dummy.maxHp;
      this.sandboxDummyTank = dummy;
    }
  }

  /**
   * 切換靶機職業（如 Basic, Twin, Destroyer, Gunner 等）
   */
  public setSandboxDummyClass(dummyClass: TankClassId): void {
    if (!this.isSandboxActive || !this.sandboxDummyTank) {
      this.startBulletSandbox(dummyClass);
      return;
    }
    this.sandboxDummyClass = dummyClass;
    const def = TANKS_CONFIG[dummyClass] ?? TANKS_CONFIG.basic;
    this.sandboxDummyTank.setClass(def);
    this.sandboxDummyTank.level = Math.max(1, def.requiredLevel);
    recomputeDerivedStats(this.sandboxDummyTank);
    this.sandboxDummyTank.hp = this.sandboxDummyTank.maxHp;
  }

  /**
   * 退出小型測試沙盒，恢復全圖 AI 生態與形狀
   */
  public stopBulletSandbox(): void {
    this.isSandboxActive = false;
    this.sandboxDummyTank = null;

    this.clearAllBullets();
    this.game.spawnSystem.isSpawningPaused = false;
    this.game.shapeSystem.isAutoFillPaused = false;
    this.game.shapeSystem.fillToTarget();
    this.game.spawnSystem.init(this.game.playerTank);
  }

  public isAiDuelActive = false;
  public duelBotAlpha: Tank | null = null;
  public duelBotBeta: Tank | null = null;
  public duelClassAlpha: TankClassId = 'twin';
  public duelClassBeta: TankClassId = 'destroyer';
  private duelRespawnTimerA = 0;
  private duelRespawnTimerB = 0;

  /**
   * 啟動小型 AI 決鬥對戰沙盒 (AI vs AI Small Duel Arena)
   * 限制在 1200x1200 競技場內，生成 Bot Alpha (Twin) 與 Bot Beta (Destroyer) 進行自主決鬥
   */
  public startAiDuelSandbox(
    classA: TankClassId = 'twin',
    classB: TankClassId = 'destroyer',
    isGodMode = true,
  ): void {
    if (this.isSandboxActive) {
      this.stopBulletSandbox();
    }

    this.isAiDuelActive = true;
    this.duelClassAlpha = classA;
    this.duelClassBeta = classB;
    this.duelRespawnTimerA = 0;
    this.duelRespawnTimerB = 0;

    // 1. 設定 AI 專屬競技場邊界
    const half = AI_ARENA_SIZE * 0.5;
    this.game.aiSystem.arenaBounds = {
      minX: AI_ARENA_CENTER_X - half,
      maxX: AI_ARENA_CENTER_X + half,
      minY: AI_ARENA_CENTER_Y - half,
      maxY: AI_ARENA_CENTER_Y + half,
    };

    // 2. 暫停全圖形狀與 AI 自動生成
    this.game.spawnSystem.isSpawningPaused = true;
    this.game.spawnSystem.clearAllAi();
    this.game.shapeSystem.isAutoFillPaused = true;
    this.game.shapeSystem.clearAll();
    this.clearAllBullets();

    // 3. 玩家置於觀戰位置並無敵
    this.game.playerTank.isGodMode = true;
    this.game.playerTank.hp = this.game.playerTank.maxHp;
    this.game.playerTank.x = AI_ARENA_CENTER_X;
    this.game.playerTank.y = AI_ARENA_CENTER_Y - half + 120;
    this.game.playerTank.vx = 0;
    this.game.playerTank.vy = 0;
    this.game.aiSystem.ignorePlayer = true;

    // 4. 配置 Bot Alpha
    const botA = this.game.spawnSystem.aiTanks[0];
    if (botA) {
      this.setupDuelBot(
        botA,
        classA,
        'Bot Alpha',
        AI_ARENA_CENTER_X - 260,
        AI_ARENA_CENTER_Y,
        0,
        0x00b2e1,
        isGodMode,
      );
      this.duelBotAlpha = botA;
    }

    // 5. 配置 Bot Beta
    const botB = this.game.spawnSystem.aiTanks[1];
    if (botB) {
      this.setupDuelBot(
        botB,
        classB,
        'Bot Beta',
        AI_ARENA_CENTER_X + 260,
        AI_ARENA_CENTER_Y,
        Math.PI,
        0xfc7677,
        isGodMode,
      );
      this.duelBotBeta = botB;
    }
  }

  private setupDuelBot(
    bot: Tank,
    tankClass: TankClassId,
    name: string,
    x: number,
    y: number,
    rot: number,
    color: number,
    isGodMode: boolean,
  ): void {
    const def = TANKS_CONFIG[tankClass] ?? TANKS_CONFIG.basic;
    bot.respawn(x, y);
    bot.name = `${name} (${tankClass})`;
    bot.setClass(def);
    bot.level = Math.max(1, def.requiredLevel);
    bot.color = color;
    bot.isAi = true;
    bot.isGodMode = isGodMode;
    bot.invulnerableTicks = 0;
    bot.active = true;
    bot.rotation = rot;
    bot.prevRotation = rot;
    recomputeDerivedStats(bot);
    bot.hp = bot.maxHp;
  }

  /**
   * 退出 AI 決鬥對戰沙盒
   */
  public stopAiDuelSandbox(): void {
    this.isAiDuelActive = false;
    this.duelBotAlpha = null;
    this.duelBotBeta = null;
    this.game.aiSystem.arenaBounds = null;

    this.clearAllBullets();
    this.game.spawnSystem.isSpawningPaused = false;
    this.game.shapeSystem.isAutoFillPaused = false;
    this.game.shapeSystem.fillToTarget();
    this.game.spawnSystem.init(this.game.playerTank);
  }

  /**
   * 切換決鬥職業
   */
  public setAiDuelClasses(classA: TankClassId, classB: TankClassId): void {
    this.duelClassAlpha = classA;
    this.duelClassBeta = classB;
    if (!this.isAiDuelActive) {
      this.startAiDuelSandbox(classA, classB);
      return;
    }
    if (this.duelBotAlpha) {
      const defA = TANKS_CONFIG[classA] ?? TANKS_CONFIG.twin;
      this.duelBotAlpha.setClass(defA);
      this.duelBotAlpha.name = `Bot Alpha (${classA})`;
      this.duelBotAlpha.level = Math.max(1, defA.requiredLevel);
      recomputeDerivedStats(this.duelBotAlpha);
      this.duelBotAlpha.hp = this.duelBotAlpha.maxHp;
    }
    if (this.duelBotBeta) {
      const defB = TANKS_CONFIG[classB] ?? TANKS_CONFIG.destroyer;
      this.duelBotBeta.setClass(defB);
      this.duelBotBeta.name = `Bot Beta (${classB})`;
      this.duelBotBeta.level = Math.max(1, defB.requiredLevel);
      recomputeDerivedStats(this.duelBotBeta);
      this.duelBotBeta.hp = this.duelBotBeta.maxHp;
    }
  }

  /**
   * 切換決鬥 AI 的無敵狀態
   */
  public toggleAiDuelGodMode(): boolean {
    const next = !(this.duelBotAlpha?.isGodMode ?? false);
    if (this.duelBotAlpha) this.duelBotAlpha.isGodMode = next;
    if (this.duelBotBeta) this.duelBotBeta.isGodMode = next;
    return next;
  }

  /**
   * 每 tick 維持決鬥雙方自動滿血或復活（若未開無敵）
   */
  public updateAiDuel(_currentTick: number): void {
    if (!this.isAiDuelActive) return;

    // 確保旁觀玩家無敵
    this.game.playerTank.hp = this.game.playerTank.maxHp;

    if (this.duelBotAlpha && !this.duelBotAlpha.active) {
      this.duelRespawnTimerA++;
      if (this.duelRespawnTimerA >= 25) {
        this.duelRespawnTimerA = 0;
        this.setupDuelBot(
          this.duelBotAlpha,
          this.duelClassAlpha,
          'Bot Alpha',
          AI_ARENA_CENTER_X - 260,
          AI_ARENA_CENTER_Y,
          0,
          0x00b2e1,
          this.duelBotAlpha.isGodMode,
        );
      }
    }

    if (this.duelBotBeta && !this.duelBotBeta.active) {
      this.duelRespawnTimerB++;
      if (this.duelRespawnTimerB >= 25) {
        this.duelRespawnTimerB = 0;
        this.setupDuelBot(
          this.duelBotBeta,
          this.duelClassBeta,
          'Bot Beta',
          AI_ARENA_CENTER_X + 260,
          AI_ARENA_CENTER_Y,
          Math.PI,
          0xfc7677,
          this.duelBotBeta.isGodMode,
        );
      }
    }
  }

  /**
   * 清空場上所有活躍子彈
   */
  public clearAllBullets(): void {
    const pool = this.game.bulletPool;
    const cap = pool.capacity;
    for (let i = 0; i < cap; i++) {
      if (pool.isActive(i)) {
        pool.items[i].active = false;
        pool.release(i);
      }
    }
  }

  /**
   * 生成一組對撞測試子彈（可為 1v1 或 1vN 彈幕）
   */
  public spawnClash(
    typeA: TestBulletType = 'basic',
    typeB: TestBulletType = 'basic',
    options?: SpawnClashOptions,
  ): { spawnedA: number[]; spawnedB: number[] } {
    if (options?.clearExisting) {
      this.clearAllBullets();
    }

    const pool = this.game.bulletPool;
    const presetA = BULLET_PRESETS[typeA] ?? BULLET_PRESETS.basic;
    const presetB = BULLET_PRESETS[typeB] ?? BULLET_PRESETS.basic;

    const dist = options?.distance ?? 350;
    const cx = options?.center?.x ?? this.game.playerTank.x;
    const cy = options?.center?.y ?? this.game.playerTank.y;
    const countB = Math.max(1, options?.bulletCountB ?? 1);
    const spacing = options?.streamSpacing ?? 30;

    const spawnedA: number[] = [];
    const spawnedB: number[] = [];

    // 生成 Bullet A（向右飛行，ownerId = 10001）
    const idxA = pool.acquire();
    if (idxA !== -1) {
      const bA = pool.items[idxA];
      bA.init(
        idxA,
        10001,
        cx - dist * 0.5,
        cy,
        presetA.speed,
        0,
        presetA.radius,
        presetA.hp,
        presetA.damage,
        BULLET_LIFESPAN_TICKS,
        options?.colorA ?? presetA.color,
      );
      spawnedA.push(idxA);
    }

    // 生成 Bullet B 群（向左飛行，ownerId = 10002）
    for (let i = 0; i < countB; i++) {
      const idxB = pool.acquire();
      if (idxB !== -1) {
        const bB = pool.items[idxB];
        bB.init(
          idxB,
          10002,
          cx + dist * 0.5 + i * spacing,
          cy,
          -presetB.speed,
          0,
          presetB.radius,
          presetB.hp,
          presetB.damage,
          BULLET_LIFESPAN_TICKS,
          options?.colorB ?? presetB.color,
        );
        spawnedB.push(idxB);
      }
    }

    return { spawnedA, spawnedB };
  }

  /**
   * 執行子彈相消基準測試 (Autonomous Benchmark)
   * 在沙盒內連續模擬多次對撞情境並統計數值指標
   */
  public runClashBenchmark(
    scenario:
      | 'basic_vs_basic'
      | 'destroyer_vs_gunner_single'
      | 'destroyer_vs_gunner_stream'
      | 'destroyer_vs_destroyer' = 'basic_vs_basic',
    runs = 50,
  ): ClashBenchmarkResult {
    const t0 = performance.now();
    let clashCount = 0;
    let sumHpA = 0;
    let sumHpB = 0;
    let sumTicksA = 0;
    let sumTicksB = 0;

    let typeA: TestBulletType = 'basic';
    let typeB: TestBulletType = 'basic';
    let countB = 1;

    switch (scenario) {
      case 'destroyer_vs_gunner_single':
        typeA = 'destroyer';
        typeB = 'gunner';
        countB = 1;
        break;
      case 'destroyer_vs_gunner_stream':
        typeA = 'destroyer';
        typeB = 'gunner';
        countB = 5;
        break;
      case 'destroyer_vs_destroyer':
        typeA = 'destroyer';
        typeB = 'destroyer';
        countB = 1;
        break;
      default:
        typeA = 'basic';
        typeB = 'basic';
        countB = 1;
        break;
    }

    const initialClashTotal = this.game.collisionSystem.bulletClashCount;

    for (let r = 0; r < runs; r++) {
      this.clearAllBullets();
      const { spawnedA, spawnedB } = this.spawnClash(typeA, typeB, {
        distance: 300,
        center: { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.5 },
        bulletCountB: countB,
        streamSpacing: 25,
      });

      const clashBeforeRun = this.game.collisionSystem.bulletClashCount;
      let ticksA = 0;
      let ticksB = 0;
      const maxTicks = 40;

      for (let step = 0; step < maxTicks; step++) {
        // 單步推進子彈運動
        this.game.fireSystem.updateBullets(this.game.bulletPool);
        // 單步執行碰撞結算
        this.game.collisionSystem.update(
          [],
          this.game.bulletPool,
          [],
          this.game.shapeSystem,
          this.game.eventBus,
          step,
        );

        if (spawnedA.length > 0 && this.game.bulletPool.isActive(spawnedA[0])) {
          ticksA++;
        }
        if (spawnedB.length > 0 && this.game.bulletPool.isActive(spawnedB[0])) {
          ticksB++;
        }

        // 若雙方子彈皆已消滅或遠離，提早結束此 run
        let anyActiveA = false;
        for (let i = 0; i < spawnedA.length; i++) {
          if (this.game.bulletPool.isActive(spawnedA[i])) {
            anyActiveA = true;
            break;
          }
        }
        let anyActiveB = false;
        for (let i = 0; i < spawnedB.length; i++) {
          if (this.game.bulletPool.isActive(spawnedB[i])) {
            anyActiveB = true;
            break;
          }
        }
        if (!anyActiveA && !anyActiveB) {
          break;
        }
      }

      const clashInRun =
        this.game.collisionSystem.bulletClashCount - clashBeforeRun;
      if (clashInRun > 0) {
        clashCount++;
      }

      // 採樣剩餘血量
      let remHpA = 0;
      for (let i = 0; i < spawnedA.length; i++) {
        const idx = spawnedA[i];
        if (this.game.bulletPool.isActive(idx)) {
          remHpA += Math.max(0, this.game.bulletPool.items[idx].hp);
        }
      }
      let remHpB = 0;
      for (let i = 0; i < spawnedB.length; i++) {
        const idx = spawnedB[i];
        if (this.game.bulletPool.isActive(idx)) {
          remHpB += Math.max(0, this.game.bulletPool.items[idx].hp);
        }
      }

      sumHpA += remHpA;
      sumHpB += remHpB;
      sumTicksA += ticksA;
      sumTicksB += ticksB;
    }

    // 清理測試殘留子彈
    this.clearAllBullets();
    // 恢復全域 clash 計數為測試前數值
    this.game.collisionSystem.bulletClashCount = initialClashTotal;

    const timeTakenMs = performance.now() - t0;

    return {
      scenario,
      totalRuns: runs,
      clashDetectedCount: clashCount,
      clashRate: clashCount / runs,
      avgRemainingHpA: Number((sumHpA / runs).toFixed(3)),
      avgRemainingHpB: Number((sumHpB / runs).toFixed(3)),
      avgSurvivalTicksA: Number((sumTicksA / runs).toFixed(1)),
      avgSurvivalTicksB: Number((sumTicksB / runs).toFixed(1)),
      timeTakenMs: Number(timeTakenMs.toFixed(2)),
      pushFactor: this.game.collisionSystem.bulletPushFactor,
      damping: this.game.collisionSystem.bulletDamping,
    };
  }

  /**
   * 即時調試子彈相消參數
   */
  public tuneParams(params: {
    pushFactor?: number;
    damping?: number;
    restitution?: number;
    deflectionFactor?: number;
  }): {
    pushFactor: number;
    damping: number;
    restitution: number;
    deflectionFactor: number;
  } {
    if (params.pushFactor !== undefined) {
      this.game.collisionSystem.bulletPushFactor = params.pushFactor;
    }
    if (params.damping !== undefined) {
      this.game.collisionSystem.bulletDamping = params.damping;
    }
    if (params.restitution !== undefined) {
      this.game.collisionSystem.bulletRestitution = params.restitution;
    }
    if (params.deflectionFactor !== undefined) {
      this.game.collisionSystem.bulletDeflectionFactor =
        params.deflectionFactor;
    }
    return {
      pushFactor: this.game.collisionSystem.bulletPushFactor,
      damping: this.game.collisionSystem.bulletDamping,
      restitution: this.game.collisionSystem.bulletRestitution,
      deflectionFactor: this.game.collisionSystem.bulletDeflectionFactor,
    };
  }

  /**
   * 獲取實時遙測數據 (Telemetry)
   */
  public getTelemetry(): {
    bulletClashCount: number;
    bulletPushFactor: number;
    bulletDamping: number;
    bulletRestitution: number;
    bulletDeflectionFactor: number;
    activeBullets: number;
    bulletPoolCapacity: number;
  } {
    let activeBullets = 0;
    const pool = this.game.bulletPool;
    const cap = pool.capacity;
    for (let i = 0; i < cap; i++) {
      if (pool.isActive(i)) activeBullets++;
    }

    return {
      bulletClashCount: this.game.collisionSystem.bulletClashCount,
      bulletPushFactor: this.game.collisionSystem.bulletPushFactor,
      bulletDamping: this.game.collisionSystem.bulletDamping,
      bulletRestitution: this.game.collisionSystem.bulletRestitution,
      bulletDeflectionFactor: this.game.collisionSystem.bulletDeflectionFactor,
      activeBullets,
      bulletPoolCapacity: pool.capacity,
    };
  }
}
