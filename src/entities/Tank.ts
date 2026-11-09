import { BASE_TANK_RADIUS } from '../config/constants';

export interface InputCommand {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shooting: boolean;
}

/**
 * 坦克實體模型（純扁平數值，遵循 Zero-Allocation 鐵律）
 */
export class Tank {
  public id: number;
  public active = true;

  // 扁平世界座標（唯一真值，以 25 單位/格為基準）
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public vx = 0;
  public vy = 0;
  public radius: number;
  public rotation = 0; // 砲管/本體朝向（弧度）

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
  }

  /**
   * 每個模擬 tick 開始前先將當前座標拷貝至上一 tick 座標，供渲染插值
   */
  public prepareStep(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
