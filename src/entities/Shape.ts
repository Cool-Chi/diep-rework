export type ShapeType = 'square' | 'triangle' | 'pentagon';

/**
 * 幾何資源實體（扁平欄位，預先配置固定陣列）
 */
export class Shape {
  public id = 0;
  public active = false;
  public kind: ShapeType = 'square';

  public x = 0;
  public y = 0;
  public prevX = 0;
  public prevY = 0;
  public vx = 0;
  public vy = 0;
  public radius = 13;

  public rotation = 0;
  public rotationSpeed = 0;

  public hp = 10;
  public maxHp = 10;
  public bodyDamage = 8;
  public xpValue = 10;
  public damageTakenMultiplier = 1.0; // 五邊形為 2/3，其餘為 1.0

  /**
   * 初始化形狀屬性（零配置）
   */
  public init(
    id: number,
    kind: ShapeType,
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    hp: number,
    bodyDamage: number,
    xpValue: number,
    damageTakenMultiplier = 1.0,
    rotation = 0,
    rotationSpeed = 0.01,
  ): void {
    this.id = id;
    this.active = true;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp;
    this.bodyDamage = bodyDamage;
    this.xpValue = xpValue;
    this.damageTakenMultiplier = damageTakenMultiplier;
    this.rotation = rotation;
    this.rotationSpeed = rotationSpeed;
  }

  /**
   * 每個模擬 tick 備份座標供渲染插值
   */
  public prepareStep(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
