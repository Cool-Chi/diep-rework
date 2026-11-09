import type { ShapeType } from '../entities/Shape';

type ShapeDestroyedHandler = (kind: ShapeType, killerId: number) => void;
type TankDiedHandler = (id: number) => void;

/**
 * 零配置型別安全事件匯流排
 * 跨系統解耦通知，emit 呼叫只傳遞原始數值，熱路徑絕不配置事件物件
 */
export class EventBus {
  private shapeDestroyedHandlers: ShapeDestroyedHandler[] = [];
  private tankDiedHandlers: TankDiedHandler[] = [];

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

  public onTankDied(handler: TankDiedHandler): void {
    this.tankDiedHandlers.push(handler);
  }

  public offTankDied(handler: TankDiedHandler): void {
    const idx = this.tankDiedHandlers.indexOf(handler);
    if (idx !== -1) {
      this.tankDiedHandlers.splice(idx, 1);
    }
  }

  public emitTankDied(id: number): void {
    const len = this.tankDiedHandlers.length;
    for (let i = 0; i < len; i++) {
      this.tankDiedHandlers[i](id);
    }
  }

  public clear(): void {
    this.shapeDestroyedHandlers.length = 0;
    this.tankDiedHandlers.length = 0;
  }
}
