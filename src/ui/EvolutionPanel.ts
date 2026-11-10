import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  COLOR_BARREL_GRAY,
  COLOR_BORDER_LINE,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
} from '../config/constants';
import { TANKS_CONFIG, type TankClassId } from '../config/tanks.config';
import type { EventBus } from '../core/EventBus';
import { BASE_MARGIN } from './layout';

export const CARD_SIZE = 72;
export const CARD_GAP = 8;

interface CardView {
  container: Container;
  bgGraphics: Graphics;
  iconGraphics: Graphics;
  nameText: Text;
  classId: TankClassId;
  bounds: { x: number; y: number; w: number; h: number };
}

/**
 * 轉職卡牌面板 (EvolutionPanel)
 * 位於畫布左上角，於玩家達成轉職標準時浮現 2x2 職業選擇卡牌
 * 點擊卡牌派發 classUpgradeRequested 事件，並完全阻斷遊戲開火
 */
export class EvolutionPanel {
  public readonly container = new Container();
  public visible = false;

  private readonly eventBus: EventBus;
  private readonly cards: CardView[] = [];
  private currentScale = 1.0;
  private screenX = 0;
  private screenY = 0;
  private panelWidth = 0;
  private panelHeight = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container.visible = false;

    const style = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    });

    const tier2List: TankClassId[] = [
      'twin',
      'sniper',
      'machine_gun',
      'flank_guard',
    ];

    // 預先建立 4 張卡牌（2x2 網格佈局）
    for (let i = 0; i < 4; i++) {
      const classId = tier2List[i];
      const cardContainer = new Container();

      const bg = new Graphics();
      cardContainer.addChild(bg);

      const icon = new Graphics();
      cardContainer.addChild(icon);

      const def = TANKS_CONFIG[classId];
      const nameText = new Text({
        text: def.name,
        style,
      });
      nameText.anchor.set(0.5, 1);
      cardContainer.addChild(nameText);

      this.container.addChild(cardContainer);

      this.cards.push({
        container: cardContainer,
        bgGraphics: bg,
        iconGraphics: icon,
        nameText,
        classId,
        bounds: { x: 0, y: 0, w: 0, h: 0 },
      });
    }

    // 監聽轉職成功後自動關閉
    this.eventBus.onClassChanged(() => {
      this.hide();
    });
  }

  /**
   * 展開轉職卡牌面板
   */
  public show(candidates: TankClassId[]): void {
    if (!candidates || candidates.length === 0) return;
    this.visible = true;
    this.container.visible = true;
    this.rebuildCards();
  }

  /**
   * 隱藏轉職面板
   */
  public hide(): void {
    this.visible = false;
    this.container.visible = false;
  }

  /**
   * 螢幕大小變動或縮放時重繪
   */
  public resize(scale: number): void {
    this.currentScale = scale;
    const margin = BASE_MARGIN * scale;
    this.screenX = margin;
    this.screenY = margin;
    this.container.position.set(this.screenX, this.screenY);
    this.container.scale.set(scale, scale);
    this.rebuildCards();
  }

  private rebuildCards(): void {
    const cardSize = CARD_SIZE;
    const gap = CARD_GAP;

    this.panelWidth = cardSize * 2 + gap;
    this.panelHeight = cardSize * 2 + gap;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const col = i % 2;
      const row = Math.floor(i / 2);

      const localX = col * (cardSize + gap);
      const localY = row * (cardSize + gap);

      card.container.position.set(localX, localY);

      // 背景卡牌 (圓角矩形)
      card.bgGraphics.clear();
      card.bgGraphics
        .roundRect(0, 0, cardSize, cardSize, 6)
        .fill({ color: 0x111111, alpha: 0.85 })
        .stroke({ color: COLOR_BORDER_LINE, width: 2 });

      // 繪製微縮坦克圖標
      this.drawCardIcon(card.iconGraphics, card.classId, cardSize);

      // 文字位置 (置於卡牌底部上方)
      card.nameText.position.set(cardSize * 0.5, cardSize - 4);

      // 記錄世界/螢幕點擊邊界 (未縮放基準)
      card.bounds.x = localX;
      card.bounds.y = localY;
      card.bounds.w = cardSize;
      card.bounds.h = cardSize;
    }
  }

  /**
   * 在卡牌中心繪製微縮版坦克圖標
   */
  private drawCardIcon(g: Graphics, classId: TankClassId, size: number): void {
    g.clear();
    const cx = size * 0.5;
    const cy = size * 0.42;
    const def = TANKS_CONFIG[classId];
    if (!def) return;

    const iconScale = 0.45; // 微縮倍率
    const barrels = def.barrels;

    // 1. 繪製微縮砲管
    for (let b = 0; b < barrels.length; b++) {
      const barrel = barrels[b];
      const L = barrel.length * iconScale;
      const wBase = barrel.width * iconScale;
      const wTip = (barrel.tipWidth ?? barrel.width) * iconScale;
      const theta = barrel.angle;
      const ox = barrel.offsetX * iconScale;
      const oy = barrel.offsetY * iconScale;

      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const x0 = 0;
      const y0 = -wBase * 0.5;
      const x1 = L;
      const y1 = -wTip * 0.5;
      const x2 = L;
      const y2 = wTip * 0.5;
      const x3 = 0;
      const y3 = wBase * 0.5;

      const pts = [
        cx + (x0 * cos - y0 * sin + ox),
        cy + (x0 * sin + y0 * cos + oy),
        cx + (x1 * cos - y1 * sin + ox),
        cy + (x1 * sin + y1 * cos + oy),
        cx + (x2 * cos - y2 * sin + ox),
        cy + (x2 * sin + y2 * cos + oy),
        cx + (x3 * cos - y3 * sin + ox),
        cy + (x3 * sin + y3 * cos + oy),
      ];

      g.poly(pts)
        .fill({ color: COLOR_BARREL_GRAY })
        .stroke({ color: COLOR_STROKE, width: 1.5 });
    }

    // 2. 繪製微縮圓形底盤
    const r = def.bodyRadius * iconScale;
    g.circle(cx, cy, r)
      .fill({ color: COLOR_TANK_BLUE })
      .stroke({ color: COLOR_STROKE, width: 1.5 });
  }

  /**
   * 檢查螢幕座標是否在面板內 (阻斷射擊)
   */
  public containsPoint(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    const s = this.currentScale;
    const w = this.panelWidth * s;
    const h = this.panelHeight * s;
    return (
      screenX >= this.screenX &&
      screenX <= this.screenX + w &&
      screenY >= this.screenY &&
      screenY <= this.screenY + h
    );
  }

  /**
   * 處理點擊事件 (點擊卡牌即觸發轉職)
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    const s = this.currentScale;
    const localX = (screenX - this.screenX) / s;
    const localY = (screenY - this.screenY) / s;

    for (let i = 0; i < this.cards.length; i++) {
      const b = this.cards[i].bounds;
      if (
        localX >= b.x &&
        localX <= b.x + b.w &&
        localY >= b.y &&
        localY <= b.y + b.h
      ) {
        this.eventBus.emitClassUpgradeRequested(this.cards[i].classId);
        this.hide();
        return true;
      }
    }

    return true; // 即使沒點在卡牌上也阻斷射擊
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
