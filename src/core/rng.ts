/**
 * 確定性偽隨機數產生器 (Mulberry32)
 * 單一 32-bit 狀態、零配置（所有方法僅操作純量欄位），可在熱路徑安全呼叫。
 * 同一 seed 必定產生相同序列，讓 M9 演化訓練場次 100% 可重現。
 */
export interface Rng {
  /** 回傳 [0, 1) 均勻分佈浮點數 */
  nextFloat(): number;
  /** 回傳 [0, maxExclusive) 整數 */
  nextInt(maxExclusive: number): number;
  /** 回傳 [min, max) 浮點數 */
  range(min: number, max: number): number;
  /** 以機率 p 回傳 true */
  chance(p: number): boolean;
  /** 標準常態分佈 (mean 0, σ 1) */
  gaussian(): number;
}

export class Mulberry32 implements Rng {
  private state: number;
  private spare = 0;
  private hasSpare = false;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  /** 重設種子（原地覆寫，不建立新物件） */
  public reseed(seed: number): void {
    this.state = seed >>> 0;
    this.hasSpare = false;
  }

  public getState(): number {
    return this.state;
  }

  public nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(maxExclusive: number): number {
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  public range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  public chance(p: number): boolean {
    return this.nextFloat() < p;
  }

  /** Box-Muller 轉換（成對產生，暫存第二個值以避免浪費與配置） */
  public gaussian(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    let u = this.nextFloat();
    if (u < 1e-12) u = 1e-12;
    const v = this.nextFloat();
    const mag = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    this.spare = mag * Math.sin(angle);
    this.hasSpare = true;
    return mag * Math.cos(angle);
  }
}

/** 取得非確定性的隨機種子（僅供正式遊玩初始化使用，訓練請明確傳入 seed） */
export function createRandomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
