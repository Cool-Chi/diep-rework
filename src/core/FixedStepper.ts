import { MAX_CATCHUP_TICKS, SIM_TICK_TIME } from '../config/constants';

export interface StepResult {
  ticks: number;
  alpha: number;
}

/**
 * 固定模擬時間步長累加器
 * 負責將渲染幀的可變時間（dt）轉換為離散的固定 tick 數與用於平滑插值的 alpha (0 <= alpha < 1)
 */
export class FixedStepper {
  private accumulator = 0;
  private readonly tickTime: number;
  private readonly maxCatchupTicks: number;

  constructor(
    tickTime: number = SIM_TICK_TIME,
    maxCatchupTicks: number = MAX_CATCHUP_TICKS,
  ) {
    this.tickTime = tickTime;
    this.maxCatchupTicks = maxCatchupTicks;
  }

  /**
   * 傳入當前幀經過的秒數，更新累加器並計算應模擬的 tick 數
   * @param dtSeconds 距離上一幀的時間差（秒）
   */
  public advance(dtSeconds: number): StepResult {
    if (dtSeconds < 0 || Number.isNaN(dtSeconds)) {
      return { ticks: 0, alpha: this.accumulator / this.tickTime };
    }

    this.accumulator += dtSeconds;

    // 加入微小 epsilon (1e-9) 消除浮點數二進位累加誤差 (如 1/60s 累加 120 幀得 1.9999999999999998s)
    let ticks = Math.floor((this.accumulator + 1e-9) / this.tickTime);

    if (ticks > this.maxCatchupTicks) {
      // 超過追趕上限（例如切換分頁後回來），截斷為最大追趕 tick 數，並丟棄剩餘時間避免螺旋追趕
      ticks = this.maxCatchupTicks;
      this.accumulator = this.accumulator % this.tickTime;
    } else if (ticks > 0) {
      this.accumulator = Math.max(0, this.accumulator - ticks * this.tickTime);
    }

    const alpha = Math.max(
      0,
      Math.min(this.accumulator / this.tickTime, 0.999999),
    );
    return {
      ticks,
      alpha,
    };
  }

  /** 重置累加器狀態 */
  public reset(): void {
    this.accumulator = 0;
  }

  /** 取得當前殘留的累加秒數 */
  public getAccumulator(): number {
    return this.accumulator;
  }
}
