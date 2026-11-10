import {
  TANK_DAMPING,
  TANK_MOVE_ACCEL,
  WALL_BOUNCE_FACTOR,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import type { Tank } from '../entities/Tank';

/**
 * 自研圓形物理世界（純數值積分，Zero-Allocation）
 */
export class PhysicsWorld {
  public worldWidth: number;
  public worldHeight: number;
  public moveAccel: number;
  public damping: number;
  public wallBounce: number;

  constructor(
    worldWidth = WORLD_WIDTH,
    worldHeight = WORLD_HEIGHT,
    moveAccel = TANK_MOVE_ACCEL,
    damping = TANK_DAMPING,
    wallBounce = WALL_BOUNCE_FACTOR,
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.moveAccel = moveAccel;
    this.damping = damping;
    this.wallBounce = wallBounce;
  }

  /**
   * 推進單一坦克的單一模擬 tick 物理狀態
   * 步驟：正規化輸入意圖 -> 加速度積分 -> 每 tick 阻尼 -> 位置積分 -> 邊界碰撞約束與反彈
   * @param tank 坦克實體
   */
  public stepTank(tank: Tank): void {
    if (!tank.active) return;

    // 1. 備份上一 tick 座標供渲染插值
    tank.prepareStep();

    // 2. 移動意圖向量正規化（避免斜向移動比直線快）
    let mx = tank.input.moveX;
    let my = tank.input.moveY;
    const lenSq = mx * mx + my * my;

    if (lenSq > 1.0) {
      const invLen = 1 / Math.sqrt(lenSq);
      mx *= invLen;
      my *= invLen;
    }

    // 重生無敵保護遞減：若主動大幅移動 (lenSq > 0.1) 則提前解除，否則每 tick 衰減 1
    if (tank.invulnerableTicks > 0) {
      if (lenSq > 0.1) {
        tank.invulnerableTicks = 0;
      } else {
        tank.invulnerableTicks--;
      }
    }

    // 3. 加速度與速度阻尼積分：v_{t+1} = (v_t + a) * DAMPING
    const effectiveAccel = this.moveAccel * tank.moveAccelScale;
    tank.vx = (tank.vx + mx * effectiveAccel) * this.damping;
    tank.vy = (tank.vy + my * effectiveAccel) * this.damping;

    // 防止浮點極微小震盪
    if (Math.abs(tank.vx) < 0.0001) tank.vx = 0;
    if (Math.abs(tank.vy) < 0.0001) tank.vy = 0;

    // 4. 位置積分
    tank.x += tank.vx;
    tank.y += tank.vy;

    // 5. 朝向旋轉更新（朝向瞄準點）
    const dx = tank.input.aimX - tank.x;
    const dy = tank.input.aimY - tank.y;
    if (dx * dx + dy * dy > 0.001) {
      tank.rotation = Math.atan2(dy, dx);
    }

    // 6. 邊界約束（圓形 vs 邊界線段）與反彈處理
    const r = tank.radius;

    // 左邊界
    if (tank.x < r) {
      tank.x = r;
      if (tank.vx < 0) {
        tank.vx = -tank.vx * this.wallBounce;
      }
    } else if (tank.x > this.worldWidth - r) {
      // 右邊界
      tank.x = this.worldWidth - r;
      if (tank.vx > 0) {
        tank.vx = -tank.vx * this.wallBounce;
      }
    }

    // 上邊界
    if (tank.y < r) {
      tank.y = r;
      if (tank.vy < 0) {
        tank.vy = -tank.vy * this.wallBounce;
      }
    } else if (tank.y > this.worldHeight - r) {
      // 下邊界
      tank.y = this.worldHeight - r;
      if (tank.vy > 0) {
        tank.vy = -tank.vy * this.wallBounce;
      }
    }
  }
}
