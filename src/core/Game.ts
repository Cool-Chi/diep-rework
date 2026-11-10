import { AISystem } from '../ai/AISystem';
import {
  BULLET_POOL_CAPACITY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import type { DebugOverlay } from '../debug/DebugOverlay';
import { Bullet } from '../entities/Bullet';
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
  public readonly tankRenderer = new TankRenderer();
  public readonly multiTankRenderer = new MultiTankRenderer();
  public readonly healthBarRenderer = new HealthBarRenderer();
  public readonly hud: HUD;

  public showAiDevLabels = false; // 是否在 AI 頭頂顯示戰術狀態標籤

  private readonly tempTankRenderPos: RenderPositionOut = { x: 0, y: 0 };
  private readonly tempVisibleBoundsTuple: [number, number, number, number] = [
    0, 0, 0, 0,
  ];
  private loop: GameLoop;
  private devOverlay: DebugOverlay | null = null;
  private onResizeBound: () => void;

  constructor() {
    this.playerTank.name = 'You';
    this.allTanks.push(this.playerTank, ...this.spawnSystem.aiTanks);

    this.hud = new HUD(this.eventBus);
    this.levelingSystem = new LevelingSystem(this.eventBus, this.allTanks);
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

    // 監聽坦克陣亡事件以觸發重生排程
    this.eventBus.onTankDied((victimId) => {
      this.spawnSystem.handleTankDeath(victimId, this.currentTick);
    });

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

    this.renderer.worldContainer.addChild(this.gridRenderer.container);
    this.renderer.worldContainer.addChild(this.shapeRenderer.container);
    this.renderer.worldContainer.addChild(this.bulletRenderer.container);
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

    // 8. 啟動主循環
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
    );
    this.shapeRenderer.update(this.shapeSystem.shapes, alpha, visibleBounds);
    this.bulletRenderer.update(this.bulletPool, alpha, visibleBounds);
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

    // ⑦ render（由 Pixi Application 渲染循環在幀末自動執行）

    // 更新除錯面板指標
    if (this.devOverlay) {
      this.devOverlay.recordRenderDuration(renderDuration);
      this.devOverlay.recordHudDuration(hudDuration);
      this.devOverlay.update();
    }
  }

  public toggleGodView(): void {
    this.camera.isGodView = !this.camera.isGodView;
    if (this.camera.isGodView) {
      this.showAiDevLabels = true;
    }
  }

  public destroy(): void {
    this.loop.stop();
    window.removeEventListener('resize', this.onResizeBound);
    this.inputManager.detach();
    this.hud.destroy();
    this.gridRenderer.destroy();
    this.shapeRenderer.destroy();
    this.bulletRenderer.destroy();
    this.tankRenderer.destroy();
    this.healthBarRenderer.destroy();
    this.renderer.destroy();
    this.devOverlay?.destroy();
  }
}
