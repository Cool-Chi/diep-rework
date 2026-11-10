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
import { Renderer } from '../rendering/Renderer';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { TankRenderer } from '../rendering/TankRenderer';
import { CollisionSystem } from '../systems/CollisionSystem';
import { FireSystem } from '../systems/FireSystem';
import { ShapeSystem } from '../systems/ShapeSystem';
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

  // 渲染層
  public readonly gridRenderer = new GridRenderer();
  public readonly shapeRenderer = new ShapeRenderer();
  public readonly bulletRenderer = new BulletRenderer();
  public readonly tankRenderer = new TankRenderer();

  private loop: GameLoop;
  private debugOverlay: DebugOverlay | null = null;
  private onResizeBound: () => void;

  constructor() {
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

    // 4. 綁定玩家輸入監聽
    this.inputManager.attach(this.renderer.app.canvas);

    // 5. 初始化形狀生態至 500 個
    this.shapeSystem.fillToTarget();

    // 6. 若為開發環境，動態載入 DebugOverlay
    if (import.meta.env.DEV) {
      const { DebugOverlay } = await import('../debug/DebugOverlay');
      this.debugOverlay = new DebugOverlay(this);
    }

    // 7. 啟動主循環
    this.loop.start();
  }

  private handleResize(): void {
    this.camera.resize(window.innerWidth, window.innerHeight);
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
      );

      const tickDuration = performance.now() - tickStart;

      // (g) 記錄實際 TPS 頻率與耗時
      if (this.debugOverlay) {
        this.debugOverlay.recordTick(tickDuration);
      }
    }

    // --- 渲染插值與表現階段 ---
    const alpha = stepResult.alpha;
    const visibleBounds = this.camera.getVisibleBounds();

    // 計算坦克插值顯示位置：renderPos = prevPos + (curPos - prevPos) * alpha
    const renderX =
      this.playerTank.prevX +
      (this.playerTank.x - this.playerTank.prevX) * alpha;
    const renderY =
      this.playerTank.prevY +
      (this.playerTank.y - this.playerTank.prevY) * alpha;

    // 計算本渲染幀滑鼠相對於坦克的朝向角度（保證滑鼠跟隨零延遲）
    const mouseWorld = this.camera.screenToWorld(
      this.inputManager.mouseScreenX,
      this.inputManager.mouseScreenY,
    );
    const aimAngle = Math.atan2(mouseWorld.y - renderY, mouseWorld.x - renderX);

    // 更新各圖層渲染對象
    const renderStartTime = performance.now();
    this.tankRenderer.update(renderX, renderY, aimAngle);
    this.shapeRenderer.update(this.shapeSystem.shapes, alpha, visibleBounds);
    this.bulletRenderer.update(this.bulletPool, alpha, visibleBounds);
    const renderDuration = performance.now() - renderStartTime;

    // 相機平滑跟隨坦克插值位置
    this.camera.setTarget(renderX, renderY);
    this.camera.update(dtSeconds);
    this.renderer.updateCamera(this.camera);

    // 更新除錯面板指標
    if (this.debugOverlay) {
      this.debugOverlay.recordRenderDuration(renderDuration);
      this.debugOverlay.update();
    }
  }

  public destroy(): void {
    this.loop.stop();
    window.removeEventListener('resize', this.onResizeBound);
    this.inputManager.detach();
    this.gridRenderer.destroy();
    this.shapeRenderer.destroy();
    this.bulletRenderer.destroy();
    this.tankRenderer.destroy();
    this.renderer.destroy();
    this.debugOverlay?.destroy();
  }
}
