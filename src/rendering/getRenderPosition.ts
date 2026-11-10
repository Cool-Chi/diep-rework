export interface RenderPositionOut {
  x: number;
  y: number;
}

export interface PositionableEntity {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
}

/**
 * 取得實體在當前渲染幀的世界座標插值位置
 * @param entity 具備前一 tick 與當前 tick 座標的實體
 * @param alpha 渲染插值係數 (0 <= alpha < 1)
 * @param out 輸出目標物件，就地寫入 x 與 y（熱路徑零記憶體配置）
 */
export function getRenderPosition(
  entity: PositionableEntity,
  alpha: number,
  out: RenderPositionOut,
): void {
  out.x = entity.prevX + (entity.x - entity.prevX) * alpha;
  out.y = entity.prevY + (entity.y - entity.prevY) * alpha;
}

/**
 * 計算血條相對於實體渲染座標的世界位置錨點
 * @param renderX 實體渲染 X
 * @param renderY 實體渲染 Y
 * @param radius 實體半徑
 * @param offsetFactor 偏移倍率 (TODO(tune))
 * @param out 輸出目標物件，寫入錨點 x 與 y
 */
export function getHealthBarAnchor(
  renderX: number,
  renderY: number,
  radius: number,
  offsetFactor: number,
  out: RenderPositionOut,
): void {
  out.x = renderX;
  out.y = renderY + radius * offsetFactor;
}
