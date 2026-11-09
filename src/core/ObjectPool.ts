/**
 * 高性能零配置物件池 (Zero-Allocation Object Pool)
 * 內部使用 TypedArray 管理空閒索引，避免執行階段的任何記憶體配置與 GC 抖動
 */
export class ObjectPool<T> {
  public readonly capacity: number;
  public readonly items: T[];

  private readonly freeIndices: Int32Array;
  private readonly inUse: Uint8Array;
  private freeCount: number;

  constructor(capacity: number, factory: (index: number) => T) {
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
    this.freeIndices = new Int32Array(capacity);
    this.inUse = new Uint8Array(capacity);
    this.freeCount = capacity;

    for (let i = 0; i < capacity; i++) {
      this.items[i] = factory(i);
      this.freeIndices[i] = capacity - 1 - i; // 後進先出 LIFO
      this.inUse[i] = 0;
    }
  }

  /**
   * 從池中借用一個實體索引
   * @returns 成功返回索引 (0 ~ capacity-1)，容量耗盡返回 -1（不拋出例外）
   */
  public acquire(): number {
    if (this.freeCount <= 0) {
      return -1;
    }
    const index = this.freeIndices[--this.freeCount];
    this.inUse[index] = 1;
    return index;
  }

  /**
   * 將實體歸還至池中
   * @param index 欲歸還的索引
   * @returns 成功歸還返回 true，若重複釋放或無效索引返回 false
   */
  public release(index: number): boolean {
    if (index < 0 || index >= this.capacity) {
      return false;
    }
    if (this.inUse[index] === 0) {
      // 避免重複釋放同一索引
      return false;
    }
    this.inUse[index] = 0;
    this.freeIndices[this.freeCount++] = index;
    return true;
  }

  /**
   * 檢查指定索引當前是否處於使用中
   */
  public isActive(index: number): boolean {
    if (index < 0 || index >= this.capacity) return false;
    return this.inUse[index] === 1;
  }

  /**
   * 取得當前活躍實體數量
   */
  public getActiveCount(): number {
    return this.capacity - this.freeCount;
  }

  /**
   * 重置物件池為全部可用
   */
  public clear(): void {
    this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i++) {
      this.freeIndices[i] = this.capacity - 1 - i;
      this.inUse[i] = 0;
    }
  }
}
