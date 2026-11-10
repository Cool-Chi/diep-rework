import { describe, expect, it } from 'vitest';
import { InputManager } from '../src/core/InputManager';
import type { InputCommand } from '../src/entities/Tank';

// 使用 Node 內建 EventTarget 與 Event 模擬鍵鼠事件（不依賴任何外部套件）
class MockKeyboardEvent extends Event {
  public code: string;
  public targetElement: {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;

  constructor(
    type: string,
    code: string,
    targetElement: {
      tagName?: string;
      isContentEditable?: boolean;
    } | null = null,
  ) {
    super(type, { bubbles: true, cancelable: true });
    this.code = code;
    this.targetElement = targetElement;
  }

  override get target(): EventTarget | null {
    return this.targetElement as unknown as EventTarget;
  }
}

class MockPointerEvent extends Event {
  public button: number;
  public clientX: number;
  public clientY: number;

  constructor(type: string, button = 0, x = 100, y = 200) {
    super(type, { bubbles: true, cancelable: true });
    this.button = button;
    this.clientX = x;
    this.clientY = y;
  }
}

describe('InputManager (Robust keyup & focus loss handling)', () => {
  const createCmd = (): InputCommand => ({
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    shooting: false,
  });

  const identityScreenToWorld = (sx: number, sy: number) => ({ x: sx, y: sy });

  it('correctly sets key on keydown and releases key on keyup', () => {
    const mockWindow = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    const input = new InputManager(mockWindow, null);
    input.attach(mockCanvas);

    const cmd = createCmd();

    // 1. 按下 W 鍵
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyW'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(-1);
    expect(input.getPressedKeys()).toContain('KeyW');

    // 2. 放開 W 鍵
    mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', 'KeyW'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(0);
    expect(input.getPressedKeys()).not.toContain('KeyW');

    // 3. 空白鍵射擊
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'Space'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(true);

    mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', 'Space'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(false);
  });

  it('resets all keys on window blur, pointercancel and visibilitychange', () => {
    const mockWindow = new EventTarget();
    const mockDoc = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    const input = new InputManager(mockWindow, mockDoc);
    input.attach(mockCanvas);

    const cmd = createCmd();

    // 同時按下 W 與 D
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyW'));
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyD'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(-1);
    expect(cmd.moveX).toBe(1);

    // 觸發視窗失焦 blur
    mockWindow.dispatchEvent(new Event('blur'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(0);
    expect(cmd.moveX).toBe(0);
    expect(input.getPressedKeys().length).toBe(0);

    // 再次按下 A，觸發 pointercancel
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyA'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveX).toBe(-1);

    mockWindow.dispatchEvent(new Event('pointercancel'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveX).toBe(0);
  });

  it('ignores keydown when focus is on input element, but ALWAYS processes keyup', () => {
    const mockWindow = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    const input = new InputManager(mockWindow, null);
    input.attach(mockCanvas);

    const cmd = createCmd();

    // 1. 先在遊戲中按下 W 鍵
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyW'));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(-1);

    // 2. 焦點切換到 input 滑桿，使用者在 input 內按下 D 鍵 -> keydown 被忽略
    mockWindow.dispatchEvent(
      new MockKeyboardEvent('keydown', 'KeyD', { tagName: 'INPUT' }),
    );
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveX).toBe(0); // D 鍵未被採樣

    // 3. 使用者放開先前按住的 W 鍵（此時焦點仍在 input 上）
    // keyup 必須被處理，絕對不能卡鍵！
    mockWindow.dispatchEvent(
      new MockKeyboardEvent('keyup', 'KeyW', { tagName: 'INPUT' }),
    );
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.moveY).toBe(0); // W 鍵成功釋放！
    expect(input.getPressedKeys()).not.toContain('KeyW');
  });

  it('overlay blocks mouse events from reaching canvas, but allows keyup to reach window', () => {
    const mockWindow = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    const input = new InputManager(mockWindow, null);
    input.attach(mockCanvas);

    const cmd = createCmd();

    // 模擬在 canvas 上按下滑鼠開火
    mockCanvas.dispatchEvent(new MockPointerEvent('pointerdown', 0));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(true);

    mockWindow.dispatchEvent(new MockPointerEvent('pointerup', 0));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(false);

    // 模擬在 DebugOverlay 上：overlay 阻擋 pointerdown 傳遞到 canvas
    const overlay = new EventTarget();
    const stopPropagation = (e: Event) => e.stopPropagation();
    overlay.addEventListener('pointerdown', stopPropagation);

    let canvasReceivedPointerDown = false;
    mockCanvas.addEventListener('pointerdown', () => {
      canvasReceivedPointerDown = true;
    });

    const overlayEvent = new MockPointerEvent('pointerdown', 0);
    overlay.dispatchEvent(overlayEvent);
    expect(canvasReceivedPointerDown).toBe(false);

    // 但按鍵事件沒有被 overlay 阻擋，keyup 可以順暢到達 window
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'KeyS'));
    expect(input.getPressedKeys()).toContain('KeyS');

    mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', 'KeyS'));
    expect(input.getPressedKeys()).not.toContain('KeyS');
  });

  it('triggers stat upgrade requests on Digit1 ~ Digit8 keys without repeats', () => {
    const mockWindow = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    const input = new InputManager(mockWindow, null);
    input.attach(mockCanvas);

    const upgrades: number[] = [];
    const mockEventBus = {
      emitStatUpgradeRequested: (idx: number) => {
        upgrades.push(idx);
      },
    };
    input.eventBus = mockEventBus as unknown as typeof input.eventBus;

    // 按下 1 號鍵 (生命恢復)
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'Digit1'));
    expect(upgrades).toEqual([0]);

    // 按下 8 號鍵 (移動速度)
    mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', 'Digit8'));
    expect(upgrades).toEqual([0, 7]);
  });

  it('isolates HUD interactions: pointerdown on UI does not fire, moving over UI does not interrupt firing', () => {
    const mockWindow = new EventTarget();
    const mockCanvas = new EventTarget() as HTMLCanvasElement;
    // 定義 UI 範圍：x: 10~100, y: 10~100
    const isOverUi = (x: number, y: number) =>
      x >= 10 && x <= 100 && y >= 10 && y <= 100;

    const input = new InputManager(mockWindow, null, isOverUi);
    input.attach(mockCanvas);

    const cmd = createCmd();

    // 1. 在 UI 區域內按下滑鼠 -> 不進入射擊狀態
    mockCanvas.dispatchEvent(new MockPointerEvent('pointerdown', 0, 50, 50));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(false);
    expect(input.isMouseDown).toBe(false);

    // 2. 在 UI 區域外按下滑鼠 -> 進入射擊狀態
    mockCanvas.dispatchEvent(new MockPointerEvent('pointerdown', 0, 200, 200));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(true);
    expect(input.isMouseDown).toBe(true);

    // 3. 已經按住開火，游標移動到 UI 區域內部 -> 不得中斷射擊
    mockWindow.dispatchEvent(new MockPointerEvent('pointermove', 0, 50, 50));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(true);
    expect(input.isMouseDown).toBe(true);

    // 4. 放開滑鼠 -> 結束射擊
    mockWindow.dispatchEvent(new MockPointerEvent('pointerup', 0, 50, 50));
    input.sample(cmd, identityScreenToWorld);
    expect(cmd.shooting).toBe(false);
    expect(input.isMouseDown).toBe(false);
  });
});
