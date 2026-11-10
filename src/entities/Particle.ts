/**
 * 粒子實體 (Particle)
 * 扁平數值模型，100% 透過 ObjectPool 預配置與重用，熱路徑零配置 (Zero-Allocation)。
 */
export class Particle {
  public id = 0;
  public active = false;
  public x = 0;
  public y = 0;
  public prevX = 0;
  public prevY = 0;
  public vx = 0;
  public vy = 0;
  public color = 0xffffff;
  public radius = 4;
  public lifeTicks = 0;
  public maxLifeTicks = 25;
  public damping = 0.92;

  /**
   * 初始化粒子屬性
   */
  public init(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    radius: number,
    maxLifeTicks: number,
    damping = 0.92,
  ): void {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.lifeTicks = 0;
    this.maxLifeTicks = maxLifeTicks;
    this.damping = damping;
    this.active = true;
  }

  /**
   * 每個模擬 tick (25 TPS) 更新粒子速度與生命週期
   */
  public step(): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.damping;
    this.vy *= this.damping;
    this.lifeTicks++;

    if (this.lifeTicks >= this.maxLifeTicks) {
      this.active = false;
    }
  }

  /**
   * 重置粒子狀態
   */
  public reset(): void {
    this.active = false;
    this.lifeTicks = 0;
    this.vx = 0;
    this.vy = 0;
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
  }
}
