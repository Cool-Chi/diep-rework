import type { ShapeType } from '../entities/Shape';

type ShapeDestroyedHandler = (kind: ShapeType, killerId: number) => void;
type TankDiedHandler = (victimId: number, killerId?: number) => void;
type LevelUpHandler = (tankId: number, level: number) => void;
type StatPointsChangedHandler = (tankId: number, points: number) => void;
type StatUpgradeRequestedHandler = (statIndex: number) => void;

/**
 * 零配置型別安全事件匯流排
 * 跨系統解耦通知，emit 呼叫只傳遞原始數值，熱路徑絕不配置事件物件
 */
export class EventBus {
  private shapeDestroyedHandlers: ShapeDestroyedHandler[] = [];
  private tankDiedHandlers: TankDiedHandler[] = [];
  private levelUpHandlers: LevelUpHandler[] = [];
  private statPointsChangedHandlers: StatPointsChangedHandler[] = [];
  private statUpgradeRequestedHandlers: StatUpgradeRequestedHandler[] = [];

  // 1. Shape Destroyed
  public onShapeDestroyed(handler: ShapeDestroyedHandler): void {
    this.shapeDestroyedHandlers.push(handler);
  }

  public offShapeDestroyed(handler: ShapeDestroyedHandler): void {
    const idx = this.shapeDestroyedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.shapeDestroyedHandlers.splice(idx, 1);
    }
  }

  public emitShapeDestroyed(kind: ShapeType, killerId: number): void {
    const len = this.shapeDestroyedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.shapeDestroyedHandlers[i](kind, killerId);
    }
  }

  // 2. Tank Died
  public onTankDied(handler: TankDiedHandler): void {
    this.tankDiedHandlers.push(handler);
  }

  public offTankDied(handler: TankDiedHandler): void {
    const idx = this.tankDiedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.tankDiedHandlers.splice(idx, 1);
    }
  }

  public emitTankDied(victimId: number, killerId = -1): void {
    const len = this.tankDiedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.tankDiedHandlers[i](victimId, killerId);
    }
  }

  // 3. Level Up
  public onLevelUp(handler: LevelUpHandler): void {
    this.levelUpHandlers.push(handler);
  }

  public offLevelUp(handler: LevelUpHandler): void {
    const idx = this.levelUpHandlers.indexOf(handler);
    if (idx !== -1) {
      this.levelUpHandlers.splice(idx, 1);
    }
  }

  public emitLevelUp(tankId: number, level: number): void {
    const len = this.levelUpHandlers.length;
    for (let i = 0; i < len; i++) {
      this.levelUpHandlers[i](tankId, level);
    }
  }

  // 4. Stat Points Changed
  public onStatPointsChanged(handler: StatPointsChangedHandler): void {
    this.statPointsChangedHandlers.push(handler);
  }

  public offStatPointsChanged(handler: StatPointsChangedHandler): void {
    const idx = this.statPointsChangedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.statPointsChangedHandlers.splice(idx, 1);
    }
  }

  public emitStatPointsChanged(tankId: number, points: number): void {
    const len = this.statPointsChangedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.statPointsChangedHandlers[i](tankId, points);
    }
  }

  // 5. Stat Upgrade Requested
  public onStatUpgradeRequested(handler: StatUpgradeRequestedHandler): void {
    this.statUpgradeRequestedHandlers.push(handler);
  }

  public offStatUpgradeRequested(handler: StatUpgradeRequestedHandler): void {
    const idx = this.statUpgradeRequestedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.statUpgradeRequestedHandlers.splice(idx, 1);
    }
  }

  public emitStatUpgradeRequested(statIndex: number): void {
    const len = this.statUpgradeRequestedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.statUpgradeRequestedHandlers[i](statIndex);
    }
  }

  public clear(): void {
    this.shapeDestroyedHandlers.length = 0;
    this.tankDiedHandlers.length = 0;
    this.levelUpHandlers.length = 0;
    this.statPointsChangedHandlers.length = 0;
    this.statUpgradeRequestedHandlers.length = 0;
  }
}
