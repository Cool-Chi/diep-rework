import {
  SHAPE_CAPACITY,
  SHAPE_DAMPING,
  SHAPE_DRIFT_SPEED,
  SHAPE_PENTAGON_RADIUS,
  SHAPE_SQUARE_RADIUS,
  SHAPE_TARGET_COUNT,
  SHAPE_TRIANGLE_RADIUS,
  WALL_BOUNCE_FACTOR,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';
import { Shape, type ShapeType } from '../entities/Shape';

/**
 * 幾何資源生態系統 (ShapeSystem)
 * 負責預先配置形狀陣列、依 70/22/8 比例生成、隨機漂移漫遊與可視範圍外動態補充
 */
export class ShapeSystem {
  public readonly shapes: Shape[] = [];
  public activeCount = 0;

  constructor() {
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      this.shapes.push(new Shape());
    }
  }

  /**
   * 生成單一形狀
   * @param kind 指定形狀種類（若未指定則依 70% 方塊 / 22% 三角 / 8% 五邊形權重隨機抽取）
   * @param x 指定生成世界 X
   * @param y 指定生成世界 Y
   * @returns 成功返回形狀索引，池滿則返回 -1
   */
  public spawnShape(kind?: ShapeType, x?: number, y?: number): number {
    // 尋找閒置空位
    let slot = -1;
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      if (!this.shapes[i].active) {
        slot = i;
        break;
      }
    }
    if (slot === -1) return -1;

    // 若未指定種類，按權重抽取
    let actualKind = kind;
    if (!actualKind) {
      const roll = Math.random();
      if (roll < 0.7) {
        actualKind = 'square';
      } else if (roll < 0.92) {
        actualKind = 'triangle';
      } else {
        actualKind = 'pentagon';
      }
    }

    // 依據種類指派規格
    let radius = SHAPE_SQUARE_RADIUS;
    let hp = 10;
    let bodyDamage = 8;
    let xpValue = 10;
    let damageMultiplier = 1.0;

    if (actualKind === 'triangle') {
      radius = SHAPE_TRIANGLE_RADIUS;
      hp = 30;
      bodyDamage = 8;
      xpValue = 25;
      damageMultiplier = 1.0;
    } else if (actualKind === 'pentagon') {
      radius = SHAPE_PENTAGON_RADIUS;
      hp = 100;
      bodyDamage = 12;
      xpValue = 130;
      damageMultiplier = 2 / 3;
    }

    // 若未指定座標，隨機在世界邊界內選取
    const actualX =
      x !== undefined ? x : radius + Math.random() * (WORLD_WIDTH - 2 * radius);
    const actualY =
      y !== undefined
        ? y
        : radius + Math.random() * (WORLD_HEIGHT - 2 * radius);

    // 隨機微小漂移速度與旋轉
    const vx = (Math.random() - 0.5) * 2 * SHAPE_DRIFT_SPEED;
    const vy = (Math.random() - 0.5) * 2 * SHAPE_DRIFT_SPEED;
    const rotation = Math.random() * Math.PI * 2;
    const rotationSpeed = (Math.random() - 0.5) * 0.02;

    this.shapes[slot].init(
      slot,
      actualKind,
      actualX,
      actualY,
      vx,
      vy,
      radius,
      hp,
      bodyDamage,
      xpValue,
      damageMultiplier,
      rotation,
      rotationSpeed,
    );

    this.activeCount++;
    return slot;
  }

  /**
   * 補滿形狀至目標數量 (500)
   * @param visibleBounds 可視矩形 [minX, minY, maxX, maxY]，優先在可視範圍外生成
   */
  public fillToTarget(visibleBounds?: [number, number, number, number]): void {
    while (this.activeCount < SHAPE_TARGET_COUNT) {
      let spawnX: number | undefined;
      let spawnY: number | undefined;

      if (visibleBounds) {
        const [minX, minY, maxX, maxY] = visibleBounds;
        // 最多嘗試 20 次取點落在可視範圍外
        for (let attempt = 0; attempt < 20; attempt++) {
          const testX = 25 + Math.random() * (WORLD_WIDTH - 50);
          const testY = 25 + Math.random() * (WORLD_HEIGHT - 50);
          if (testX < minX || testX > maxX || testY < minY || testY > maxY) {
            spawnX = testX;
            spawnY = testY;
            break;
          }
        }
      }

      const idx = this.spawnShape(undefined, spawnX, spawnY);
      if (idx === -1) break;
    }
  }

  /**
   * 每個模擬 tick 更新所有活躍形狀的物理漂移、阻尼、旋轉與邊界碰撞
   * @param visibleBounds 當前可視範圍
   */
  public update(visibleBounds?: [number, number, number, number]): void {
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      const shape = this.shapes[i];
      if (shape.active) {
        // 備份上一 tick 座標供渲染插值
        shape.prepareStep();

        // 旋轉更新
        shape.rotation += shape.rotationSpeed;

        // 速度阻尼
        shape.vx *= SHAPE_DAMPING;
        shape.vy *= SHAPE_DAMPING;

        // 位置推進
        shape.x += shape.vx;
        shape.y += shape.vy;

        // 邊界碰撞約束與反彈
        const r = shape.radius;
        if (shape.x < r) {
          shape.x = r;
          if (shape.vx < 0) shape.vx = -shape.vx * WALL_BOUNCE_FACTOR;
        } else if (shape.x > WORLD_WIDTH - r) {
          shape.x = WORLD_WIDTH - r;
          if (shape.vx > 0) shape.vx = -shape.vx * WALL_BOUNCE_FACTOR;
        }

        if (shape.y < r) {
          shape.y = r;
          if (shape.vy < 0) shape.vy = -shape.vy * WALL_BOUNCE_FACTOR;
        } else if (shape.y > WORLD_HEIGHT - r) {
          shape.y = WORLD_HEIGHT - r;
          if (shape.vy > 0) shape.vy = -shape.vy * WALL_BOUNCE_FACTOR;
        }

        // 若速度極小，施加微弱漂移擾動保持動態生態
        const spdSq = shape.vx * shape.vx + shape.vy * shape.vy;
        if (spdSq < 0.0001) {
          shape.vx += (Math.random() - 0.5) * 0.02;
          shape.vy += (Math.random() - 0.5) * 0.02;
        }
      }
    }

    // 動態補滿形狀
    if (this.activeCount < SHAPE_TARGET_COUNT) {
      this.fillToTarget(visibleBounds);
    }
  }

  /**
   * 清除場上所有形狀
   */
  public clearAll(): void {
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      this.shapes[i].active = false;
    }
    this.activeCount = 0;
  }

  /**
   * 重新計算實際活躍數量（校準用）
   */
  public recount(): number {
    let count = 0;
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      if (this.shapes[i].active) count++;
    }
    this.activeCount = count;
    return count;
  }
}
