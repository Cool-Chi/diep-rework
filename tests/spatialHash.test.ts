import { describe, expect, it } from 'vitest';
import {
  decodeEntityIndex,
  decodeEntityType,
  ENTITY_TYPE_SHAPE,
  encodeEntityCode,
  SpatialHash,
} from '../src/physics/SpatialHash';

describe('SpatialHash', () => {
  it('編碼與解碼應精確無誤', () => {
    const code = encodeEntityCode(ENTITY_TYPE_SHAPE, 42);
    expect(decodeEntityType(code)).toBe(ENTITY_TYPE_SHAPE);
    expect(decodeEntityIndex(code)).toBe(42);
  });

  it('隨機圓形碰撞候選查詢結果必須對照暴力法 100% 涵蓋無遺漏', () => {
    const worldW = 1000;
    const worldH = 1000;
    const cellSize = 128;
    const maxCandidateR = 25;

    const hash = new SpatialHash(worldW, worldH, cellSize, 2048, 512);

    // 建立 100 個隨機分佈的實體
    interface EntityCircle {
      id: number;
      x: number;
      y: number;
      radius: number;
    }

    const entities: EntityCircle[] = [];
    for (let i = 0; i < 100; i++) {
      // 偽隨機生成，保證測試可重現
      const x = ((i * 37 + 19) % 900) + 50;
      const y = ((i * 73 + 41) % 900) + 50;
      const radius = 10 + (i % 15); // 10 ~ 24
      entities.push({ id: i, x, y, radius });

      const code = encodeEntityCode(ENTITY_TYPE_SHAPE, i);
      hash.insert(x, y, code);
    }

    // 進行 10 次隨機圓形查詢
    for (let q = 0; q < 10; q++) {
      const qx = ((q * 97 + 103) % 800) + 100;
      const qy = ((q * 83 + 67) % 800) + 100;
      const qr = 20;

      // 1. 暴力法 (Brute force) 找出所有真正重疊的實體
      const bruteCollisions: number[] = [];
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const dx = e.x - qx;
        const dy = e.y - qy;
        const distSq = dx * dx + dy * dy;
        const maxDist = qr + e.radius;
        if (distSq <= maxDist * maxDist) {
          bruteCollisions.push(e.id);
        }
      }

      // 2. SpatialHash 空間網格查詢
      const count = hash.query(qx, qy, qr, maxCandidateR);
      const hashFoundIndices: number[] = [];
      for (let i = 0; i < count; i++) {
        const code = hash.queryResults[i];
        hashFoundIndices.push(decodeEntityIndex(code));
      }

      // 3. 驗證：所有真正碰撞的實體必須全都出現在 SpatialHash 的候選集中（零漏判）
      for (let b = 0; b < bruteCollisions.length; b++) {
        const trueId = bruteCollisions[b];
        expect(hashFoundIndices).toContain(trueId);
      }
    }
  });

  it('clear() 應能正確重置所有格子，支援零配置重複利用', () => {
    const hash = new SpatialHash(500, 500, 128);
    hash.insert(100, 100, encodeEntityCode(0, 1));
    expect(hash.query(100, 100, 20)).toBe(1);

    hash.clear();
    expect(hash.query(100, 100, 20)).toBe(0);

    hash.insert(200, 200, encodeEntityCode(1, 2));
    expect(hash.query(200, 200, 20)).toBe(1);
  });
});
