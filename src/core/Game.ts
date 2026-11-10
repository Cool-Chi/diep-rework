import {
  BULLET_POOL_CAPACITY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import { sizeFactor } from '../config/stats.config';
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
import { Renderer } from '../rendering/Renderer';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { TankRenderer } from '../rendering/TankRenderer';
import { CollisionSystem } from '../systems/CollisionSystem';
import { FireSystem } from '../systems/FireSystem';
import { LevelingSystem } from '../systems/LevelingSystem';
import { RegenSystem } from '../systems/RegenSystem';
import { ShapeSystem } from '../systems/ShapeSystem';
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

  // 模擬 tick 計數
  public currentTick = 0;

  // 渲染層
  public readonly gridRenderer = new GridRenderer();
  public readonly shapeRenderer = new ShapeRenderer();
  public readonly bulletRenderer = new BulletRenderer();
  public readonly tankRenderer = new TankRenderer();
  public readonly healthBarRenderer = new HealthBarRenderer();
  public readonly hud: HUD;

  private readonly tempTankRenderPos: RenderPositionOut = { x: 0, y: 0 };
  private loop: GameLoop;
  private devOverlay: DebugOverlay | null = null;
  private onResizeBound: () => void;

  constructor() {
    this.hud = new HUD(this.eventBus);
    this.levelingSystem = new LevelingSystem(this.eventBus, [this.playerTank]);
    this.inputManager.eventBus = this.eventBus;
    this.inputManager.isOverUi = (x, y) => this.hud.isOverUi(x, y);

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
    this.renderer.worldContainer.addChild(this.tankRenderer.container);
    this.renderer.worldContainer.addChild(this.healthBarRenderer.container);

    // 4. 掛載 HUD 介面層並設定初始佈局
    this.renderer.hudContainer.addChild(this.hud.container);
    this.hud.resize(window.innerWidth, window.innerHeight);

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

      // (a) 取樣輸入寫入坦克 InputCommand
      this.inputManager.sample(this.playerTank.input, (sx, sy) =>
        this.camera.screenToWorld(sx, sy),
      );

      // (b) 裝填推進、開火生成子彈與後座力衝量
      this.fireSystem.updateTankFiring(this.playerTank, this.bulletPool);

      // (c) 坦克物理模擬積分（含 prepareStep 備份座標、移動加速度、阻尼與邊界約束）
      this.physics.stepTank(this.playerTank);

      // (d) 子彈步進推進與壽命衰減
      this.fireSystem.updateBullets(this.bulletPool);

      // (e) 形狀生態漂移、阻尼與動態補足
      const visibleBounds = this.camera.getVisibleBounds();
      this.shapeSystem.update([
        visibleBounds.minX,
        visibleBounds.minY,
        visibleBounds.maxX,
        visibleBounds.maxY,
      ]);

      // (f) 碰撞檢測與物理結算 (SpatialHash + Swept + 扣血)
      this.collisionSystem.update(
        [this.playerTank],
        this.bulletPool,
        this.shapeSystem.shapes,
        this.shapeSystem,
        this.eventBus,
        this.currentTick,
      );

      // (g) 自然生命恢復與 30 秒加速回血
      this.regenSystem.update([this.playerTank], this.currentTick);

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
    // ⑤ 更新世界內所有 Sprite（含血條）
    // ⑥ 更新 HUD（小地圖、分數列等）
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

    // ⑤ 更新世界內所有 Sprite（含血條，均在世界座標下計算）
    const renderStartTime = performance.now();
    const mouseWorld = this.camera.screenToWorld(
      this.inputManager.mouseScreenX,
      this.inputManager.mouseScreenY,
    );
    const aimAngle = Math.atan2(mouseWorld.y - renderY, mouseWorld.x - renderX);

    this.tankRenderer.update(
      renderX,
      renderY,
      aimAngle,
      sizeFactor(this.playerTank.level),
    );
    this.shapeRenderer.update(this.shapeSystem.shapes, alpha, visibleBounds);
    this.bulletRenderer.update(this.bulletPool, alpha, visibleBounds);
    this.healthBarRenderer.update(
      [this.playerTank],
      this.shapeSystem.shapes,
      alpha,
      visibleBounds,
    );
    const renderDuration = performance.now() - renderStartTime;

    // ⑥ 更新 HUD（小地圖、分數列等，小地圖玩家點使用插值渲染位置）
    const hudStartTime = performance.now();
    this.hud.update(this.playerTank, alpha, this.camera, dtSeconds);
    const hudDuration = performance.now() - hudStartTime;

    // ⑦ render（由 Pixi Application 渲染循環在幀末自動執行）

    // 更新除錯面板指標
    if (this.devOverlay) {
      this.devOverlay.recordRenderDuration(renderDuration);
      this.devOverlay.recordHudDuration(hudDuration);
      this.devOverlay.update();
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
