import { describe, expect, it } from 'vitest';
import { COLOR_TANK_BLUE } from '../src/config/constants';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { FireSystem } from '../src/systems/FireSystem';

describe('Bullet Color Matching (M5)', () => {
  it('Bullet entity stores color initialized by init()', () => {
    const bullet = new Bullet();
    expect(bullet.color).toBe(COLOR_TANK_BLUE);

    const coralRed = 0xf14e54;
    bullet.init(0, 101, 100, 100, 10, 0, 8, 2, 7, 75, coralRed);
    expect(bullet.color).toBe(coralRed);
  });

  it('FireSystem fires bullets with exact color matching tank chassis', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 藍色玩家坦克開火
    const playerTank = new Tank(1, 100, 100);
    playerTank.color = 0x00b2e1;
    playerTank.input.shooting = true;
    playerTank.input.aimX = 200;
    playerTank.input.aimY = 100;

    fireSystem.updateTankFiring(playerTank, bulletPool);

    expect(bulletPool.getActiveCount()).toBe(1);
    // 找出剛獲取的子彈
    const playerBullet = bulletPool.items.find((b) => b.active);
    expect(playerBullet).toBeDefined();
    expect(playerBullet?.color).toBe(0x00b2e1);
    expect(playerBullet?.ownerId).toBe(playerTank.id);

    // 2. 綠色 AI 坦克開火
    const greenBot = new Tank(1002, 300, 300);
    greenBot.color = 0x00e16e;
    greenBot.input.shooting = true;
    greenBot.input.aimX = 400;
    greenBot.input.aimY = 300;

    fireSystem.updateTankFiring(greenBot, bulletPool);

    expect(bulletPool.getActiveCount()).toBe(2);
    const botBullet = bulletPool.items.find(
      (b) => b.active && b.ownerId === greenBot.id,
    );
    expect(botBullet).toBeDefined();
    expect(botBullet?.color).toBe(0x00e16e);
  });
});
