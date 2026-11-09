import {
  BASE_TANK_RADIUS,
  SPATIAL_HASH_CELL_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';

/**
 * 實體類別數字編碼（高 16 位元）
 */
export const ENTITY_TYPE_TANK = 0;
export const ENTITY_TYPE_BULLET = 1;
export const ENTITY_TYPE_SHAPE = 2;

/**
 * 將實體種類與索引編碼為單一 32-bit 整數
 * 編碼公式：(type << 16) | (index & 0xFFFF)
 */
export function encodeEntityCode(type: number, index: number): number {
  return (type << 16) | (index & 0xffff);
}

/**
 * 解碼實體種類
 */
export function decodeEntityType(code: number): number {
  return code >> 16;
}

/**
 * 解碼實體索引
 */
export function decodeEntityIndex(code: number): number {
  return code & 0xffff;
}

/**
 * 基於 Int32Array 的高效零配置空間雜湊網格 (Spatial Hash Grid)
 * 每個模擬 tick 重建一次，使用鏈結串列結構 (cellHead + entityNext) 實現 O(1) 插入與範圍查詢
 */
export class SpatialHash {
  public readonly cellSize: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly totalCells: number;

  private readonly cellHead: Int32Array;
  private readonly entityNext: Int32Array;
  private readonly entityCode: Int32Array;
  private readonly maxEntities: number;
  private entityCount = 0;

  // 預先配置的查詢結果緩衝區，杜絕熱路徑配置臨時陣列
  public readonly queryResults: Int32Array;
  public readonly maxQueryResults: number;

  constructor(
    worldWidth = WORLD_WIDTH,
    worldHeight = WORLD_HEIGHT,
    cellSize = SPATIAL_HASH_CELL_SIZE,
    maxEntities = 4096,
    maxQueryResults = 1024,
  ) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.totalCells = this.cols * this.rows;

    this.maxEntities = maxEntities;
    this.maxQueryResults = maxQueryResults;

    this.cellHead = new Int32Array(this.totalCells);
    this.entityNext = new Int32Array(this.maxEntities);
    this.entityCode = new Int32Array(this.maxEntities);
    this.queryResults = new Int32Array(this.maxQueryResults);

    this.clear();
  }

  /**
   * 每個模擬 tick 開始時清空網格
   */
  public clear(): void {
    this.cellHead.fill(-1);
    this.entityCount = 0;
  }

  /**
   * 將實體插入其中心點所在的格子
   * @param x 實體中心 X
   * @param y 實體中心 Y
   * @param code 編碼後的實體標識 ((type << 16) | index)
   */
  public insert(x: number, y: number, code: number): void {
    if (this.entityCount >= this.maxEntities) {
      return;
    }

    const col = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor(x / this.cellSize)),
    );
    const row = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor(y / this.cellSize)),
    );
    const cellIdx = row * this.cols + col;

    const slot = this.entityCount++;
    this.entityCode[slot] = code;
    this.entityNext[slot] = this.cellHead[cellIdx];
    this.cellHead[cellIdx] = slot;
  }

  /**
   * 查詢與給定圓形重疊可能的所有候選實體編碼
   * 寫入預配置的 this.queryResults 並回傳結果數量
   * @param x 查詢圓心 X
   * @param y 查詢圓心 Y
   * @param radius 查詢半徑
   * @param maxCandidateRadius 最大候選實體半徑（預設為坦克半徑 25 單位）
   * @returns 查詢到的候選實體數量
   */
  public query(
    x: number,
    y: number,
    radius: number,
    maxCandidateRadius = BASE_TANK_RADIUS,
  ): number {
    const searchRadius = radius + maxCandidateRadius;

    const minCol = Math.max(0, Math.floor((x - searchRadius) / this.cellSize));
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((x + searchRadius) / this.cellSize),
    );
    const minRow = Math.max(0, Math.floor((y - searchRadius) / this.cellSize));
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((y + searchRadius) / this.cellSize),
    );

    let count = 0;

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * this.cols;
      for (let c = minCol; c <= maxCol; c++) {
        const cellIdx = rowOffset + c;
        let slot = this.cellHead[cellIdx];

        while (slot !== -1 && count < this.maxQueryResults) {
          this.queryResults[count++] = this.entityCode[slot];
          slot = this.entityNext[slot];
        }
      }
    }

    return count;
  }
}
