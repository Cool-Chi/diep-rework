import { AISystem } from '../ai/AISystem';
import {
  BULLET_POOL_CAPACITY,
  SIM_TICK_RATE,
  SPAWN_INVULNERABLE_TICKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import { pointsForLevel, SCORE_FOR_LEVEL } from '../config/levels.config';
import { BASIC_TANK_DEFINITION } from '../config/tanks.config';
import { AgentTestInterface } from '../debug/AgentTestInterface';
import type { DebugOverlay } from '../debug/DebugOverlay';
import { Bullet } from '../entities/Bullet';
import { Particle } from '../entities/Particle';
import type { ShapeType } from '../entities/Shape';
import { Tank } from '../entities/Tank';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BulletRenderer } from '../rendering/BulletRenderer';
import { GridRenderer } from '../rendering/GridRenderer';
import {
  getRenderPosition,
  type RenderPositionOut,
} from '../rendering/getRenderPosition';
import { HealthBarRenderer } from '../rendering/HealthBarRenderer';
import { MultiTankRenderer } from '../rendering/MultiTankRenderer';
import {
  PARTICLE_POOL_CAPACITY,
  ParticleRenderer,
} from '../rendering/ParticleRenderer';
import { Renderer } from '../rendering/Renderer';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { TankRenderer } from '../rendering/TankRenderer';
import { CollisionSystem } from '../systems/CollisionSystem';
import { FireSystem } from '../systems/FireSystem';
import { LevelingSystem } from '../systems/LevelingSystem';
import { RegenSystem } from '../systems/RegenSystem';
import { ShapeSystem } from '../systems/ShapeSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { HUD } from '../ui/HUD';
import { Camera } from './Camera';
import { recomputeDerivedStats } from './deriveStats';
import { EventBus } from './EventBus';
import { FixedStepper } from './FixedStepper';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { ObjectPool } from './ObjectPool';

/**
 * 遊戲主控制器（整合物理模擬、固定步長、渲染插值與相機）
 */
export class Game {
  public readonly renderer = new Renderer();
  public readonly camera = new Camera(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5);
  public readonly stepper = new FixedStepper();
  public readonly physics = new PhysicsWorld();
  public readonly inputManager = new InputManager();
  public readonly eventBus = new EventBus();

  // 實體與物件池
  public readonly bulletPool = new ObjectPool<Bullet>(
    BULLET_POOL_CAPACITY,
    () => new Bullet(),
  );
  public readonly playerTank = new Tank(
    1,
    WORLD_WIDTH * 0.5,
    WORLD_HEIGHT * 0.5,
  );

  // 系統驅動器
  public readonly fireSystem = new FireSystem();
  public readonly shapeSystem = new ShapeSystem();
  public readonly collisionSystem = new CollisionSystem();
  public readonly levelingSystem: LevelingSystem;
  public readonly regenSystem = new RegenSystem();
  public readonly aiSystem = new AISystem();
  public readonly spawnSystem = new SpawnSystem();

  // 模擬 tick 計數
  public currentTick = 0;

  // 全體活動坦克列表（包含玩家與所有 AI）
  public readonly allTanks: Tank[] = [];

  // 渲染層
  public readonly gridRenderer = new GridRenderer();
  public readonly shapeRenderer = new ShapeRenderer();
  public readonly bulletRenderer = new BulletRenderer();
  public readonly particleRenderer = new ParticleRenderer();
  public readonly tankRenderer = new TankRenderer();
  public readonly multiTankRenderer = new MultiTankRenderer();
  public readonly healthBarRenderer = new HealthBarRenderer();
  public readonly hud: HUD;

  public readonly particlePool = new ObjectPool<Particle>(
    PARTICLE_POOL_CAPACITY,
    () => new Particle(),
  );

  public playerSessionTicks = 0;
  public playerKills = 0;

  public showAiDevLabels = false; // 是否在 AI 頭頂顯示戰術狀態標籤
  public isInitialized = false; // 是否已完成 Pixi 與 DOM 渲染層初始化

  private readonly tempTankRenderPos: RenderPositionOut = { x: 0, y: 0 };
  private readonly tempVisibleBoundsTuple: [number, number, number, number] = [
    0, 0, 0, 0,
  ];
  private loop: GameLoop;
  public devOverlay: DebugOverlay | null = null;
  public readonly agentTest = new AgentTestInterface(this);
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor() {
    this.playerTank.name = 'You';
    this.playerTank.isGodMode = true; // 開局預設開啟無敵模式
    this.allTanks.push(this.playerTank, ...this.spawnSystem.aiTanks);

    this.hud = new HUD(this.eventBus, () => this.respawnPlayer());
    this.levelingSystem = new LevelingSystem(this.eventBus, this.allTanks);
    recomputeDerivedStats(this.playerTank);
    this.inputManager.eventBus = this.eventBus;
    this.inputManager.isOverUi = (x, y) => this.hud.isOverUi(x, y);
    this.inputManager.onPointerMove = (x, y) =>
      this.hud.handlePointerMove(x, y);

    this.eventBus.onStatUpgradeRequested((statIndex) => {
      this.levelingSystem.spendStatPoint(
        this.playerTank,
        statIndex,
        this.eventBus,
      );
    });

    // 監聽轉職請求與進化可用事件
    this.eventBus.onClassUpgradeRequested((classId) => {
      this.levelingSystem.evolveTank(this.playerTank, classId, this.eventBus);
    });

    this.eventBus.onClassChanged((tankId) => {
      if (tankId === this.playerTank.id) {
        this.tankRenderer.setDefinition(this.playerTank.definition);
        this.camera.fovMultiplier = this.playerTank.definition.fovMultiplier;
      }
    });

    this.eventBus.onEvolutionAvailable((tankId, candidates) => {
      if (tankId === this.playerTank.id) {
        this.hud.evolutionPanel.show(candidates);
      }
    });

    // 監聽子彈命中火花特效
    this.eventBus.onBulletHit((x, y, color) => {
      this.spawnHitSparks(x, y, color);
    });

    // 監聽子彈互撞衝擊與破片火花特效
    this.eventBus.onBulletClash((x, y, radiusA, radiusB, colorA, colorB) => {
      this.spawnBulletClashSparks(x, y, radiusA, radiusB, colorA, colorB);
    });

    // 監聽幾何形狀摧毀特效
    this.eventBus.onShapeDestroyed((kind, _killerId, x, y) => {
      this.spawnShapeExplosion(
        x || WORLD_WIDTH * 0.5,
        y || WORLD_HEIGHT * 0.5,
        kind,
      );
    });

    // 監聽坦克陣亡事件（死亡爆裂、觀戰鏡頭、擊殺浮動 Toast 與結算畫面）
    this.eventBus.onTankDied((victimId, killerId, victimX, victimY) => {
      this.spawnSystem.handleTankDeath(victimId, this.currentTick);

      const victim = this.findTankById(victimId);
      const posX = victimX || victim?.x || WORLD_WIDTH * 0.5;
      const posY = victimY || victim?.y || WORLD_HEIGHT * 0.5;
      const color = victim?.color ?? 0x00b2e1;
      this.spawnTankExplosion(posX, posY, color);

      // 若陣亡者為玩家，啟動死亡觀戰與彈出結算畫面
      if (victimId === this.playerTank.id) {
        this.playerTank.active = false;
        this.camera.addShake(12.0);

        let killerName = 'a Shape';
        if (killerId && killerId > 0) {
          const killerTank = this.findTankById(killerId);
          if (killerTank) {
            killerName = killerTank.name;
            this.camera.spectateTarget = killerTank;
          }
        }
        if (!this.camera.spectateTarget) {
          this.camera.spectateTarget = { x: posX, y: posY };
        }

        const survivalSecs = this.playerSessionTicks / SIM_TICK_RATE;
        this.hud.gameOverModal.show({
          killerName,
          finalScore: this.playerTank.score,
          finalLevel: this.playerTank.level,
          finalClass: this.playerTank.definition.name,
          survivalSeconds: survivalSecs,
          tanksKilled: this.playerKills,
        });
      }

      // 若擊殺者為玩家，增加擊殺統計並顯示浮動加分 Toast
      if (killerId === this.playerTank.id && victim) {
        this.playerKills++;
        this.hud.killToast.show(victim.name, victim.score);
        this.camera.addShake(4.0);
      }
    });

    this.onKeyDownBound = (e: KeyboardEvent) => {
      if (this.hud.gameOverModal.visible) {
        if (e.code === 'Enter' || e.code === 'Space') {
          this.hud.gameOverModal.triggerRespawn();
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDownBound);
    }

    this.loop = new GameLoop(this.update.bind(this));
    this.onResizeBound = this.handleResize.bind(this);
  }

  /**
   * 初始化遊戲並啟動主循環
   * @param targetElement 畫布容器
   */
  public async init(targetElement: HTMLElement): Promise<void> {
    // 1. 初始化 Pixi v8 渲染器
    await this.renderer.init(targetElement);

    // 2. 初始化相機螢幕尺寸
    this.camera.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this.onResizeBound);

    // 3. 建立場景圖層 (WorldContainer)
    this.gridRenderer.init(this.renderer.app);
    this.shapeRenderer.init(this.renderer);
    this.bulletRenderer.init(this.renderer);
    this.particleRenderer.init(this.renderer);

    this.renderer.worldContainer.addChild(this.gridRenderer.container);
    this.renderer.worldContainer.addChild(this.shapeRenderer.container);
    this.renderer.worldContainer.addChild(this.bulletRenderer.container);
    this.renderer.worldContainer.addChild(this.particleRenderer.container);
    this.renderer.worldContainer.addChild(this.multiTankRenderer.container);
    this.renderer.worldContainer.addChild(this.healthBarRenderer.container);

    // 4. 掛載 HUD 介面層並設定初始佈局
    this.renderer.hudContainer.addChild(this.hud.container);
    this.hud.resize(window.innerWidth, window.innerHeight);

    // 5. 初始化 AI 坦克群生成
    this.spawnSystem.init(this.playerTank);

    // 5. 綁定玩家輸入監聽與 HUD 點擊事件
    this.inputManager.attach(this.renderer.app.canvas);
    this.renderer.app.canvas.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if (e.button === 0) {
          this.hud.handlePointerDown(e.clientX, e.clientY);
        }
      },
    );

    // 6. 初始化形狀生態至 500 個
    this.shapeSystem.fillToTarget();

    // 7. 若為開發環境，動態載入 DebugOverlay
    if (import.meta.env.DEV) {
      const { DebugOverlay } = await import('../debug/DebugOverlay');
      this.devOverlay = new DebugOverlay(this);
    }

    // 8. 標記完成初始化並啟動主循環
    this.isInitialized = true;
    this.loop.start();
  }

  private handleResize(): void {
    this.camera.resize(window.innerWidth, window.innerHeight);
    this.hud.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * 遊戲核心單幀更新流程：
   * 1. 推進固定時間步長累積 (FixedStepper)
   * 2. 執行 ticks 數量的物理模擬 (固定步長 25 TPS)
   * 3. 根據插值係數 alpha 計算畫面平滑顯示座標
   * 4. 更新相機跟隨與渲染世界容器
   */
  public update(dtSeconds: number): void {
    const stepResult = this.stepper.advance(dtSeconds);

    // --- 固定步長物理模擬階段 (25 TPS) ---
    for (let i = 0; i < stepResult.ticks; i++) {
      const tickStart = performance.now();
      this.currentTick++;

      // (a) 取樣玩家輸入寫入坦克 InputCommand
      this.inputManager.sample(this.playerTank.input, (sx, sy) =>
        this.camera.screenToWorld(sx, sy),
      );

      // (a2) AI 決策系統計算各 AI 坦克的 InputCommand
      this.aiSystem.update(
        this.spawnSystem.aiTanks,
        this.shapeSystem.shapes,
        this.allTanks,
        this.bulletPool,
        this.currentTick,
      );

      // (b & c) 全體活動坦克裝填推進、開火生成子彈與物理步進積分
      const tankCount = this.allTanks.length;
      for (let t = 0; t < tankCount; t++) {
        const tank = this.allTanks[t];
        if (tank.active) {
          this.fireSystem.updateTankFiring(tank, this.bulletPool);
          this.physics.stepTank(tank);
        }
      }

      // (d) 子彈步進推進與壽命衰減
      this.fireSystem.updateBullets(this.bulletPool);

      // (e) 形狀生態漂移、阻尼與動態補足 (零配置複用邊界 Tuple)
      const visibleBounds = this.camera.getVisibleBounds();
      this.tempVisibleBoundsTuple[0] = visibleBounds.minX;
      this.tempVisibleBoundsTuple[1] = visibleBounds.minY;
      this.tempVisibleBoundsTuple[2] = visibleBounds.maxX;
      this.tempVisibleBoundsTuple[3] = visibleBounds.maxY;
      this.shapeSystem.update(this.tempVisibleBoundsTuple);

      // (f) 碰撞檢測與物理結算 (包含玩家、所有 AI 與形狀、子彈)
      this.collisionSystem.update(
        this.allTanks,
        this.bulletPool,
        this.shapeSystem.shapes,
        this.shapeSystem,
        this.eventBus,
        this.currentTick,
      );

      // (g) 自然生命恢復與 30 秒加速回血
      this.regenSystem.update(this.allTanks, this.currentTick);

      // (g2) AI 坦克生態動態維持與重生佇列
      this.spawnSystem.update(this.currentTick, this.playerTank);
      if (this.agentTest.isAiDuelActive) {
        this.agentTest.updateAiDuel(this.currentTick);
      }

      // (g3) 玩家活躍時間計時與粒子生命週期推進
      if (this.playerTank.active) {
        this.playerSessionTicks++;
      }
      const pCap = this.particlePool.capacity;
      for (let p = 0; p < pCap; p++) {
        if (this.particlePool.isActive(p)) {
          const part = this.particlePool.items[p];
          part.step();
          if (!part.active) {
            this.particlePool.release(p);
          }
        }
      }

      const tickDuration = performance.now() - tickStart;

      // (h) 記錄實際 TPS 頻率與耗時
      if (this.devOverlay) {
        this.devOverlay.recordTick(tickDuration);
      }
    }

    // ========================================================
    // 固定渲染順序（嚴格遵守七步流水線，避免抖動與幀差）：
    // ① FixedStepper 跑完所有 tick
    // ② 計算 alpha
    // ③ Camera.update（使用插值後的坦克位置）
    // ④ 套用 worldContainer 變換
    // ⑤ 更新世界內所有 Sprite（多坦克、形狀、子彈、血條）
    // ⑥ 更新 HUD（排行榜、小地圖、分數列等）
    // ⑦ render
    // ========================================================

    // ② 計算 alpha 與坦克插值顯示位置
    const alpha = stepResult.alpha;
    getRenderPosition(this.playerTank, alpha, this.tempTankRenderPos);
    const renderX = this.tempTankRenderPos.x;
    const renderY = this.tempTankRenderPos.y;

    // ③ Camera.update（使用插值後的坦克位置與視野縮放）
    this.camera.targetLevel = this.playerTank.level;
    this.camera.fovMultiplier = this.playerTank.definition.fovMultiplier;
    this.camera.setTarget(renderX, renderY);
    this.camera.update(dtSeconds);
    const visibleBounds = this.camera.getVisibleBounds();

    if (this.isInitialized) {
      // ④ 套用 worldContainer 變換（確保後續更新與視錐剔除使用當幀最新相機狀態）
      this.renderer.updateCamera(this.camera);

      // ⑤ 更新世界內所有 Sprite（多坦克、形狀、子彈與血條）
      const renderStartTime = performance.now();
      const mouseWorld = this.camera.screenToWorld(
        this.inputManager.mouseScreenX,
        this.inputManager.mouseScreenY,
      );
      this.playerTank.input.aimX = mouseWorld.x;
      this.playerTank.input.aimY = mouseWorld.y;

      this.multiTankRenderer.update(
        this.allTanks,
        alpha,
        visibleBounds,
        this.showAiDevLabels,
        this.camera.isGodView,
        this.camera.scale,
      );
      this.shapeRenderer.update(this.shapeSystem.shapes, alpha, visibleBounds);
      this.bulletRenderer.update(this.bulletPool, alpha, visibleBounds);
      this.particleRenderer.update(this.particlePool, alpha, visibleBounds);
      this.healthBarRenderer.update(
        this.allTanks,
        this.shapeSystem.shapes,
        alpha,
        visibleBounds,
      );
      const renderDuration = performance.now() - renderStartTime;

      // ⑥ 更新 HUD（排行榜、小地圖、分數列等）
      const hudStartTime = performance.now();
      this.hud.update(
        this.playerTank,
        alpha,
        this.camera,
        dtSeconds,
        this.allTanks,
      );
      const hudDuration = performance.now() - hudStartTime;

      // 更新除錯面板指標
      if (this.devOverlay) {
        this.devOverlay.recordRenderDuration(renderDuration);
        this.devOverlay.recordHudDuration(hudDuration);
        this.devOverlay.update();
      }
    }
  }

  public toggleGodView(): void {
    this.camera.isGodView = !this.camera.isGodView;
    if (this.camera.isGodView) {
      this.showAiDevLabels = true;
    }
  }

  /**
   * 玩家死亡後以原版折半等級與安全座標重生
   */
  public respawnPlayer(): void {
    const deadLevel = this.playerTank.level;
    const respawnLevel = Math.max(1, Math.floor(deadLevel / 2));
    const respawnScore = SCORE_FOR_LEVEL[respawnLevel - 1] ?? 0;

    const safePos = this.spawnSystem.getRandomSpawnPosition(
      WORLD_WIDTH * 0.5,
      WORLD_HEIGHT * 0.5,
      this.playerTank.id,
    );
    this.playerTank.setClass(BASIC_TANK_DEFINITION);
    this.playerTank.respawn(safePos.x, safePos.y);
    this.playerTank.level = respawnLevel;
    this.playerTank.score = respawnScore;
    this.playerTank.statPoints = pointsForLevel(respawnLevel);
    this.playerTank.statLevels.fill(0);
    recomputeDerivedStats(this.playerTank);
    this.eventBus.emitClassChanged(this.playerTank.id, 'basic');

    this.playerTank.isGodMode = this.devOverlay
      ? this.devOverlay.isGodMode
      : true;
    this.playerTank.invulnerableTicks = SPAWN_INVULNERABLE_TICKS; // 75 ticks (3 秒無敵)
    this.camera.spectateTarget = null;
    this.camera.teleport(safePos.x, safePos.y);

    this.playerSessionTicks = 0;
    this.playerKills = 0;

    this.eventBus.emitLevelUp(this.playerTank.id, this.playerTank.level);
    this.eventBus.emitScoreChanged(this.playerTank.id, this.playerTank.score);
    this.eventBus.emitStatPointsChanged(
      this.playerTank.id,
      this.playerTank.statPoints,
    );
    this.levelingSystem.checkEvolution(this.playerTank, this.eventBus);
  }

  public spawnTankExplosion(x: number, y: number, color: number): void {
    const count = 32;
    for (let i = 0; i < count; i++) {
      const idx = this.particlePool.acquire();
      if (idx < 0) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 8.5;
      const radius = 3.5 + Math.random() * 6.5;
      const life = 20 + Math.floor(Math.random() * 15);
      this.particlePool.items[idx].init(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        radius,
        life,
        0.93,
      );
    }
  }

  public spawnShapeExplosion(x: number, y: number, kind: ShapeType): void {
    let color = 0xffe869; // 方塊黃
    let count = 14;
    let radiusBase = 4;
    if (kind === 'triangle') {
      color = 0xfc7677; // 三角紅
      count = 18;
      radiusBase = 5;
    } else if (kind === 'pentagon') {
      color = 0x768dfc; // 五邊形藍
      count = 26;
      radiusBase = 6;
    }

    for (let i = 0; i < count; i++) {
      const idx = this.particlePool.acquire();
      if (idx < 0) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.5;
      const radius = Math.max(2, radiusBase + (Math.random() - 0.5) * 3);
      const life = 14 + Math.floor(Math.random() * 10);
      this.particlePool.items[idx].init(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        radius,
        life,
        0.91,
      );
    }
  }

  public spawnHitSparks(x: number, y: number, color = 0xfffae0): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const idx = this.particlePool.acquire();
      if (idx < 0) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 4.5;
      const radius = 2.0 + Math.random() * 1.5;
      const life = 6 + Math.floor(Math.random() * 4);
      this.particlePool.items[idx].init(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        radius,
        life,
        0.88,
      );
    }
  }

  public spawnBulletClashSparks(
    x: number,
    y: number,
    radiusA: number,
    radiusB: number,
    colorA: number,
    colorB: number,
  ): void {
    const maxR = Math.max(radiusA, radiusB);
    const count = Math.min(18, Math.max(8, Math.round(maxR * 0.8)));

    for (let i = 0; i < count; i++) {
      const idx = this.particlePool.acquire();
      if (idx < 0) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 6.5;
      const radius = 2.0 + Math.random() * (maxR >= 16 ? 3.0 : 1.8);
      const life = 8 + Math.floor(Math.random() * 8);

      // 粒子色彩隨機混合：撞擊白光、淡金破片、雙方子彈顏色
      const rand = Math.random();
      let color = 0xffffff;
      if (rand < 0.35) color = 0xfffae0;
      else if (rand < 0.65) color = colorA;
      else if (rand < 0.9) color = colorB;

      this.particlePool.items[idx].init(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        radius,
        life,
        0.87,
      );
    }
  }

  private findTankById(id: number): Tank | null {
    const len = this.allTanks.length;
    for (let i = 0; i < len; i++) {
      if (this.allTanks[i].id === id) {
        return this.allTanks[i];
      }
    }
    return null;
  }

  public destroy(): void {
    this.loop.stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResizeBound);
      window.removeEventListener('keydown', this.onKeyDownBound);
    }
    this.inputManager.detach();
    this.hud.destroy();
    this.gridRenderer.destroy();
    this.shapeRenderer.destroy();
    this.bulletRenderer.destroy();
    this.particleRenderer.destroy();
    this.tankRenderer.destroy();
    this.healthBarRenderer.destroy();
    this.renderer.destroy();
    this.devOverlay?.destroy();
  }
}
