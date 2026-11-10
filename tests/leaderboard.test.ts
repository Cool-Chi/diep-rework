import { describe, expect, it } from 'vitest';
import { Tank } from '../src/entities/Tank';
import { LEADERBOARD_WIDTH, Leaderboard } from '../src/ui/Leaderboard';

describe('Milestone 5: Leaderboard (Top Tanks & Score Ranking)', () => {
  it('initializes leaderboard with 10 rows and positions correctly on resize', () => {
    const leaderboard = new Leaderboard();
    expect(leaderboard.container).toBeDefined();

    leaderboard.resize(1920, 1080, 1.0);
    // 右上角: 1920 - 190 - 16 = 1714
    expect(leaderboard.container.position.x).toBe(
      1920 - LEADERBOARD_WIDTH - 16,
    );
    expect(leaderboard.container.position.y).toBe(16);

    leaderboard.destroy();
  });

  it('sorts tanks by score in descending order and displays top 10', () => {
    const leaderboard = new Leaderboard();
    const player = new Tank(1, 100, 100);
    player.name = 'Hero';
    player.score = 5000;
    player.active = true;

    const tanks: Tank[] = [player];
    for (let i = 0; i < 15; i++) {
      const bot = new Tank(1000 + i, 200, 200);
      bot.name = `Bot_${i}`;
      bot.score = i * 1000; // 0, 1000, 2000, ..., 14000
      bot.active = true;
      tanks.push(bot);
    }

    leaderboard.update(player, tanks);

    expect(leaderboard.container.visible).toBe(true);

    leaderboard.destroy();
  });

  it('displays player in extraRow when player rank is outside top 10', () => {
    const leaderboard = new Leaderboard();
    const player = new Tank(1, 100, 100);
    player.name = 'NoobPlayer';
    player.score = 10; // 分數最低
    player.active = true;

    const tanks: Tank[] = [player];
    // 建立 12 隻高分 Bot
    for (let i = 0; i < 12; i++) {
      const bot = new Tank(1000 + i, 200, 200);
      bot.name = `ProBot_${i}`;
      bot.score = 2000 + i * 500;
      bot.active = true;
      tanks.push(bot);
    }

    leaderboard.update(player, tanks);

    // 玩家第 13 名 (超出前 10)，應啟用 extraRow
    const anyLb = leaderboard as unknown as {
      extraRow: { container: { visible: boolean }; nameText: { text: string } };
    };
    expect(anyLb.extraRow.container.visible).toBe(true);
    expect(anyLb.extraRow.nameText.text).toContain('13. NoobPlayer');

    leaderboard.destroy();
  });

  it('hides extraRow and highlights player when inside top 10', () => {
    const leaderboard = new Leaderboard();
    const player = new Tank(1, 100, 100);
    player.name = 'TopPlayer';
    player.score = 99999; // 第一名
    player.active = true;

    const tanks: Tank[] = [player];
    for (let i = 0; i < 5; i++) {
      const bot = new Tank(1000 + i, 200, 200);
      bot.name = `Bot_${i}`;
      bot.score = 1000;
      bot.active = true;
      tanks.push(bot);
    }

    leaderboard.update(player, tanks);

    const anyLb = leaderboard as unknown as {
      extraRow: { container: { visible: boolean } };
      rows: Array<{
        nameText: { text: string };
        container: { visible: boolean };
      }>;
    };
    // 玩家在第 1 名，不需要額外列
    expect(anyLb.extraRow.container.visible).toBe(false);
    expect(anyLb.rows[0].container.visible).toBe(true);
    expect(anyLb.rows[0].nameText.text).toContain('1. TopPlayer');

    leaderboard.destroy();
  });

  it('formats large scores with k and m suffixes', () => {
    const leaderboard = new Leaderboard();
    const anyLb = leaderboard as unknown as {
      formatScore: (s: number) => string;
    };

    expect(anyLb.formatScore(500)).toBe('500');
    expect(anyLb.formatScore(1250)).toBe('1.3k');
    expect(anyLb.formatScore(25000)).toBe('25.0k');
    expect(anyLb.formatScore(1500000)).toBe('1.5m');

    leaderboard.destroy();
  });
});
