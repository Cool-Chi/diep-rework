import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLOR_BORDER_LINE } from '../config/constants';
import type { Tank } from '../entities/Tank';
import { BASE_MARGIN } from './layout';

export const LEADERBOARD_WIDTH = 190;
export const ROW_HEIGHT = 16;
export const MAX_LEADERBOARD_ROWS = 10;

interface LeaderboardRow {
  container: Container;
  barGraphics: Graphics;
  nameText: Text;
  scoreText: Text;
}

/**
 * 原版 diep.io 風格排行榜 (Leaderboard)
 * 位於畫布右上角，即時展示全場得分前 10 名坦克名單與橫向進度條，
 * 玩家若在榜內以專屬高亮藍色區分，未進前 10 則於底端呈現自身排名。
 */
export class Leaderboard {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly titleText: Text;
  private readonly rows: LeaderboardRow[] = [];
  private readonly extraRow: LeaderboardRow; // 玩家未進前 10 時之底部額外列

  private screenX = 0;
  private screenY = 0;

  // 預配暫存陣列，供快速零 GC 排序使用
  private readonly sortedTanks: Tank[] = [];

  constructor() {
    this.container.addChild(this.bgGraphics);

    const resolution =
      typeof window !== 'undefined'
        ? Math.max(2, window.devicePixelRatio || 1)
        : 2;

    const titleStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x111111, width: 2.5 },
      align: 'center',
    });

    this.titleText = new Text({
      text: 'Leaderboard',
      style: titleStyle,
    });
    this.titleText.resolution = resolution;
    this.titleText.anchor.set(0.5, 0);
    this.container.addChild(this.titleText);

    const rowNameStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x111111, width: 2 },
    });

    const rowScoreStyle = new TextStyle({
      fontFamily: 'Ubuntu, "Lucida Console", monospace, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x111111, width: 2 },
    });

    // 建立前 10 名行
    for (let i = 0; i < MAX_LEADERBOARD_ROWS; i++) {
      const rowContainer = new Container();
      const bar = new Graphics();
      rowContainer.addChild(bar);

      const name = new Text({ text: '', style: rowNameStyle });
      name.resolution = resolution;
      name.anchor.set(0, 0.5);
      rowContainer.addChild(name);

      const score = new Text({ text: '', style: rowScoreStyle });
      score.resolution = resolution;
      score.anchor.set(1, 0.5);
      rowContainer.addChild(score);

      rowContainer.visible = false;
      this.container.addChild(rowContainer);

      this.rows.push({
        container: rowContainer,
        barGraphics: bar,
        nameText: name,
        scoreText: score,
      });
    }

    // 建立額外列 (玩家未進前 10 時呈現)
    const extraContainer = new Container();
    const extraBar = new Graphics();
    extraContainer.addChild(extraBar);

    const extraName = new Text({ text: '', style: rowNameStyle });
    extraName.resolution = resolution;
    extraName.anchor.set(0, 0.5);
    extraContainer.addChild(extraName);

    const extraScore = new Text({ text: '', style: rowScoreStyle });
    extraScore.resolution = resolution;
    extraScore.anchor.set(1, 0.5);
    extraContainer.addChild(extraScore);

    extraContainer.visible = false;
    this.container.addChild(extraContainer);

    this.extraRow = {
      container: extraContainer,
      barGraphics: extraBar,
      nameText: extraName,
      scoreText: extraScore,
    };
  }

  /**
   * 螢幕大小變動時重新定位右上角
   */
  public resize(
    screenWidth: number,
    _screenHeight: number,
    scale: number,
  ): void {
    const margin = BASE_MARGIN * scale;
    const w = LEADERBOARD_WIDTH * scale;
    this.screenX = screenWidth - w - margin;
    this.screenY = margin;

    this.container.position.set(this.screenX, this.screenY);
    this.container.scale.set(scale, scale);

    this.titleText.position.set(LEADERBOARD_WIDTH * 0.5, 4);
  }

  /**
   * 每渲染幀更新排行榜名次與分數長條
   */
  public update(playerTank: Tank, allTanks: Tank[]): void {
    // 1. 收集所有活動中坦克並排序
    this.sortedTanks.length = 0;
    const len = allTanks.length;
    for (let i = 0; i < len; i++) {
      if (allTanks[i].active) {
        this.sortedTanks.push(allTanks[i]);
      }
    }

    // 依分數從高到低降序排列
    this.sortedTanks.sort((a, b) => b.score - a.score);

    const totalActive = this.sortedTanks.length;
    if (totalActive === 0) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    const topScore = Math.max(1, this.sortedTanks[0].score);
    const displayCount = Math.min(MAX_LEADERBOARD_ROWS, totalActive);

    const startY = 22;
    const width = LEADERBOARD_WIDTH;
    const barMaxWidth = width - 8;

    let playerRank = -1;

    // 2. 更新前 10 名
    for (let i = 0; i < MAX_LEADERBOARD_ROWS; i++) {
      const row = this.rows[i];
      if (i < displayCount) {
        const tank = this.sortedTanks[i];
        if (tank.id === playerTank.id) {
          playerRank = i + 1;
        }

        const isPlayer = tank.id === playerTank.id;
        const rowY = startY + i * ROW_HEIGHT;
        row.container.position.set(4, rowY);

        // 分數長條比例
        const ratio = Math.max(0.04, Math.min(1.0, tank.score / topScore));
        const barW = barMaxWidth * ratio;

        row.barGraphics.clear();
        row.barGraphics
          .roundRect(0, 1, barW, ROW_HEIGHT - 2, 3)
          .fill({ color: isPlayer ? 0x00b2e1 : 0x00e16e, alpha: 0.85 });

        // 文字標記
        row.nameText.text = `${i + 1}. ${tank.name}`;
        row.nameText.position.set(4, ROW_HEIGHT * 0.5);

        row.scoreText.text = this.formatScore(tank.score);
        row.scoreText.position.set(barMaxWidth - 2, ROW_HEIGHT * 0.5);

        row.container.visible = true;
      } else {
        row.container.visible = false;
      }
    }

    // 3. 檢查玩家是否在未進前 10 的額外列呈現
    let totalHeight = startY + displayCount * ROW_HEIGHT + 4;

    if (playerRank === -1 && playerTank.active) {
      // 搜尋玩家實際名次
      for (let i = displayCount; i < totalActive; i++) {
        if (this.sortedTanks[i].id === playerTank.id) {
          playerRank = i + 1;
          break;
        }
      }

      const extraY = totalHeight + 2;
      this.extraRow.container.position.set(4, extraY);

      const ratio = Math.max(0.04, Math.min(1.0, playerTank.score / topScore));
      const barW = barMaxWidth * ratio;

      this.extraRow.barGraphics.clear();
      this.extraRow.barGraphics
        .roundRect(0, 1, barW, ROW_HEIGHT - 2, 3)
        .fill({ color: 0x00b2e1, alpha: 0.85 });

      this.extraRow.nameText.text = `${playerRank > 0 ? playerRank : '-'}. ${playerTank.name}`;
      this.extraRow.nameText.position.set(4, ROW_HEIGHT * 0.5);

      this.extraRow.scoreText.text = this.formatScore(playerTank.score);
      this.extraRow.scoreText.position.set(barMaxWidth - 2, ROW_HEIGHT * 0.5);

      this.extraRow.container.visible = true;
      totalHeight += ROW_HEIGHT + 4;
    } else {
      this.extraRow.container.visible = false;
    }

    // 4. 重繪整體半透明暗黑背景框
    this.bgGraphics.clear();
    this.bgGraphics
      .roundRect(0, 0, width, totalHeight, 6)
      .fill({ color: 0x111111, alpha: 0.5 })
      .stroke({ color: COLOR_BORDER_LINE, width: 1.5 });
  }

  /**
   * 數值格式化 (如 12500 -> 12.5k)
   */
  private formatScore(score: number): string {
    if (score >= 1000000) {
      return `${(score / 1000000).toFixed(1)}m`;
    }
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}k`;
    }
    return score.toString();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
