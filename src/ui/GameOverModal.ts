import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export interface GameOverStats {
  killerName: string;
  finalScore: number;
  finalLevel: number;
  finalClass: string;
  survivalSeconds: number;
  tanksKilled: number;
}

/**
 * 死亡結算面板 (GameOverModal)
 * All-in-Canvas UI，掛載於 HUDContainer，提供平滑彈出動畫、詳細戰績統計與一鍵重生按鈕。
 */
export class GameOverModal {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly cardGraphics = new Graphics();
  private readonly buttonGraphics = new Graphics();

  private titleText!: Text;
  private killerText!: Text;
  private statsText!: Text;
  private buttonText!: Text;

  private onRespawnCallback?: () => void;
  private isHovered = false;

  private cardWidth = 420;
  private cardHeight = 340;
  private buttonWidth = 220;
  private buttonHeight = 46;

  private currentScale = 1.0;
  private screenW = 800;
  private screenH = 600;

  // 動畫計時與狀態
  private animationProgress = 0;
  private isAnimating = false;

  constructor(onRespawn?: () => void) {
    this.onRespawnCallback = onRespawn;
    this.container.visible = false;

    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.cardGraphics);

    this.initTexts();
    this.initButton();
  }

  private initTexts(): void {
    const titleStyle = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fill: 0xff4747,
      align: 'center',
    });
    this.titleText = new Text({ text: 'GAME OVER', style: titleStyle });
    this.titleText.anchor.set(0.5, 0.5);

    const killerStyle = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 16,
      fill: 0xd0d8e2,
      align: 'center',
    });
    this.killerText = new Text({ text: '', style: killerStyle });
    this.killerText.anchor.set(0.5, 0.5);

    const statsStyle = new TextStyle({
      fontFamily: 'Consolas, monospace',
      fontSize: 15,
      lineHeight: 24,
      fill: 0xffffff,
      align: 'left',
    });
    this.statsText = new Text({ text: '', style: statsStyle });
    this.statsText.anchor.set(0.5, 0);

    this.container.addChild(this.titleText);
    this.container.addChild(this.killerText);
    this.container.addChild(this.statsText);
  }

  private initButton(): void {
    const btnStyle = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 17,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    this.buttonText = new Text({ text: 'Continue (Enter)', style: btnStyle });
    this.buttonText.anchor.set(0.5, 0.5);

    this.buttonGraphics.eventMode = 'static';
    this.buttonGraphics.cursor = 'pointer';

    this.buttonGraphics.on('pointerover', () => {
      this.isHovered = true;
      this.drawCardAndButton();
    });

    this.buttonGraphics.on('pointerout', () => {
      this.isHovered = false;
      this.drawCardAndButton();
    });

    this.buttonGraphics.on('pointertap', () => {
      this.triggerRespawn();
    });

    this.container.addChild(this.buttonGraphics);
    this.container.addChild(this.buttonText);
  }

  /**
   * 彈出死亡結算畫面並填入數據
   */
  public show(stats: GameOverStats): void {
    const mins = Math.floor(stats.survivalSeconds / 60);
    const secs = Math.floor(stats.survivalSeconds % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.killerText.text = `Killed by ${stats.killerName}`;
    this.statsText.text =
      `Final Score:  ${stats.finalScore.toLocaleString()}\n` +
      `Level / Tank: Lv ${stats.finalLevel} ${stats.finalClass}\n` +
      `Time Alive:   ${timeStr}\n` +
      `Tanks Killed: ${stats.tanksKilled}`;

    this.animationProgress = 0;
    this.isAnimating = true;
    this.container.visible = true;
    this.container.alpha = 0;

    this.resize(this.screenW, this.screenH, this.currentScale);
  }

  public hide(): void {
    this.container.visible = false;
    this.isAnimating = false;
  }

  public get visible(): boolean {
    return this.container.visible;
  }

  /**
   * 觸發玩家重生回呼
   */
  public triggerRespawn(): void {
    if (!this.container.visible) return;
    this.hide();
    this.onRespawnCallback?.();
  }

  /**
   * 每個渲染幀更新平滑彈出動畫
   */
  public update(dtSeconds: number): void {
    if (!this.isAnimating) return;

    this.animationProgress = Math.min(
      1.0,
      this.animationProgress + dtSeconds * 3.5,
    );
    // Ease-Out Cubic: 1 - (1 - t)^3
    const t = 1 - (1 - this.animationProgress) ** 3;

    this.container.alpha = t;
    const scaleFactor = 0.92 + 0.08 * t;
    this.container.scale.set(this.currentScale * scaleFactor);

    if (this.animationProgress >= 1.0) {
      this.isAnimating = false;
      this.container.scale.set(this.currentScale);
    }
  }

  /**
   * 重新計算畫面排版
   */
  public resize(
    screenWidth: number,
    screenHeight: number,
    scale: number,
  ): void {
    this.screenW = screenWidth;
    this.screenH = screenHeight;
    this.currentScale = scale;

    if (!this.isAnimating) {
      this.container.scale.set(scale);
    }

    const cx = (screenWidth * 0.5) / scale;
    const cy = (screenHeight * 0.5) / scale;

    // 半透明全螢幕暗角底色
    this.bgGraphics.clear();
    this.bgGraphics.rect(
      -cx * scale,
      -cy * scale,
      (screenWidth / scale) * 2,
      (screenHeight / scale) * 2,
    );
    this.bgGraphics.fill({ color: 0x050810, alpha: 0.72 });

    this.drawCardAndButton();

    this.titleText.position.set(cx, cy - this.cardHeight * 0.5 + 44);
    this.killerText.position.set(cx, cy - this.cardHeight * 0.5 + 80);
    this.statsText.position.set(cx, cy - this.cardHeight * 0.5 + 115);

    const btnY = cy + this.cardHeight * 0.5 - 46;
    this.buttonText.position.set(cx, btnY);
  }

  private drawCardAndButton(): void {
    const cx = (this.screenW * 0.5) / this.currentScale;
    const cy = (this.screenH * 0.5) / this.currentScale;

    const left = cx - this.cardWidth * 0.5;
    const top = cy - this.cardHeight * 0.5;

    // 核心卡片容器
    this.cardGraphics.clear();
    this.cardGraphics.roundRect(left, top, this.cardWidth, this.cardHeight, 14);
    this.cardGraphics.fill({ color: 0x111923, alpha: 0.95 });
    this.cardGraphics.stroke({ width: 2, color: 0x2b3848 });

    // 內部數據底框
    this.cardGraphics.roundRect(
      left + 24,
      top + 105,
      this.cardWidth - 48,
      115,
      8,
    );
    this.cardGraphics.fill({ color: 0x0a1017, alpha: 0.8 });

    // 重新開始按鈕
    const btnLeft = cx - this.buttonWidth * 0.5;
    const btnTop = cy + this.cardHeight * 0.5 - 68;

    this.buttonGraphics.clear();
    this.buttonGraphics.roundRect(
      btnLeft,
      btnTop,
      this.buttonWidth,
      this.buttonHeight,
      8,
    );
    const btnColor = this.isHovered ? 0x00d27a : 0x00b166;
    this.buttonGraphics.fill({ color: btnColor });
    this.buttonGraphics.stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
  }

  /**
   * 判斷螢幕點擊是否落在結算面板上
   */
  public containsPoint(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    const cx = this.screenW * 0.5;
    const cy = this.screenH * 0.5;
    const halfW = this.cardWidth * 0.5 * this.currentScale;
    const halfH = this.cardHeight * 0.5 * this.currentScale;

    return (
      screenX >= cx - halfW &&
      screenX <= cx + halfW &&
      screenY >= cy - halfH &&
      screenY <= cy + halfH
    );
  }
}
