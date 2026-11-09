import type { InputCommand } from '../entities/Tank';

/**
 * 玩家鍵鼠輸入管理器
 * 嚴格使用 KeyboardEvent.code（避免中文輸入法卡鍵）
 * 支援 pointer 事件與視窗失焦時重置按鍵
 */
export class InputManager {
  private keyW = false;
  private keyA = false;
  private keyS = false;
  private keyD = false;

  public mouseScreenX = 0;
  public mouseScreenY = 0;
  public isMouseDown = false;

  private canvas: HTMLCanvasElement | null = null;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onContextMenuBound: (e: MouseEvent) => void;

  constructor() {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onBlurBound = this.handleBlur.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);
    this.onContextMenuBound = (e) => e.preventDefault();
  }

  /**
   * 綁定監聽至 Canvas 與 Window
   * @param canvas 遊戲 HTML5 Canvas 元素
   */
  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);

    window.addEventListener('pointermove', this.onPointerMoveBound);
    canvas.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    canvas.addEventListener('contextmenu', this.onContextMenuBound);
  }

  /**
   * 解除所有事件監聽
   */
  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
      this.canvas.removeEventListener('contextmenu', this.onContextMenuBound);
    }
    window.removeEventListener('pointerup', this.onPointerUpBound);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyW = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyA = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyS = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyD = true;
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyW = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyA = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyS = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyD = false;
        break;
    }
  }

  private handleBlur(): void {
    this.clearKeys();
  }

  public clearKeys(): void {
    this.keyW = false;
    this.keyA = false;
    this.keyS = false;
    this.keyD = false;
    this.isMouseDown = false;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 0) {
      this.isMouseDown = true;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.button === 0) {
      this.isMouseDown = false;
    }
  }

  /**
   * 每個模擬 tick 取樣當前輸入狀態並寫入目標 InputCommand
   * @param target 待寫入的 InputCommand
   * @param screenToWorld 螢幕座標轉世界座標計算函式
   */
  public sample(
    target: InputCommand,
    screenToWorld: (sx: number, sy: number) => { x: number; y: number },
  ): void {
    let mx = 0;
    let my = 0;
    if (this.keyD) mx += 1;
    if (this.keyA) mx -= 1;
    if (this.keyS) my += 1;
    if (this.keyW) my -= 1;

    target.moveX = mx;
    target.moveY = my;
    target.shooting = this.isMouseDown;

    const worldPos = screenToWorld(this.mouseScreenX, this.mouseScreenY);
    target.aimX = worldPos.x;
    target.aimY = worldPos.y;
  }
}
