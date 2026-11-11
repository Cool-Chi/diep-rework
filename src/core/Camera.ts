import {
  CAMERA_BASE_SCALE,
  CAMERA_SMOOTH_K,
  FOV_LEVEL_SCALING,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';

export interface VisibleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * 遊戲相機系統
 * 負責跟隨插值後的目標位置、與幀率無關的平滑逼近、FOV 視圖縮放與螢幕-世界座標互轉
 */
export class Camera {
  public x = WORLD_WIDTH * 0.5;
  public y = WORLD_HEIGHT * 0.5;
  public targetX = WORLD_WIDTH * 0.5;
  public targetY = WORLD_HEIGHT * 0.5;

  public screenWidth = 800;
  public screenHeight = 600;

  public fovMultiplier = 1.0;
  public targetLevel = 1;
  public fovLevelScaling = FOV_LEVEL_SCALING;
  public baseScale: number = CAMERA_BASE_SCALE;
  public smoothK: number = CAMERA_SMOOTH_K;
  public isGodView = false; // 調試專用上帝全圖鳥瞰視角開關
  public isFreeCam = false; // 自由相機模式開關
  public freeCamZoom = 1.0; // 自由相機局部縮放倍率 (0.2x ~ 2.5x)
  public freeCamTargetX = WORLD_WIDTH * 0.5;
  public freeCamTargetY = WORLD_HEIGHT * 0.5;

  // 螢幕微震動系統 (Screen Shake)
  public shakeIntensity = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  // 死亡觀戰目標 (Spectator Mode)
  public spectateTarget: { x: number; y: number } | null = null;

  // 預先配置可複用的邊界與座標物件，避免每幀產生垃圾回收
  private readonly bounds: VisibleBounds = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
  };

  private readonly tempWorldPoint: Point2D = { x: 0, y: 0 };
  private readonly tempScreenPoint: Point2D = { x: 0, y: 0 };

  constructor(startX = WORLD_WIDTH * 0.5, startY = WORLD_HEIGHT * 0.5) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
  }

  /**
   * 當前整體渲染縮放比例
   * 縮放 = CAMERA_BASE_SCALE ÷ (fovMultiplier * 等級視野放大率)
   */
  public get scale(): number {
    if (this.isGodView) {
      // 上帝鳥瞰視角：將封閉地圖完整縮放至螢幕內 (留 400 單位安全邊距)
      const mapMargin = 400;
      return Math.min(
        this.screenWidth / (WORLD_WIDTH + mapMargin),
        this.screenHeight / (WORLD_HEIGHT + mapMargin),
      );
    }
    if (this.isFreeCam) {
      return this.baseScale * this.freeCamZoom;
    }
    const levelFactor = 1 + (this.targetLevel - 1) * this.fovLevelScaling;
    return this.baseScale / (this.fovMultiplier * levelFactor);
  }

  /**
   * 更新螢幕尺寸
   */
  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /**
   * 瞬間對齊至指定座標（如重生地點）
   */
  public teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.freeCamTargetX = x;
    this.freeCamTargetY = y;
  }

  public get renderX(): number {
    return this.x + this.shakeOffsetX;
  }

  public get renderY(): number {
    return this.y + this.shakeOffsetY;
  }

  /**
   * 施加螢幕微震動
   * @param intensity 震動強度（像素/世界單位）
   */
  public addShake(intensity: number): void {
    if (this.isGodView) return;
    this.shakeIntensity = Math.min(24, this.shakeIntensity + intensity);
  }

  /**
   * 設定平滑跟隨的目標座標（請傳入插值後的坦克顯示位置）
   */
  public setTarget(x: number, y: number): void {
    if (this.isGodView) {
      this.targetX = WORLD_WIDTH * 0.5;
      this.targetY = WORLD_HEIGHT * 0.5;
      return;
    }
    if (this.isFreeCam) {
      this.targetX = this.freeCamTargetX;
      this.targetY = this.freeCamTargetY;
      return;
    }
    if (this.spectateTarget) {
      this.targetX = this.spectateTarget.x;
      this.targetY = this.spectateTarget.y;
      return;
    }
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * 每渲染幀更新相機位置與震動衰減
   * 採用與幀率無關的指數平滑公式：factor = 1 - exp(-k * dt)
   * @param dtSeconds 距離上一渲染幀的時間差（秒）
   */
  public update(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    if (this.isGodView) {
      this.targetX = WORLD_WIDTH * 0.5;
      this.targetY = WORLD_HEIGHT * 0.5;
    } else if (this.isFreeCam) {
      this.targetX = this.freeCamTargetX;
      this.targetY = this.freeCamTargetY;
    } else if (this.spectateTarget) {
      this.targetX = this.spectateTarget.x;
      this.targetY = this.spectateTarget.y;
    }

    // 與幀率無關的平滑權重：1 - exp(-k * dt)
    const factor = 1 - Math.exp(this.smoothK * -dtSeconds);

    this.x += (this.targetX - this.x) * factor;
    this.y += (this.targetY - this.y) * factor;

    // 震動更新與指數衰減
    if (this.shakeIntensity > 0.05) {
      const angle = Math.random() * Math.PI * 2;
      this.shakeOffsetX = Math.cos(angle) * this.shakeIntensity;
      this.shakeOffsetY = Math.sin(angle) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-9.0 * dtSeconds);
      if (this.shakeIntensity <= 0.05) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  /**
   * 平移自由相機 (依螢幕像素位移轉換至世界位移)
   */
  public panFreeCam(screenDx: number, screenDy: number): void {
    if (!this.isFreeCam) return;
    const s = this.scale;
    this.freeCamTargetX -= screenDx / s;
    this.freeCamTargetY -= screenDy / s;
    this.freeCamTargetX = Math.max(
      0,
      Math.min(WORLD_WIDTH, this.freeCamTargetX),
    );
    this.freeCamTargetY = Math.max(
      0,
      Math.min(WORLD_HEIGHT, this.freeCamTargetY),
    );
    // 同步更新 targetX/targetY 讓相機跟隨
    this.targetX = this.freeCamTargetX;
    this.targetY = this.freeCamTargetY;
  }

  /**
   * 縮放自由相機 (0.2x ~ 2.5x)
   */
  public zoomFreeCam(deltaFactor: number): void {
    if (!this.isFreeCam) return;
    this.freeCamZoom = Math.max(
      0.2,
      Math.min(2.5, this.freeCamZoom * deltaFactor),
    );
  }

  /**
   * 直接設定自由相機觀察的世界座標 (例如小地圖點擊跳轉)
   */
  public setFreeCamTarget(worldX: number, worldY: number): void {
    this.freeCamTargetX = Math.max(0, Math.min(WORLD_WIDTH, worldX));
    this.freeCamTargetY = Math.max(0, Math.min(WORLD_HEIGHT, worldY));
    if (this.isFreeCam) {
      this.targetX = this.freeCamTargetX;
      this.targetY = this.freeCamTargetY;
    }
  }

  /**
   * 取得相機當前可視世界矩形範圍（供視錐剔除與背景繪製）
   */
  public getVisibleBounds(): VisibleBounds {
    const s = this.scale;
    const halfW = this.screenWidth / (2 * s);
    const halfH = this.screenHeight / (2 * s);

    this.bounds.minX = this.x - halfW;
    this.bounds.minY = this.y - halfH;
    this.bounds.maxX = this.x + halfW;
    this.bounds.maxY = this.y + halfH;
    this.bounds.width = halfW * 2;
    this.bounds.height = halfH * 2;

    return this.bounds;
  }

  /**
   * 螢幕像素座標轉世界座標
   * @param screenX 螢幕像素 X
   * @param screenY 螢幕像素 Y
   */
  public screenToWorld(screenX: number, screenY: number): Point2D {
    const s = this.scale;
    const centerX = this.screenWidth * 0.5;
    const centerY = this.screenHeight * 0.5;

    this.tempWorldPoint.x = this.x + (screenX - centerX) / s;
    this.tempWorldPoint.y = this.y + (screenY - centerY) / s;

    return this.tempWorldPoint;
  }

  /**
   * 世界座標轉螢幕像素座標
   * @param worldX 世界座標 X
   * @param worldY 世界座標 Y
   */
  public worldToScreen(worldX: number, worldY: number): Point2D {
    const s = this.scale;
    const centerX = this.screenWidth * 0.5;
    const centerY = this.screenHeight * 0.5;

    this.tempScreenPoint.x = centerX + (worldX - this.x) * s;
    this.tempScreenPoint.y = centerY + (worldY - this.y) * s;

    return this.tempScreenPoint;
  }
}
