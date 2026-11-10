import {
  BASE_BULLET_RADIUS,
  BULLET_FADEOUT_TICKS,
  BULLET_LIFESPAN_TICKS,
  COLOR_TANK_BLUE,
} from '../config/constants';

/**
 * 子彈實體（扁平欄位，物件池化管理）
 */
export class Bullet {
  public id = 0;
  public ownerId = 0;
  public active = false;
  public color: number = COLOR_TANK_BLUE;

  public x = 0;
  public y = 0;
  public prevX = 0;
  public prevY = 0;
  public vx = 0;
  public vy = 0;
  public radius = BASE_BULLET_RADIUS;

  public hp = 2; // 子彈穿透生命值 (Penetration)
  public maxHp = 2;
  public damage = 7; // 單次碰撞殺傷力
  public remainingTicks = BULLET_LIFESPAN_TICKS;
  public initialLifespanTicks = BULLET_LIFESPAN_TICKS;

  /**
   * 物件池借用時的初始化賦值（零配置）
   */
  public init(
    id: number,
    ownerId: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    hp: number,
    damage: number,
    lifespanTicks = BULLET_LIFESPAN_TICKS,
    color = COLOR_TANK_BLUE,
  ): void {
    this.id = id;
    this.ownerId = ownerId;
    this.active = true;
    this.color = color;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = damage;
    this.remainingTicks = lifespanTicks;
    this.initialLifespanTicks = lifespanTicks;
  }

  /**
   * 取得子彈末段平滑漸逝進度 (1.0 = 完全不透明, 0.0 = 完全消散)
   */
  public get fadeProgress(): number {
    if (this.remainingTicks >= BULLET_FADEOUT_TICKS) return 1.0;
    if (this.remainingTicks <= 0) return 0.0;
    return this.remainingTicks / BULLET_FADEOUT_TICKS;
  }

  /**
   * 每個模擬 tick 備份座標供渲染插值
   */
  public prepareStep(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
