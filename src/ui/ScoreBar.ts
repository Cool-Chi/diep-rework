import { Container, Graphics, Text } from 'pixi.js';
import type { Tank } from '../entities/Tank';
import { scoreProgress } from './hudMath';
import {
  BASE_MARGIN,
  BASE_SCORE_BAR_HEIGHT,
  BASE_SCORE_BAR_WIDTH,
} from './layout';

/**
 * 畫面底部置中經驗分數列 (ScoreBar)
 * 顯示坦克等級、當前分數與邁向下一級之平滑進度條 (Lv 30 顯示為滿格)
 * 進度條採用與幀率無關的指數平滑插值，絕不干擾物理模擬數值
 */
export class ScoreBar {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly fillGraphics = new Graphics();
  private readonly levelText: Text;
  private readonly scoreText: Text;

  private targetProgress = 0.0;
  private displayedProgress = 0.0;
  private lastLevel = -1;
  private lastScore = -1;

  public screenX = 0;
  public screenY = 0;
  public screenWidth = 0;
  public screenHeight = 0;

  constructor() {
    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.fillGraphics);

    // 等級文字 (左側)
    this.levelText = new Text({
      text: 'Lvl 1',
      style: {
        fontFamily: 'Consolas, monospace, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    this.levelText.position.set(8, 3.5);
    this.container.addChild(this.levelText);

    // 分數文字 (居中)
    this.scoreText = new Text({
      text: 'Score: 0',
      style: {
        fontFamily: 'Consolas, monospace, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    this.scoreText.position.set(BASE_SCORE_BAR_WIDTH * 0.5 - 30, 3.5);
    this.container.addChild(this.scoreText);
  }

  /**
   * 重新計算螢幕置中佈局與縮放
   */
  public resize(
    screenWidth: number,
    screenHeight: number,
    scale: number,
  ): void {
    const w = BASE_SCORE_BAR_WIDTH * scale;
    const h = BASE_SCORE_BAR_HEIGHT * scale;
    const margin = BASE_MARGIN * scale;

    this.screenX = (screenWidth - w) * 0.5;
    this.screenY = screenHeight - h - margin;
    this.screenWidth = w;
    this.screenHeight = h;

    this.container.position.set(this.screenX, this.screenY);
    this.container.scale.set(scale, scale);

    // 重新繪製背景槽位 (深灰底色 + 黑色加厚描邊)
    this.bgGraphics.clear();
    this.bgGraphics
      .roundRect(0, 0, BASE_SCORE_BAR_WIDTH, BASE_SCORE_BAR_HEIGHT, 5)
      .fill({ color: 0x222222, alpha: 0.85 })
      .stroke({ color: 0x111111, width: 2 });
  }

  /**
   * 每個渲染幀更新顯示數值與平滑進度條
   * @param tank 玩家坦克實體
   * @param dtSeconds 距離上一幀之實際渲染秒數 (用於指數平滑)
   */
  public update(tank: Tank, dtSeconds: number): void {
    // 1. 若等級或分數改變，更新文字
    if (this.lastLevel !== tank.level || this.lastScore !== tank.score) {
      this.lastLevel = tank.level;
      this.lastScore = tank.score;

      this.levelText.text = `Lvl ${tank.level}`;
      this.scoreText.text = `Score: ${tank.score}`;
      // 微調置中 X 座標
      this.scoreText.x =
        BASE_SCORE_BAR_WIDTH * 0.5 - this.scoreText.width * 0.5;

      this.targetProgress = scoreProgress(tank.level, tank.score);
    }

    // 2. 指數平滑插值進度條寬度 (平滑係數 k = 14.0，手感細膩且無抖動)
    if (dtSeconds > 0) {
      const factor = 1 - Math.exp(-14.0 * dtSeconds);
      this.displayedProgress +=
        (this.targetProgress - this.displayedProgress) * factor;
    } else {
      this.displayedProgress = this.targetProgress;
    }

    // 防止微小浮點數漂移
    if (Math.abs(this.displayedProgress - this.targetProgress) < 0.0005) {
      this.displayedProgress = this.targetProgress;
    }

    // 3. 繪製填滿進度長條 (金色/黃綠色)
    this.fillGraphics.clear();
    const fillWidth = Math.max(
      0,
      BASE_SCORE_BAR_WIDTH * this.displayedProgress,
    );
    if (fillWidth > 2) {
      this.fillGraphics
        .roundRect(1, 1, fillWidth - 2, BASE_SCORE_BAR_HEIGHT - 2, 4)
        .fill({ color: 0xffe869 })
        .stroke({ color: 0xd9b32b, width: 1 });
    }
  }
}
