import type { VisibleBounds } from '../core/Camera';

/**
 * 判斷指定圓形實體在包含 margin 邊界擴展後，是否與世界可視範圍相交
 * @param x 實體中心 X（世界座標）
 * @param y 實體中心 Y（世界座標）
 * @param radius 實體半徑（世界單位）
 * @param bounds 相機當前可視世界矩形
 * @param margin 額外擴展緩衝邊界（世界單位，防止在螢幕邊界閃爍）
 * @returns 是否落在可視範圍內
 */
export function isInBounds(
  x: number,
  y: number,
  radius: number,
  bounds: VisibleBounds,
  margin = 0,
): boolean {
  return (
    x + radius >= bounds.minX - margin &&
    x - radius <= bounds.maxX + margin &&
    y + radius >= bounds.minY - margin &&
    y - radius <= bounds.maxY + margin
  );
}
