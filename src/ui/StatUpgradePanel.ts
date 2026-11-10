import { Container, Graphics, Text } from 'pixi.js';
import { MAX_STAT_POINTS, TOTAL_STATS } from '../config/stats.config';
import type { EventBus } from '../core/EventBus';
import type { Tank } from '../entities/Tank';
import {
  STAT_COLORS,
  STAT_NAMES,
  STAT_SHORTCUTS,
  UI_COLOR_PANEL_BG,
  UI_COLOR_PLUS_BTN,
  UI_COLOR_SEGMENT_BORDER,
  UI_COLOR_SEGMENT_EMPTY,
  UI_COLOR_TEXT_WHITE,
  UI_COLOR_TEXT_YELLOW,
  UI_PANEL_ALPHA,
} from './labels';
import {
  BASE_MARGIN,
  BASE_STAT_PANEL_HEIGHT,
  BASE_STAT_PANEL_WIDTH,
} from './layout';

interface RowElements {
  container: Container;
  bgGraphics: Graphics;
  segmentsGraphics: Graphics;
  plusBtnGraphics: Graphics;
  label: Text;
  plusText: Text;
}

/**
 * 左下角 8 項屬性加點升級面板 (StatUpgradePanel)
 * 遵循 All-in-Canvas UI 與 Zero-Allocation 規範
 * 僅在數值變動時更新顯示，不每幀重新繪製
 */
export class StatUpgradePanel {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly pointsText: Text;
  private readonly rows: RowElements[] = [];

  // 快取狀態，用於避免不必要的重複更新
  private lastStatPoints = -1;
  private readonly lastStatLevels = new Int8Array(TOTAL_STATS).fill(-1);

  // 當前縮放後的螢幕 AABB 邊界 (供 isOverUi 與點擊命中檢測，零配置)
  public screenX = 0;
  public screenY = 0;
  public screenWidth = 0;
  public screenHeight = 0;
  private currentScale = 1.0;

  constructor(private readonly eventBus: EventBus) {
    // 1. 半透明黑色底板
    this.container.addChild(this.bgGraphics);

    // 2. 頂部未花費點數標題 (如 "x 4")
    this.pointsText = new Text({
      text: '',
      style: {
        fontFamily: 'Consolas, monospace, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: UI_COLOR_TEXT_YELLOW,
      },
    });
    this.pointsText.position.set(10, 6);
    this.container.addChild(this.pointsText);

    // 3. 建立 8 條屬性列元件
    const startY = 28;
    const rowHeight = 21;
    const rowGap = 3;

    for (let i = 0; i < TOTAL_STATS; i++) {
      const rowContainer = new Container();
      rowContainer.position.set(8, startY + i * (rowHeight + rowGap));

      // 槽位底色
      const bgG = new Graphics();
      rowContainer.addChild(bgG);

      // 7 段屬性長條
      const segG = new Graphics();
      rowContainer.addChild(segG);

      // + 按鈕底色
      const plusG = new Graphics();
      rowContainer.addChild(plusG);

      // 屬性文字 "[1] Health Regen"
      const label = new Text({
        text: `${STAT_SHORTCUTS[i]} ${STAT_NAMES[i]}`,
        style: {
          fontFamily: 'Consolas, monospace, sans-serif',
          fontSize: 10.5,
          fontWeight: 'bold',
          fill: UI_COLOR_TEXT_WHITE,
        },
      });
      label.position.set(4, 3.5);
      rowContainer.addChild(label);

      // + 按鈕符號
      const plusText = new Text({
        text: '+',
        style: {
          fontFamily: 'Consolas, monospace, sans-serif',
          fontSize: 13,
          fontWeight: 'bold',
          fill: UI_COLOR_TEXT_WHITE,
        },
      });
      plusText.position.set(178, 2);
      rowContainer.addChild(plusText);

      this.rows.push({
        container: rowContainer,
        bgGraphics: bgG,
        segmentsGraphics: segG,
        plusBtnGraphics: plusG,
        label,
        plusText,
      });

      this.container.addChild(rowContainer);
    }

    this.container.visible = false;
  }

  /**
   * 重新計算面板佈局座標與大小 (Resize 時呼叫)
   */
  public resize(
    _screenWidth: number,
    screenHeight: number,
    scale: number,
  ): void {
    this.currentScale = scale;
    const margin = BASE_MARGIN * scale;
    const w = BASE_STAT_PANEL_WIDTH * scale;
    const h = BASE_STAT_PANEL_HEIGHT * scale;

    this.screenX = margin;
    this.screenY = screenHeight - h - margin;
    this.screenWidth = w;
    this.screenHeight = h;

    this.container.position.set(this.screenX, this.screenY);
    this.container.scale.set(scale, scale);

    // 重繪面板背景矩形 (邏輯寬高)
    this.bgGraphics.clear();
    this.bgGraphics
      .roundRect(0, 0, BASE_STAT_PANEL_WIDTH, BASE_STAT_PANEL_HEIGHT, 6)
      .fill({ color: UI_COLOR_PANEL_BG, alpha: UI_PANEL_ALPHA });
  }

  /**
   * 每幀或數值變動時更新顯示狀態
   * 遵守 Zero-GC 規範：僅在數值變更時重繪紋理與文字
   */
  public update(tank: Tank): void {
    const points = tank.statPoints;
    const hasPoints = points > 0;

    // 檢查是否有任何狀態改變
    let changed = false;
    if (this.lastStatPoints !== points) {
      this.lastStatPoints = points;
      changed = true;
    }

    for (let i = 0; i < TOTAL_STATS; i++) {
      if (this.lastStatLevels[i] !== tank.statLevels[i]) {
        this.lastStatLevels[i] = tank.statLevels[i];
        changed = true;
      }
    }

    // 當有剩餘技能點時顯示面板，點數為 0 時隱藏
    this.container.visible = hasPoints;
    if (!hasPoints) return;

    if (changed) {
      // 1. 更新點數標題 "x N"
      this.pointsText.text = `x ${points}`;

      // 2. 更新 8 列進度條與按鈕
      for (let i = 0; i < TOTAL_STATS; i++) {
        const row = this.rows[i];
        const lvl = tank.statLevels[i];
        const canUpgrade = hasPoints && lvl < MAX_STAT_POINTS;

        // 重繪進度長條 (寬度 168px，分 7 格)
        const barWidth = 168;
        const barHeight = 18;
        const segWidth = barWidth / MAX_STAT_POINTS;

        row.bgGraphics.clear();
        row.bgGraphics
          .rect(0, 0, barWidth, barHeight)
          .fill({ color: UI_COLOR_SEGMENT_EMPTY, alpha: 0.8 })
          .stroke({ color: UI_COLOR_SEGMENT_BORDER, width: 1.5 });

        row.segmentsGraphics.clear();
        for (let s = 0; s < lvl; s++) {
          row.segmentsGraphics
            .rect(s * segWidth, 0, segWidth, barHeight)
            .fill({ color: STAT_COLORS[i] })
            .stroke({ color: UI_COLOR_SEGMENT_BORDER, width: 1 });
        }

        // + 按鈕顯示狀態 (x: 172, 寬 18, 高 18)
        row.plusBtnGraphics.clear();
        if (canUpgrade) {
          row.plusBtnGraphics
            .roundRect(172, 0, 18, 18, 3)
            .fill({ color: UI_COLOR_PLUS_BTN })
            .stroke({ color: 0x111111, width: 1 });
          row.plusText.visible = true;
        } else {
          row.plusText.visible = false;
        }
      }
    }
  }

  /**
   * 檢查螢幕座標是否落在屬性面板範圍內 (供 isOverUi 使用)
   */
  public containsPoint(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    return (
      screenX >= this.screenX &&
      screenX <= this.screenX + this.screenWidth &&
      screenY >= this.screenY &&
      screenY <= this.screenY + this.screenHeight
    );
  }

  /**
   * 檢查螢幕座標是否點擊了某個屬性的 [+] 按鈕
   * @returns 點擊的屬性索引 (0 ~ 7) 或 null
   */
  public hitTestPlusButton(screenX: number, screenY: number): number | null {
    if (!this.container.visible || this.lastStatPoints <= 0) return null;

    // 轉為面板局部座標 (除以 scale)
    const localX = (screenX - this.screenX) / this.currentScale;
    const localY = (screenY - this.screenY) / this.currentScale;

    // + 按鈕 X 範圍：172 ~ 190
    if (localX < 172 || localX > 190) return null;

    const startY = 28;
    const rowHeight = 21;
    const rowGap = 3;

    for (let i = 0; i < TOTAL_STATS; i++) {
      const rowY = startY + i * (rowHeight + rowGap);
      if (localY >= rowY && localY <= rowY + 18) {
        if (this.lastStatLevels[i] < MAX_STAT_POINTS) {
          return i;
        }
      }
    }

    return null;
  }

  /**
   * 處理 Canvas 點擊
   * 若點擊中 [+] 按鈕，發送升級事件
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    const hitIdx = this.hitTestPlusButton(screenX, screenY);
    if (hitIdx !== null) {
      this.eventBus.emitStatUpgradeRequested(hitIdx);
      return true;
    }
    return this.containsPoint(screenX, screenY);
  }
}
