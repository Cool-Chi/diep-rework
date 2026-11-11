import { Container, Text, TextStyle } from 'pixi.js';
import { PERSONA_TAGS } from '../ai/aiPersonas.config';
import { BASE_TANK_RADIUS, MAX_TANK_BARRELS } from '../config/constants';
import { sizeFactor } from '../config/stats.config';
import type { VisibleBounds } from '../core/Camera';
import type { Tank } from '../entities/Tank';
import { isInBounds } from './culling';
import { getRenderPosition, type RenderPositionOut } from './getRenderPosition';
import { TankRenderer } from './TankRenderer';

export const MULTI_TANK_POOL_CAPACITY = 48;

interface TankRenderItem {
  container: Container;
  tankRenderer: TankRenderer;
  nameText: Text;
  stateText: Text;
  currentTankId: number;
  currentClassId: string;
  currentColor: number;
  interpolatedRecoils: Float32Array;
}

/**
 * 角度最短弧度插值 (Shortest Arc Angular Interpolation)
 * 確保在 -PI ~ PI 週期邊界處沿最短路徑平滑過渡（零 GC）
 */
export function interpolateAngle(
  from: number,
  to: number,
  alpha: number,
): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * alpha;
}

/**
 * 多坦克集中渲染器 (MultiTankRenderer)
 * 預先配置 48 個渲染項目池，嚴格實施視錐剔除 (isInBounds) 與零 GC 物件複用，
 * 同時支援頭頂擬真暱稱與除錯戰術標籤。
 */
export class MultiTankRenderer {
  public readonly container = new Container();

  private readonly pool: TankRenderItem[] = [];
  private readonly renderPos: RenderPositionOut = { x: 0, y: 0 };

  constructor() {
    const resolution =
      typeof window !== 'undefined'
        ? Math.max(2, window.devicePixelRatio || 1)
        : 2;

    const nameStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x111111, width: 3 },
      align: 'center',
    });

    const stateStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 2 },
      align: 'center',
    });

    for (let i = 0; i < MULTI_TANK_POOL_CAPACITY; i++) {
      const itemContainer = new Container();
      const tankRenderer = new TankRenderer();
      itemContainer.addChild(tankRenderer.container);

      const nameText = new Text({ text: '', style: nameStyle });
      nameText.resolution = resolution;
      nameText.anchor.set(0.5, 1);
      itemContainer.addChild(nameText);

      const stateText = new Text({ text: '', style: stateStyle });
      stateText.resolution = resolution;
      stateText.anchor.set(0.5, 1);
      itemContainer.addChild(stateText);

      itemContainer.visible = false;
      this.container.addChild(itemContainer);

      this.pool.push({
        container: itemContainer,
        tankRenderer,
        nameText,
        stateText,
        currentTankId: -1,
        currentClassId: '',
        currentColor: -1,
        interpolatedRecoils: new Float32Array(MAX_TANK_BARRELS),
      });
    }
  }

  /**
   * 每渲染幀更新所有可見坦克的插值座標、砲管朝向與頭頂暱稱
   */
  public update(
    tanks: Tank[],
    alpha: number,
    visibleBounds: VisibleBounds,
    showDevLabels = false,
    isGodView = false,
    cameraScale = 1.0,
  ): void {
    let poolIdx = 0;
    const count = tanks.length;

    for (let i = 0; i < count; i++) {
      const tank = tanks[i];
      if (!tank.active) continue;

      // 1. 取得平滑插值後的渲染世界座標
      getRenderPosition(tank, alpha, this.renderPos);
      const rx = this.renderPos.x;
      const ry = this.renderPos.y;
      const scale = sizeFactor(tank.level);
      const visualRadius = tank.radius * scale;

      // 2. 視錐剔除（畫面外的坦克不渲染）
      if (!isInBounds(rx, ry, visualRadius + 40, visibleBounds, 60)) {
        continue;
      }

      if (poolIdx >= MULTI_TANK_POOL_CAPACITY) break;
      const item = this.pool[poolIdx++];

      // 3. 檢查實體變更或職業/色彩變化
      const classId = tank.definition.id;
      const color = tank.color;
      if (
        item.currentTankId !== tank.id ||
        item.currentClassId !== classId ||
        item.currentColor !== color
      ) {
        item.currentTankId = tank.id;
        item.currentClassId = classId;
        item.currentColor = color;
        item.tankRenderer.setDefinition(
          tank.definition,
          BASE_TANK_RADIUS,
          color,
        );
        const pTag =
          tank.isAi && tank.persona ? `[${PERSONA_TAGS[tank.persona]}] ` : '';
        item.nameText.text = `${pTag}${tank.name}`;
      }

      // 4. 計算砲管世界朝向角度（AI 使用渲染幀插值後的平滑角度，玩家即時跟隨滑鼠）
      let aimAngle: number;
      if (tank.isAi) {
        aimAngle = interpolateAngle(tank.prevRotation, tank.rotation, alpha);
      } else {
        const aimDx = tank.input.aimX - rx;
        const aimDy = tank.input.aimY - ry;
        aimAngle = Math.atan2(aimDy, aimDx);
      }

      // 5. 插值各砲管後座力收縮偏移並更新坦克底盤與砲管
      const barrelCount = tank.definition.barrels.length;
      for (let b = 0; b < barrelCount; b++) {
        item.interpolatedRecoils[b] =
          tank.prevBarrelRecoils[b] +
          (tank.barrelRecoils[b] - tank.prevBarrelRecoils[b]) * alpha;
      }
      item.tankRenderer.update(
        rx,
        ry,
        aimAngle,
        scale,
        item.interpolatedRecoils,
      );

      // 重生無敵呼吸呼吸閃爍護盾
      if (tank.invulnerableTicks > 0) {
        item.container.alpha = 0.55 + 0.35 * Math.sin(Date.now() * 0.015);
      } else {
        item.container.alpha = 1.0;
      }

      // 6. 計算標籤縮放 (在上帝視角下適度放大，既清晰可見又避免相鄰坦克字體相互重疊)
      const labelScale = isGodView
        ? Math.min(6.5, Math.max(1.0, 0.55 / Math.max(cameraScale, 0.05)))
        : 1.0;
      item.nameText.scale.set(labelScale);
      item.stateText.scale.set(labelScale * 0.85);

      // 更新頭頂暱稱位置（置於本體上方，血條下方）
      const textY = ry - visualRadius - 5 * labelScale;
      item.nameText.position.set(rx, textY);
      item.nameText.visible = true;

      // 7. 戰術狀態標籤 (FARM / COMBAT / RETREAT)
      if ((showDevLabels || isGodView) && tank.isAi) {
        let targetInfo = '';
        if (tank.aiState === 'engaging' && tank.aiTargetId !== -1) {
          targetInfo = ` -> #${tank.aiTargetId}`;
        } else if (tank.aiState === 'farming' && tank.aiTargetShapeId !== -1) {
          targetInfo = ` -> S#${tank.aiTargetShapeId}`;
        }

        if (isGodView) {
          item.stateText.text = `[Lv${tank.level} ${tank.definition.id}] [${tank.aiState.toUpperCase()}${targetInfo}]`;
        } else {
          item.stateText.text = `[${tank.aiState.toUpperCase()}${targetInfo}]`;
        }

        let stateColor = 0x00ff88;
        if (tank.aiState === 'engaging') {
          stateColor = 0xff4444;
        } else if (tank.aiState === 'retreating') {
          stateColor = 0xffcc00;
        }
        item.stateText.tint = stateColor;

        item.stateText.position.set(rx, textY - 15 * labelScale);
        item.stateText.visible = true;
      } else {
        item.stateText.visible = false;
      }

      item.container.visible = true;
    }

    // 8. 隱藏剩餘未使用的池項目
    for (let p = poolIdx; p < MULTI_TANK_POOL_CAPACITY; p++) {
      this.pool[p].container.visible = false;
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
