import type { InputCommand } from '../entities/Tank';
import type { EventBus } from './EventBus';

/**
 * 玩家鍵鼠輸入管理器
 * 嚴格使用 KeyboardEvent.code（避免中文輸入法卡鍵）
 * keyup 永遠處理，焦點在輸入元件時僅過濾 keydown
 * 視窗失焦、切換分頁、pointercancel、contextmenu、overlay 切換時皆清空按鍵
 */
export class InputManager {
  public eventBus: EventBus | null = null;

  private keyW = false;
  private keyA = false;
  private keyS = false;
  private keyD = false;
  private keySpace = false;
  public autoFire = false;

  public mouseScreenX = 0;
  public mouseScreenY = 0;
  public isMouseDown = false;
  public onPointerMove: ((screenX: number, screenY: number) => void) | null =
    null;

  private canvas: HTMLCanvasElement | null = null;
  private onKeyDownBound: (e: Event) => void;
  private onKeyUpBound: (e: Event) => void;
  private onBlurBound: () => void;
  private onVisibilityChangeBound: () => void;
  private onPointerMoveBound: (e: Event) => void;
  private onPointerDownBound: (e: Event) => void;
  private onPointerUpBound: (e: Event) => void;
  private onPointerCancelBound: () => void;
  private onContextMenuBound: (e: Event) => void;

  constructor(
    private readonly windowTarget: EventTarget = typeof window !== 'undefined'
      ? window
      : new EventTarget(),
    private readonly docTarget: EventTarget | null = typeof document !==
    'undefined'
      ? document
      : null,
    public isOverUi:
      | ((screenX: number, screenY: number) => boolean)
      | null = null,
  ) {
    this.onKeyDownBound = (e) => this.handleKeyDown(e as KeyboardEvent);
    this.onKeyUpBound = (e) => this.handleKeyUp(e as KeyboardEvent);
    this.onBlurBound = () => this.clearKeys();
    this.onVisibilityChangeBound = () => this.handleVisibilityChange();
    this.onPointerMoveBound = (e) =>
      this.handlePointerMove(e as unknown as PointerEvent);
    this.onPointerDownBound = (e) =>
      this.handlePointerDown(e as unknown as PointerEvent);
    this.onPointerUpBound = (e) =>
      this.handlePointerUp(e as unknown as PointerEvent);
    this.onPointerCancelBound = () => this.clearKeys();
    this.onContextMenuBound = (e) => {
      e.preventDefault();
      this.clearKeys();
    };
  }

  /**
   * 綁定監聽至 Canvas 與 Window（使用 capture 階段）
   * @param canvas 遊戲 HTML5 Canvas 元素
   */
  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    this.windowTarget.addEventListener('keydown', this.onKeyDownBound, {
      capture: true,
    });
    this.windowTarget.addEventListener('keyup', this.onKeyUpBound, {
      capture: true,
    });
    this.windowTarget.addEventListener('blur', this.onBlurBound, {
      capture: true,
    });
    this.windowTarget.addEventListener('pointermove', this.onPointerMoveBound, {
      capture: true,
    });
    this.windowTarget.addEventListener('pointerup', this.onPointerUpBound, {
      capture: true,
    });
    this.windowTarget.addEventListener(
      'pointercancel',
      this.onPointerCancelBound,
      { capture: true },
    );

    if (this.docTarget) {
      this.docTarget.addEventListener(
        'visibilitychange',
        this.onVisibilityChangeBound,
        { capture: true },
      );
    }

    canvas.addEventListener('pointerdown', this.onPointerDownBound);
    canvas.addEventListener('contextmenu', this.onContextMenuBound);
  }

  /**
   * 解除所有事件監聽
   */
  public detach(): void {
    this.windowTarget.removeEventListener('keydown', this.onKeyDownBound, {
      capture: true,
    });
    this.windowTarget.removeEventListener('keyup', this.onKeyUpBound, {
      capture: true,
    });
    this.windowTarget.removeEventListener('blur', this.onBlurBound, {
      capture: true,
    });
    this.windowTarget.removeEventListener(
      'pointermove',
      this.onPointerMoveBound,
      { capture: true },
    );
    this.windowTarget.removeEventListener('pointerup', this.onPointerUpBound, {
      capture: true,
    });
    this.windowTarget.removeEventListener(
      'pointercancel',
      this.onPointerCancelBound,
      { capture: true },
    );

    if (this.docTarget) {
      this.docTarget.removeEventListener(
        'visibilitychange',
        this.onVisibilityChangeBound,
        { capture: true },
      );
    }

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
      this.canvas.removeEventListener('contextmenu', this.onContextMenuBound);
    }
  }

  /**
   * 判斷事件目標是否為輸入元件（input, textarea, select, contenteditable）
   */
  private isInputElement(target: unknown): boolean {
    if (!target || typeof target !== 'object') return false;
    const el = target as { tagName?: string; isContentEditable?: boolean };
    const tag = el.tagName?.toUpperCase();
    return (
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA' ||
      el.isContentEditable === true
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // 焦點在輸入元件時忽略 keydown
    if (this.isInputElement(e.target)) {
      return;
    }

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
      case 'Space':
        this.keySpace = true;
        e.preventDefault();
        break;
      case 'KeyE':
        this.autoFire = !this.autoFire;
        break;
      case 'Digit1':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(0);
        break;
      case 'Digit2':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(1);
        break;
      case 'Digit3':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(2);
        break;
      case 'Digit4':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(3);
        break;
      case 'Digit5':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(4);
        break;
      case 'Digit6':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(5);
        break;
      case 'Digit7':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(6);
        break;
      case 'Digit8':
        if (!e.repeat) this.eventBus?.emitStatUpgradeRequested(7);
        break;
    }
  }

  /**
   * keyup 永遠處理，不得被焦點過濾，確保按鍵不會卡死
   */
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
      case 'Space':
        this.keySpace = false;
        break;
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.clearKeys();
    }
  }

  public clearKeys(): void {
    this.keyW = false;
    this.keyA = false;
    this.keyS = false;
    this.keyD = false;
    this.keySpace = false;
    this.isMouseDown = false;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    this.onPointerMove?.(e.clientX, e.clientY);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 0) {
      if (this.isOverUi?.(e.clientX, e.clientY)) {
        return;
      }
      this.isMouseDown = true;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.button === 0) {
      this.isMouseDown = false;
    }
  }

  /**
   * 取得當前被視為按下的按鍵代碼清單（供除錯面板顯示）
   */
  public getPressedKeys(): string[] {
    const keys: string[] = [];
    if (this.keyW) keys.push('KeyW');
    if (this.keyA) keys.push('KeyA');
    if (this.keyS) keys.push('KeyS');
    if (this.keyD) keys.push('KeyD');
    if (this.keySpace) keys.push('Space');
    if (this.autoFire) keys.push('AutoFire(E)');
    if (this.isMouseDown) keys.push('Mouse0');
    return keys;
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
    target.shooting = this.isMouseDown || this.keySpace || this.autoFire;

    const worldPos = screenToWorld(this.mouseScreenX, this.mouseScreenY);
    target.aimX = worldPos.x;
    target.aimY = worldPos.y;
  }
}
