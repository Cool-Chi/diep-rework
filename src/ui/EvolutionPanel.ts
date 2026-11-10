import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  COLOR_BARREL_GRAY,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
} from '../config/constants';
import {
  TANKS_CONFIG,
  type TankClassId,
  type TankDefinition,
} from '../config/tanks.config';
import type { EventBus } from '../core/EventBus';
import { BASE_MARGIN } from './layout';

export const CARD_SIZE = 76;
export const CARD_GAP = 8;
export const IGNORE_BTN_HEIGHT = 22;
export const IGNORE_COOLDOWN_TIME = 2.0; // 忽略後冷卻 2 秒才允許靠攏自動彈出

interface CardView {
  container: Container;
  bgGraphics: Graphics;
  iconContainer: Container;
  barrelGraphics: Graphics;
  bodyGraphics: Graphics;
  nameText: Text;
  classId: TankClassId;
  bounds: { x: number; y: number; w: number; h: number };
  isHovered: boolean;
}

/**
 * 轉職卡牌面板 (EvolutionPanel)
 * 原版 diep.io 風格：多色卡片背景、動態旋轉坦克圖標、滑鼠懸停縮放微調、
 * 下方「Ignore」灰色長條按鈕與滑鼠再次靠近自動喚回機制。
 */
export class EvolutionPanel {
  public readonly container = new Container();
  public visible = false;

  private readonly eventBus: EventBus;
  private readonly cardsContainer = new Container();
  private readonly ignoreContainer = new Container();
  private readonly ignoreBg = new Graphics();
  private readonly ignoreText: Text;

  private cards: CardView[] = [];
  private currentCandidates: TankClassId[] = [];

  private currentScale = 1.0;
  private screenX = 0;
  private screenY = 0;
  private panelWidth = 0;
  private panelHeight = 0;

  public isIgnored = false;
  private ignoreCooldown = 0;
  private ignoreBounds = { x: 0, y: 0, w: 0, h: 0 };
  private isIgnoreHovered = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container.visible = false;

    this.container.addChild(this.cardsContainer);
    this.container.addChild(this.ignoreContainer);

    this.ignoreContainer.addChild(this.ignoreBg);

    const ignoreTextStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    });

    this.ignoreText = new Text({
      text: 'Ignore',
      style: ignoreTextStyle,
    });
    this.ignoreText.anchor.set(0.5, 0.5);
    this.ignoreContainer.addChild(this.ignoreText);

    // 監聽轉職成功後自動關閉
    this.eventBus.onClassChanged(() => {
      this.hide();
      this.isIgnored = false;
      this.currentCandidates = [];
    });
  }

  /**
   * 展開轉職卡牌面板
   */
  public show(candidates: TankClassId[]): void {
    if (!candidates || candidates.length === 0) return;
    this.currentCandidates = candidates;
    this.isIgnored = false;
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
   * 點擊 Ignore 按鈕暫時收合面板，進入短暫冷卻
   */
  public ignore(): void {
    this.isIgnored = true;
    this.container.visible = false;
    this.ignoreCooldown = IGNORE_COOLDOWN_TIME;
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
    if (this.currentCandidates.length > 0) {
      this.rebuildCards();
    }
  }

  /**
   * 每個渲染幀更新（平滑旋轉坦克圖標與冷卻計時）
   * @param dtSeconds 幀間隔秒數
   */
  public update(dtSeconds: number): void {
    if (this.ignoreCooldown > 0) {
      this.ignoreCooldown -= dtSeconds;
      if (this.ignoreCooldown < 0) this.ignoreCooldown = 0;
    }

    if (!this.visible || this.isIgnored || !this.container.visible) return;

    // 平滑自轉迷你坦克圖標（零配置更新 rotation 數值）
    const count = this.cards.length;
    for (let i = 0; i < count; i++) {
      this.cards[i].iconContainer.rotation += 1.2 * dtSeconds;
    }
  }

  /**
   * 重繪所有候選卡牌與 Ignore 按鈕
   */
  private rebuildCards(): void {
    // 清理舊卡牌顯示物件
    this.cardsContainer.removeChildren();
    this.cards = [];

    const candidates = this.currentCandidates;
    const count = candidates.length;
    if (count === 0) return;

    const cardSize = CARD_SIZE;
    const gap = CARD_GAP;
    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);

    const cardsAreaWidth = cols * cardSize + (cols - 1) * gap;
    const cardsAreaHeight = rows * cardSize + (rows - 1) * gap;

    const nameTextStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x222222, width: 2 },
      align: 'center',
    });

    for (let i = 0; i < count; i++) {
      const classId = candidates[i];
      const def = TANKS_CONFIG[classId] ?? TANKS_CONFIG.basic;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const localX = col * (cardSize + gap);
      const localY = row * (cardSize + gap);

      const cardContainer = new Container();
      cardContainer.position.set(
        localX + cardSize * 0.5,
        localY + cardSize * 0.5,
      );
      cardContainer.pivot.set(cardSize * 0.5, cardSize * 0.5);

      const bg = new Graphics();
      cardContainer.addChild(bg);

      // 動態旋轉圖標容器
      const iconContainer = new Container();
      iconContainer.position.set(cardSize * 0.5, cardSize * 0.42);
      cardContainer.addChild(iconContainer);

      const barrelGraphics = new Graphics();
      const bodyGraphics = new Graphics();
      iconContainer.addChild(barrelGraphics);
      iconContainer.addChild(bodyGraphics);

      // 繪製卡牌圖標
      this.drawTankIcon(barrelGraphics, bodyGraphics, def);

      // 職業文字
      const nameText = new Text({
        text: def.name,
        style: nameTextStyle,
      });
      nameText.anchor.set(0.5, 1);
      nameText.position.set(cardSize * 0.5, cardSize - 4);
      cardContainer.addChild(nameText);

      this.cardsContainer.addChild(cardContainer);

      const cardView: CardView = {
        container: cardContainer,
        bgGraphics: bg,
        iconContainer,
        barrelGraphics,
        bodyGraphics,
        nameText,
        classId,
        bounds: { x: localX, y: localY, w: cardSize, h: cardSize },
        isHovered: false,
      };

      this.redrawCardBackground(cardView, false);
      this.cards.push(cardView);
    }

    // 佈置下方 Ignore 灰色按鈕
    const btnY = cardsAreaHeight + gap;
    const btnW = cardsAreaWidth;
    const btnH = IGNORE_BTN_HEIGHT;

    this.ignoreContainer.position.set(0, btnY);
    this.ignoreBounds = { x: 0, y: btnY, w: btnW, h: btnH };
    this.redrawIgnoreButton(false);
    this.ignoreText.position.set(btnW * 0.5, btnH * 0.5);

    this.panelWidth = cardsAreaWidth;
    this.panelHeight = btnY + btnH;
  }

  /**
   * 重繪卡牌背景（多色底板 + 圓角描邊）
   */
  private redrawCardBackground(card: CardView, isHovered: boolean): void {
    const def = TANKS_CONFIG[card.classId] ?? TANKS_CONFIG.basic;
    const baseColor = def.cardColor ?? 0x00b2e1;
    const cardSize = CARD_SIZE;

    card.bgGraphics.clear();
    card.bgGraphics
      .roundRect(0, 0, cardSize, cardSize, 6)
      .fill({ color: baseColor, alpha: isHovered ? 0.95 : 0.85 })
      .stroke({
        color: isHovered ? 0xffffff : COLOR_STROKE,
        width: isHovered ? 2.5 : 2,
      });
  }

  /**
   * 重繪 Ignore 灰色長條按鈕
   */
  private redrawIgnoreButton(isHovered: boolean): void {
    const w = this.ignoreBounds.w;
    const h = this.ignoreBounds.h;
    if (w <= 0 || h <= 0) return;

    this.ignoreBg.clear();
    this.ignoreBg
      .roundRect(0, 0, w, h, 4)
      .fill({ color: isHovered ? 0x777777 : 0x555555, alpha: 0.9 })
      .stroke({
        color: isHovered ? 0x999999 : 0x333333,
        width: 1.5,
      });
  }

  /**
   * 繪製置於卡牌內之微縮坦克圖標幾何（底盤置中於 0, 0）
   */
  private drawTankIcon(
    barrelG: Graphics,
    bodyG: Graphics,
    def: TankDefinition,
  ): void {
    barrelG.clear();
    bodyG.clear();

    const iconScale = 0.45;
    const barrels = def.barrels;

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
        x0 * cos - y0 * sin + ox,
        x0 * sin + y0 * cos + oy,
        x1 * cos - y1 * sin + ox,
        x1 * sin + y1 * cos + oy,
        x2 * cos - y2 * sin + ox,
        x2 * sin + y2 * cos + oy,
        x3 * cos - y3 * sin + ox,
        x3 * sin + y3 * cos + oy,
      ];

      barrelG
        .poly(pts)
        .fill({ color: COLOR_BARREL_GRAY })
        .stroke({ color: COLOR_STROKE, width: 1.5 });
    }

    const r = def.bodyRadius * iconScale;
    bodyG
      .circle(0, 0, r)
      .fill({ color: COLOR_TANK_BLUE })
      .stroke({ color: COLOR_STROKE, width: 1.5 });
  }

  /**
   * 檢查螢幕座標是否落在面板互動範圍內（阻斷射擊）
   */
  public containsPoint(screenX: number, screenY: number): boolean {
    if (!this.visible || this.isIgnored || !this.container.visible)
      return false;
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
   * 滑鼠移動事件處理（懸停微縮放與忽略後靠近自動彈出）
   */
  public handlePointerMove(screenX: number, screenY: number): void {
    const s = this.currentScale;

    // 1. 若處於 Ignore 狀態且冷卻時間已過，滑鼠靠近左上角觸發區時自動重新彈出
    if (this.isIgnored && this.currentCandidates.length > 0) {
      if (this.ignoreCooldown <= 0) {
        const triggerW = Math.max(this.panelWidth * s + 60, 200);
        const triggerH = Math.max(this.panelHeight * s + 60, 200);
        if (
          screenX >= 0 &&
          screenX <= triggerW &&
          screenY >= 0 &&
          screenY <= triggerH
        ) {
          this.isIgnored = false;
          this.container.visible = true;
          this.visible = true;
        }
      }
      return;
    }

    if (!this.visible || !this.container.visible) return;

    const localX = (screenX - this.screenX) / s;
    const localY = (screenY - this.screenY) / s;

    // 2. 檢測卡牌懸停 (Hover) 效果
    const cardCount = this.cards.length;
    for (let i = 0; i < cardCount; i++) {
      const card = this.cards[i];
      const b = card.bounds;
      const inside =
        localX >= b.x &&
        localX <= b.x + b.w &&
        localY >= b.y &&
        localY <= b.y + b.h;

      if (inside !== card.isHovered) {
        card.isHovered = inside;
        this.redrawCardBackground(card, inside);
        card.container.scale.set(inside ? 1.05 : 1.0, inside ? 1.05 : 1.0);
      }
    }

    // 3. 檢測 Ignore 按鈕懸停
    const ib = this.ignoreBounds;
    const ignoreInside =
      localX >= ib.x &&
      localX <= ib.x + ib.w &&
      localY >= ib.y &&
      localY <= ib.y + ib.h;

    if (ignoreInside !== this.isIgnoreHovered) {
      this.isIgnoreHovered = ignoreInside;
      this.redrawIgnoreButton(ignoreInside);
    }
  }

  /**
   * 處理點擊事件（點擊卡牌派發轉職，點擊 Ignore 暫時隱藏）
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible || this.isIgnored || !this.container.visible)
      return false;
    const s = this.currentScale;
    const localX = (screenX - this.screenX) / s;
    const localY = (screenY - this.screenY) / s;

    // 1. 檢查是否點擊在 Ignore 按鈕上
    const ib = this.ignoreBounds;
    if (
      localX >= ib.x &&
      localX <= ib.x + ib.w &&
      localY >= ib.y &&
      localY <= ib.y + ib.h
    ) {
      this.ignore();
      return true;
    }

    // 2. 檢查是否點擊在轉職卡牌上
    const cardCount = this.cards.length;
    for (let i = 0; i < cardCount; i++) {
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

    return true; // 即使沒點在按鈕上也阻斷射擊穿透
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
