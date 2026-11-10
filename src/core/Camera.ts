import {
  CAMERA_BASE_SCALE,
  CAMERA_SMOOTH_K,
  FOV_LEVEL_SCALING,
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
  public x = 2000;
  public y = 2000;
  public targetX = 2000;
  public targetY = 2000;

  public screenWidth = 800;
  public screenHeight = 600;

  public fovMultiplier = 1.0;
  public targetLevel = 1;
  public fovLevelScaling = FOV_LEVEL_SCALING;
  public baseScale: number = CAMERA_BASE_SCALE;
  public smoothK: number = CAMERA_SMOOTH_K;
  public isGodView = false; // 調試專用上帝全圖鳥瞰視角開關

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

  constructor(startX = 2000, startY = 2000) {
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
      // 上帝鳥瞰視角：將 4000x4000 封閉地圖完整縮放至螢幕內 (4200 單位留安全邊距)
      return Math.min(this.screenWidth / 4200, this.screenHeight / 4200);
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
  }

  /**
   * 設定平滑跟隨的目標座標（請傳入插值後的坦克顯示位置）
   */
  public setTarget(x: number, y: number): void {
    if (this.isGodView) {
      this.targetX = 2000;
      this.targetY = 2000;
      return;
    }
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * 每渲染幀更新相機位置
   * 採用與幀率無關的指數平滑公式：factor = 1 - exp(-k * dt)
   * @param dtSeconds 距離上一渲染幀的時間差（秒）
   */
  public update(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    if (this.isGodView) {
      this.targetX = 2000;
      this.targetY = 2000;
    }

    // 與幀率無關的平滑權重：1 - exp(-k * dt)
    const factor = 1 - Math.exp(this.smoothK * -dtSeconds);

    this.x += (this.targetX - this.x) * factor;
    this.y += (this.targetY - this.y) * factor;
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
