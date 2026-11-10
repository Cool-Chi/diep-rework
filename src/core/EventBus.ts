import type { TankClassId } from '../config/tanks.config';
import type { ShapeType } from '../entities/Shape';

type ShapeDestroyedHandler = (
  kind: ShapeType,
  killerId: number,
  x?: number,
  y?: number,
) => void;
type TankDiedHandler = (
  victimId: number,
  killerId?: number,
  victimX?: number,
  victimY?: number,
) => void;
type LevelUpHandler = (tankId: number, level: number) => void;
type StatPointsChangedHandler = (tankId: number, points: number) => void;
type StatUpgradeRequestedHandler = (statIndex: number) => void;
type ScoreChangedHandler = (tankId: number, score: number) => void;
type ClassUpgradeRequestedHandler = (classId: TankClassId) => void;
type ClassChangedHandler = (tankId: number, classId: TankClassId) => void;
type EvolutionAvailableHandler = (
  tankId: number,
  candidates: TankClassId[],
) => void;
type BulletHitHandler = (x: number, y: number, color: number) => void;
type BulletClashHandler = (
  x: number,
  y: number,
  radiusA: number,
  radiusB: number,
  colorA: number,
  colorB: number,
) => void;

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
  private scoreChangedHandlers: ScoreChangedHandler[] = [];
  private classUpgradeRequestedHandlers: ClassUpgradeRequestedHandler[] = [];
  private classChangedHandlers: ClassChangedHandler[] = [];
  private evolutionAvailableHandlers: EvolutionAvailableHandler[] = [];
  private bulletHitHandlers: BulletHitHandler[] = [];
  private bulletClashHandlers: BulletClashHandler[] = [];

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

  public emitShapeDestroyed(
    kind: ShapeType,
    killerId: number,
    x = 0,
    y = 0,
  ): void {
    const len = this.shapeDestroyedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.shapeDestroyedHandlers[i](kind, killerId, x, y);
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

  public emitTankDied(
    victimId: number,
    killerId = -1,
    victimX = 0,
    victimY = 0,
  ): void {
    const len = this.tankDiedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.tankDiedHandlers[i](victimId, killerId, victimX, victimY);
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

  // 6. Score Changed
  public onScoreChanged(handler: ScoreChangedHandler): void {
    this.scoreChangedHandlers.push(handler);
  }

  public offScoreChanged(handler: ScoreChangedHandler): void {
    const idx = this.scoreChangedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.scoreChangedHandlers.splice(idx, 1);
    }
  }

  public emitScoreChanged(tankId: number, score: number): void {
    const len = this.scoreChangedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.scoreChangedHandlers[i](tankId, score);
    }
  }

  // 7. Class Upgrade Requested
  public onClassUpgradeRequested(handler: ClassUpgradeRequestedHandler): void {
    this.classUpgradeRequestedHandlers.push(handler);
  }

  public offClassUpgradeRequested(handler: ClassUpgradeRequestedHandler): void {
    const idx = this.classUpgradeRequestedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.classUpgradeRequestedHandlers.splice(idx, 1);
    }
  }

  public emitClassUpgradeRequested(classId: TankClassId): void {
    const len = this.classUpgradeRequestedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.classUpgradeRequestedHandlers[i](classId);
    }
  }

  // 8. Class Changed
  public onClassChanged(handler: ClassChangedHandler): void {
    this.classChangedHandlers.push(handler);
  }

  public offClassChanged(handler: ClassChangedHandler): void {
    const idx = this.classChangedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.classChangedHandlers.splice(idx, 1);
    }
  }

  public emitClassChanged(tankId: number, classId: TankClassId): void {
    const len = this.classChangedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.classChangedHandlers[i](tankId, classId);
    }
  }

  // 9. Evolution Available
  public onEvolutionAvailable(handler: EvolutionAvailableHandler): void {
    this.evolutionAvailableHandlers.push(handler);
  }

  public offEvolutionAvailable(handler: EvolutionAvailableHandler): void {
    const idx = this.evolutionAvailableHandlers.indexOf(handler);
    if (idx !== -1) {
      this.evolutionAvailableHandlers.splice(idx, 1);
    }
  }

  public emitEvolutionAvailable(
    tankId: number,
    candidates: TankClassId[],
  ): void {
    const len = this.evolutionAvailableHandlers.length;
    for (let i = 0; i < len; i++) {
      this.evolutionAvailableHandlers[i](tankId, candidates);
    }
  }

  // 10. Bullet Hit (微粒火花特效)
  public onBulletHit(handler: BulletHitHandler): void {
    this.bulletHitHandlers.push(handler);
  }

  public offBulletHit(handler: BulletHitHandler): void {
    const idx = this.bulletHitHandlers.indexOf(handler);
    if (idx !== -1) {
      this.bulletHitHandlers.splice(idx, 1);
    }
  }

  public emitBulletHit(x: number, y: number, color = 0xfffae0): void {
    const len = this.bulletHitHandlers.length;
    for (let i = 0; i < len; i++) {
      this.bulletHitHandlers[i](x, y, color);
    }
  }

  // 11. Bullet Clash (子彈互撞衝擊與破片火花特效)
  public onBulletClash(handler: BulletClashHandler): void {
    this.bulletClashHandlers.push(handler);
  }

  public offBulletClash(handler: BulletClashHandler): void {
    const idx = this.bulletClashHandlers.indexOf(handler);
    if (idx !== -1) {
      this.bulletClashHandlers.splice(idx, 1);
    }
  }

  public emitBulletClash(
    x: number,
    y: number,
    radiusA = 9,
    radiusB = 9,
    colorA = 0x00b2e1,
    colorB = 0xfc7677,
  ): void {
    const len = this.bulletClashHandlers.length;
    for (let i = 0; i < len; i++) {
      this.bulletClashHandlers[i](x, y, radiusA, radiusB, colorA, colorB);
    }
  }

  public clear(): void {
    this.shapeDestroyedHandlers.length = 0;
    this.tankDiedHandlers.length = 0;
    this.levelUpHandlers.length = 0;
    this.statPointsChangedHandlers.length = 0;
    this.statUpgradeRequestedHandlers.length = 0;
    this.scoreChangedHandlers.length = 0;
    this.classUpgradeRequestedHandlers.length = 0;
    this.classChangedHandlers.length = 0;
    this.evolutionAvailableHandlers.length = 0;
    this.bulletHitHandlers.length = 0;
    this.bulletClashHandlers.length = 0;
  }
}
