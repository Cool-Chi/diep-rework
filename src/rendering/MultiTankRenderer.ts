import { Container, Text, TextStyle } from 'pixi.js';
import { BASE_TANK_RADIUS } from '../config/constants';
import { sizeFactor } from '../config/stats.config';
import type { VisibleBounds } from '../core/Camera';
import type { Tank } from '../entities/Tank';
import { isInBounds } from './culling';
import { getRenderPosition, type RenderPositionOut } from './getRenderPosition';
import { TankRenderer } from './TankRenderer';

export const MULTI_TANK_POOL_CAPACITY = 32;

interface TankRenderItem {
  container: Container;
  tankRenderer: TankRenderer;
  nameText: Text;
  stateText: Text;
  currentTankId: number;
  currentClassId: string;
  currentColor: number;
}

/**
 * 多坦克集中渲染器 (MultiTankRenderer)
 * 預先配置 32 個渲染項目池，嚴格實施視錐剔除 (isInBounds) 與零 GC 物件複用，
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
      fill: 0x00ffcc,
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
        item.nameText.text = tank.name;
      }

      // 4. 計算砲管世界朝向角度
      const aimDx = tank.input.aimX - rx;
      const aimDy = tank.input.aimY - ry;
      const aimAngle = Math.atan2(aimDy, aimDx);

      // 5. 更新坦克底盤與砲管
      item.tankRenderer.update(rx, ry, aimAngle, scale);

      // 6. 更新頭頂暱稱位置（置於本體上方，血條下方）
      const textY = ry - visualRadius - 8;
      item.nameText.position.set(rx, textY);
      item.nameText.visible = true;

      // 7. 除錯狀態標籤 (FARM / COMBAT / RETREAT)
      if (showDevLabels && tank.isAi) {
        item.stateText.text = `[${tank.aiState.toUpperCase()}]`;
        item.stateText.position.set(rx, textY - 14);
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
