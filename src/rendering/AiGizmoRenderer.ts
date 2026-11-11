import { Container, Graphics } from 'pixi.js';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { isInBounds } from './culling';
import { getRenderPosition, type RenderPositionOut } from './getRenderPosition';
import { interpolateAngle } from './MultiTankRenderer';

/**
 * AI 視野與決策可視化繪製器 (AiGizmoRenderer)
 * 供調試時直觀觀察 AI 視野範圍 (Perception Radar)、砲管朝向射線 (Aim Ray)、
 * 鎖定目標連線 (Target Line) 與子彈攔截線 (Intercept Line)。
 * 遵循 Zero-GC 與手動視錐剔除原則。
 */
export class AiGizmoRenderer {
  public readonly container = new Container();
  private readonly graphics = new Graphics();
  private readonly selfPos: RenderPositionOut = { x: 0, y: 0 };
  private readonly targetPos: RenderPositionOut = { x: 0, y: 0 };

  constructor() {
    this.container.addChild(this.graphics);
  }

  /**
   * 每個渲染幀更新繪製所有在視圖內的 AI 戰術 Gizmo
   */
  public update(
    allTanks: Tank[],
    shapes: Shape[],
    bulletPool: ObjectPool<Bullet>,
    alpha: number,
    visibleBounds: VisibleBounds,
    enabled: boolean,
  ): void {
    this.graphics.clear();
    if (!enabled) return;

    const tankCount = allTanks.length;
    const shapeCount = shapes.length;

    for (let i = 0; i < tankCount; i++) {
      const tank = allTanks[i];
      if (!tank.active || !tank.isAi) continue;

      getRenderPosition(tank, alpha, this.selfPos);
      const rx = this.selfPos.x;
      const ry = this.selfPos.y;

      const classFov = tank.definition.fovMultiplier ?? 1.0;
      const perceptionRadius =
        (tank.aiState === 'retreating' ? 950 : 750) * classFov;

      // 視錐剔除：若整圈感知視野完全不在畫面內，跳過
      if (!isInBounds(rx, ry, perceptionRadius, visibleBounds, 50)) {
        continue;
      }

      const color = tank.color || 0x00b2e1;

      // 1. 繪製感知視野圓 (Perception Circle)
      this.graphics
        .circle(rx, ry, perceptionRadius)
        .stroke({ color, width: 1.2, alpha: 0.22 })
        .fill({ color, alpha: 0.015 });

      // 2. 繪製瞄準射線 (Aim Ray)
      const aimAngle = interpolateAngle(
        tank.prevRotation,
        tank.rotation,
        alpha,
      );
      const rayLen = 160;
      const endX = rx + Math.cos(aimAngle) * rayLen;
      const endY = ry + Math.sin(aimAngle) * rayLen;
      this.graphics
        .moveTo(rx, ry)
        .lineTo(endX, endY)
        .stroke({ color, width: 2, alpha: 0.65 });
      this.graphics.circle(endX, endY, 3.5).fill({ color, alpha: 0.75 });

      // 2.5 繪製殘血逃跑軌跡箭頭 (Escape Ray)
      if (tank.aiState === 'retreating') {
        const mvSq =
          tank.input.moveX * tank.input.moveX +
          tank.input.moveY * tank.input.moveY;
        if (mvSq > 0.01) {
          const mvLen = Math.sqrt(mvSq);
          const mnx = tank.input.moveX / mvLen;
          const mny = tank.input.moveY / mvLen;
          const escLen = 130;
          const escX = rx + mnx * escLen;
          const escY = ry + mny * escLen;

          // 亮青藍色逃跑軌跡線 (0x00f0ff)
          this.graphics
            .moveTo(rx, ry)
            .lineTo(escX, escY)
            .stroke({ color: 0x00f0ff, width: 2.2, alpha: 0.85 });

          // 逃跑方向箭頭
          const arrSz = 10;
          this.graphics
            .moveTo(escX, escY)
            .lineTo(
              escX - mnx * arrSz - mny * arrSz * 0.6,
              escY - mny * arrSz + mnx * arrSz * 0.6,
            )
            .stroke({ color: 0x00f0ff, width: 2.2, alpha: 0.85 });
          this.graphics
            .moveTo(escX, escY)
            .lineTo(
              escX - mnx * arrSz + mny * arrSz * 0.6,
              escY - mny * arrSz - mnx * arrSz * 0.6,
            )
            .stroke({ color: 0x00f0ff, width: 2.2, alpha: 0.85 });
        }
      }

      // 3. 繪製目標鎖定線 (Target Lock Line)
      if (tank.aiState === 'engaging' && tank.aiTargetId !== -1) {
        // 尋找敵方坦克目標
        for (let t = 0; t < tankCount; t++) {
          const targetTank = allTanks[t];
          if (targetTank.id === tank.aiTargetId && targetTank.active) {
            getRenderPosition(targetTank, alpha, this.targetPos);
            const tx = this.targetPos.x;
            const ty = this.targetPos.y;

            // 紅色鎖定線 (Crimson Red)
            this.graphics
              .moveTo(rx, ry)
              .lineTo(tx, ty)
              .stroke({ color: 0xff3344, width: 1.5, alpha: 0.5 });

            // 目標鎖定菱形框
            const sz = 8;
            this.graphics
              .moveTo(tx, ty - sz)
              .lineTo(tx + sz, ty)
              .lineTo(tx, ty + sz)
              .lineTo(tx - sz, ty)
              .closePath()
              .stroke({ color: 0xff3344, width: 1.5, alpha: 0.8 });
            break;
          }
        }
      } else if (tank.aiState === 'farming' && tank.aiTargetShapeId !== -1) {
        // 尋找幾何形狀目標
        for (let s = 0; s < shapeCount; s++) {
          const sh = shapes[s];
          if (sh.id === tank.aiTargetShapeId && sh.active) {
            const sx = sh.prevX + (sh.x - sh.prevX) * alpha;
            const sy = sh.prevY + (sh.y - sh.prevY) * alpha;

            // 琥珀金鎖定線 (Amber Yellow)
            this.graphics
              .moveTo(rx, ry)
              .lineTo(sx, sy)
              .stroke({ color: 0xffcc00, width: 1.2, alpha: 0.4 });
            break;
          }
        }
      }

      // 4. 繪製子彈攔截線 (Bullet Intercept Line)
      if (tank.aiInterceptBulletIdx !== -1) {
        const bIdx = tank.aiInterceptBulletIdx;
        if (bulletPool.isActive(bIdx)) {
          const b = bulletPool.items[bIdx];
          const bx = b.prevX + (b.x - b.prevX) * alpha;
          const by = b.prevY + (b.y - b.prevY) * alpha;

          // 金黃色警示線
          this.graphics
            .moveTo(rx, ry)
            .lineTo(bx, by)
            .stroke({ color: 0xffe066, width: 2, alpha: 0.85 });
          this.graphics
            .circle(bx, by, b.radius + 4)
            .stroke({ color: 0xffe066, width: 1.5, alpha: 0.85 });
        }
      }
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
