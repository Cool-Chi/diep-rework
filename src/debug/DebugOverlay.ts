import { BASE_BULLET_RADIUS, BULLET_LIFESPAN_TICKS } from '../config/constants';
import { MAX_LEVEL, SCORE_FOR_LEVEL } from '../config/levels.config';
import {
  STAT_BULLET_DAMAGE,
  STAT_BULLET_PENETRATION,
  STAT_MAX_HEALTH,
  STAT_RELOAD,
} from '../config/stats.config';
import type { Game } from '../core/Game';

/**
 * 完整開發除錯面板 (DebugOverlay)
 * 僅在 import.meta.env.DEV 環境動態載入，按 Backquote (`) 開啟/關閉
 * 採用純 DOM 實作，事件嚴格隔離，具備效能指標、渲染耗時、等級加點、壓力測試與常數即時微調
 */
export class DebugOverlay {
  private element: HTMLDivElement | null = null;
  private metricsElement: HTMLDivElement | null = null;
  private isVisible = true;

  // 效能採樣
  private frameCount = 0;
  private tickCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 0;
  private currentTps = 0;

  // Tick 耗時統計（預先配置 50 容量環形緩衝區，熱路徑零配置）
  private readonly tickDurations = new Float64Array(50);
  private tickRingHead = 0;
  private avgTickMs = 0;
  private maxTickMs = 0;

  // Render 耗時統計（預先配置 50 容量環形緩衝區，熱路徑零配置）
  private readonly renderDurations = new Float64Array(50);
  private renderRingHead = 0;
  private avgRenderMs = 0;
  private maxRenderMs = 0;

  // HUD 耗時統計（預先配置 50 容量環形緩衝區，熱路徑零配置）
  private readonly hudDurations = new Float64Array(50);
  private hudRingHead = 0;
  private avgHudMs = 0;
  private maxHudMs = 0;

  // 事件計數器
  private shapeDestroyedCount = 0;
  private tankDiedCount = 0;

  // 狀態開關
  public isGodMode = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(private readonly game: Game) {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);

    // 訂閱事件匯流排計數
    this.game.eventBus.onShapeDestroyed(() => {
      this.shapeDestroyedCount++;
    });
    this.game.eventBus.onTankDied(() => {
      this.tankDiedCount++;
    });

    this.createDOM();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Backquote') {
      this.toggleVisibility();
    }
  }

  public toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    // 開關切換時主動清空按鍵，防止卡鍵
    this.game.inputManager.clearKeys();
    if (this.element) {
      this.element.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  /**
   * 每次模擬 tick 呼叫，記錄耗時與 tick 次數
   * @param durationMs 該 tick 執行的毫秒數
   */
  public recordTick(durationMs: number): void {
    this.tickCount++;
    this.tickDurations[this.tickRingHead] = durationMs;
    this.tickRingHead = (this.tickRingHead + 1) % 50;
  }

  /**
   * 每個渲染幀更新 Sprite 渲染時間
   * @param durationMs 該幀 Sprite 渲染更新耗時毫秒數
   */
  public recordRenderDuration(durationMs: number): void {
    this.renderDurations[this.renderRingHead] = durationMs;
    this.renderRingHead = (this.renderRingHead + 1) % 50;
  }

  /**
   * 每個渲染幀更新 HUD 介面渲染更新時間
   * @param durationMs 該幀 HUD 更新耗時毫秒數
   */
  public recordHudDuration(durationMs: number): void {
    this.hudDurations[this.hudRingHead] = durationMs;
    this.hudRingHead = (this.hudRingHead + 1) % 50;
  }

  /**
   * 每個渲染幀更新顯示指標
   */
  public update(): void {
    if (this.isGodMode) {
      this.game.playerTank.hp = this.game.playerTank.maxHp;
    }

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 250) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.currentTps = Math.round((this.tickCount * 1000) / elapsed);
      this.frameCount = 0;
      this.tickCount = 0;
      this.lastFpsTime = now;

      // 計算環形緩衝之平均與最大 tick 耗時
      let tickSum = 0;
      let tickMax = 0;
      for (let i = 0; i < 50; i++) {
        const val = this.tickDurations[i];
        tickSum += val;
        if (val > tickMax) tickMax = val;
      }
      this.avgTickMs = tickSum / 50;
      this.maxTickMs = tickMax;

      // 計算環形緩衝之平均與最大 render 耗時
      let renderSum = 0;
      let renderMax = 0;
      for (let i = 0; i < 50; i++) {
        const val = this.renderDurations[i];
        renderSum += val;
        if (val > renderMax) renderMax = val;
      }
      this.avgRenderMs = renderSum / 50;
      this.maxRenderMs = renderMax;

      // 計算環形緩衝之平均與最大 HUD 耗時
      let hudSum = 0;
      let hudMax = 0;
      for (let i = 0; i < 50; i++) {
        const val = this.hudDurations[i];
        hudSum += val;
        if (val > hudMax) hudMax = val;
      }
      this.avgHudMs = hudSum / 50;
      this.maxHudMs = hudMax;

      this.renderMetrics();
    }
  }

  private renderMetrics(): void {
    if (!this.metricsElement) return;

    const tank = this.game.playerTank;
    const activeBullets = this.game.bulletPool.getActiveCount();
    const visibleBullets = this.game.bulletRenderer.visibleCount;
    const bulletAlert = activeBullets > 0 && visibleBullets === 0;

    const activeShapes = this.game.shapeSystem.activeCount;
    const visibleShapes = this.game.shapeRenderer.visibleCount;
    const shapeAlert = activeShapes > 0 && visibleShapes === 0;

    const pressedKeys = this.game.inputManager.getPressedKeys();
    const pressedStr = pressedKeys.length > 0 ? pressedKeys.join(', ') : 'none';

    const nextScore =
      tank.level >= MAX_LEVEL
        ? 'MAX'
        : SCORE_FOR_LEVEL[Math.min(tank.level, MAX_LEVEL - 1)].toString();

    const statsArr = `[${Array.from(tank.statLevels).join(', ')}]`;
    const fovVal = (
      this.game.camera.fovMultiplier *
      (1 + (tank.level - 1) * this.game.camera.fovLevelScaling)
    ).toFixed(3);

    this.metricsElement.innerHTML = `
      <div style="font-weight:bold;color:#00ffcc;margin-bottom:6px;">[DEBUG PANEL] (Toggle: \`)</div>
      <div>FPS: <b>${this.currentFps}</b> | TPS: <b>${this.currentTps}</b> (target 25)</div>
      <div>Tick Duration: avg <b>${this.avgTickMs.toFixed(2)}ms</b> | max <b>${this.maxTickMs.toFixed(2)}ms</b></div>
      <div>Render Duration: avg <b>${this.avgRenderMs.toFixed(2)}ms</b> | max <b>${this.maxRenderMs.toFixed(2)}ms</b></div>
      <div>HUD Duration: avg <b>${this.avgHudMs.toFixed(2)}ms</b> | max <b>${this.maxHudMs.toFixed(2)}ms</b></div>
      <div>HealthBars Pool: <b>${this.game.healthBarRenderer.activeCount}</b> / ${this.game.healthBarRenderer.capacity} active</div>
      <div>Bullets: ${bulletAlert ? `<b style="color:#ff3333">${activeBullets} active / ${visibleBullets} visible [ALERT: INVISIBLE!]</b>` : `<b>${activeBullets}</b> active / <b>${visibleBullets}</b> visible`}</div>
      <div>Shapes: ${shapeAlert ? `<b style="color:#ff3333">${activeShapes} active / ${visibleShapes} visible [ALERT: INVISIBLE!]</b>` : `<b>${activeShapes}</b> active / <b>${visibleShapes}</b> visible`}</div>
      <div style="border-top:1px dashed rgba(255,255,255,0.15);margin:4px 0;padding-top:4px;">
        Level: <b style="color:#ffff00">${tank.level}</b>/30 | Score: <b>${tank.score}</b> (next: <b>${nextScore}</b>)
      </div>
      <div>Unspent Points: <b style="color:#00ff88">${tank.statPoints}</b> | Stats [1~8]: <b style="color:#33ccff">${statsArr}</b></div>
      <div>HP: <b>${Math.ceil(tank.hp)}</b>/${tank.maxHp} | Reload: <b>${tank.reloadTicks}t</b> | BulletSpd: <b>${tank.bulletSpeed.toFixed(2)}</b></div>
      <div>BulletHP: <b>${tank.bulletHp}</b> | BulletDmg: <b>${tank.bulletDamage}</b> | Radius: <b>${tank.radius.toFixed(1)}</b> | FOV: <b>${fovVal}</b></div>
      <div style="border-top:1px dashed rgba(255,255,255,0.15);margin:4px 0;padding-top:4px;">
        Pressed Keys: <b style="color:#ffff00">${pressedStr}</b>
      </div>
      <div>Shapes Destroyed: <b>${this.shapeDestroyedCount}</b> | Tank Deaths: <b>${this.tankDiedCount}</b></div>
      <div>God Mode: <b style="color:${this.isGodMode ? '#00ff88' : '#ff5555'}">${this.isGodMode ? 'ON' : 'OFF'}</b></div>
    `;
  }

  private createDOM(): void {
    const el = document.createElement('div');
    el.id = 'debug-overlay';
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.left = '10px';
    el.style.padding = '12px 16px';
    el.style.backgroundColor = 'rgba(15, 20, 28, 0.9)';
    el.style.color = '#e0e0e0';
    el.style.fontFamily = 'Consolas, monospace';
    el.style.fontSize = '12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
    el.style.border = '1px solid rgba(255,255,255,0.15)';
    el.style.zIndex = '999999';
    el.style.lineHeight = '1.45';
    el.style.userSelect = 'none';
    el.style.maxWidth = '380px';
    el.style.maxHeight = '90vh';
    el.style.overflowY = 'auto';

    // 關鍵：只阻擋滑鼠與 pointer 事件傳給遊戲，不阻擋鍵盤事件（確保 keyup 永遠能被接收）
    const stopPropagation = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stopPropagation);
    el.addEventListener('mousedown', stopPropagation);
    el.addEventListener('click', stopPropagation);

    // 1. 數值指標區
    this.metricsElement = document.createElement('div');
    el.appendChild(this.metricsElement);

    // 分隔線
    const hr1 = document.createElement('hr');
    hr1.style.border = '0';
    hr1.style.borderTop = '1px solid rgba(255,255,255,0.15)';
    hr1.style.margin = '8px 0';
    el.appendChild(hr1);

    // 2. 快捷動作按鈕區
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'grid';
    btnContainer.style.gridTemplateColumns = '1fr 1fr';
    btnContainer.style.gap = '5px';

    const createBtn = (
      text: string,
      onClick: () => void,
      color = '#3a4454',
    ) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.padding = '4px 6px';
      b.style.backgroundColor = color;
      b.style.color = '#ffffff';
      b.style.border = '1px solid rgba(255,255,255,0.2)';
      b.style.borderRadius = '4px';
      b.style.cursor = 'pointer';
      b.style.fontSize = '11px';
      b.style.fontFamily = 'inherit';
      b.addEventListener('click', () => {
        onClick();
        b.blur();
        this.game.renderer.app.canvas.focus?.();
      });
      return b;
    };

    // 無敵切換按鈕
    const godBtn = createBtn('Toggle God Mode', () => {
      this.isGodMode = !this.isGodMode;
      this.renderMetrics();
    });
    btnContainer.appendChild(godBtn);

    // 補滿形狀按鈕
    const fillShapeBtn = createBtn('Fill Shapes (500)', () => {
      this.game.shapeSystem.fillToTarget();
      this.renderMetrics();
    });
    btnContainer.appendChild(fillShapeBtn);

    // +100 分數按鈕
    const add100Btn = createBtn('+100 Score', () => {
      this.game.levelingSystem.addScore(
        this.game.playerTank,
        100,
        this.game.eventBus,
      );
      this.renderMetrics();
    });
    btnContainer.appendChild(add100Btn);

    // +1000 分數按鈕
    const add1000Btn = createBtn('+1000 Score', () => {
      this.game.levelingSystem.addScore(
        this.game.playerTank,
        100,
        this.game.eventBus,
      );
      this.game.levelingSystem.addScore(
        this.game.playerTank,
        900,
        this.game.eventBus,
      );
      this.renderMetrics();
    });
    btnContainer.appendChild(add1000Btn);

    // 升至 Lv 15 按鈕 (787 分)
    const lv15Btn = createBtn(
      'Level 15 (787)',
      () => {
        const tank = this.game.playerTank;
        if (tank.score < 787) {
          this.game.levelingSystem.addScore(
            tank,
            787 - tank.score,
            this.game.eventBus,
          );
        }
        this.renderMetrics();
      },
      '#2a6478',
    );
    btnContainer.appendChild(lv15Btn);

    // 升至 Lv 30 按鈕 (6184 分)
    const lv30Btn = createBtn(
      'Level 30 (6184)',
      () => {
        const tank = this.game.playerTank;
        if (tank.score < 6184) {
          this.game.levelingSystem.addScore(
            tank,
            6184 - tank.score,
            this.game.eventBus,
          );
        }
        this.renderMetrics();
      },
      '#5c3a78',
    );
    btnContainer.appendChild(lv30Btn);

    // 一鍵升至 Lv 30 並點滿 28 點
    const autoMaxBtn = createBtn(
      'Auto-Max 28 Pts',
      () => {
        const tank = this.game.playerTank;
        if (tank.score < 6184) {
          this.game.levelingSystem.addScore(
            tank,
            6184 - tank.score,
            this.game.eventBus,
          );
        }
        for (let p = 0; p < 7; p++) {
          this.game.levelingSystem.spendStatPoint(
            tank,
            STAT_MAX_HEALTH,
            this.game.eventBus,
          );
          this.game.levelingSystem.spendStatPoint(
            tank,
            STAT_BULLET_PENETRATION,
            this.game.eventBus,
          );
          this.game.levelingSystem.spendStatPoint(
            tank,
            STAT_BULLET_DAMAGE,
            this.game.eventBus,
          );
          this.game.levelingSystem.spendStatPoint(
            tank,
            STAT_RELOAD,
            this.game.eventBus,
          );
        }
        this.renderMetrics();
      },
      '#784c2a',
    );
    btnContainer.appendChild(autoMaxBtn);

    // 重設屬性與等級
    const resetBtn = createBtn(
      'Reset Stats (Lv1)',
      () => {
        this.game.levelingSystem.resetTank(
          this.game.playerTank,
          this.game.eventBus,
        );
        this.renderMetrics();
      },
      '#555555',
    );
    btnContainer.appendChild(resetBtn);

    // 清空子彈按鈕
    const clearBulletBtn = createBtn('Clear Bullets', () => {
      const cap = this.game.bulletPool.capacity;
      for (let i = 0; i < cap; i++) {
        if (this.game.bulletPool.isActive(i)) {
          this.game.bulletPool.release(i);
        }
      }
      this.renderMetrics();
    });
    btnContainer.appendChild(clearBulletBtn);

    // 清空形狀按鈕
    const clearShapeBtn = createBtn('Destroy Shapes', () => {
      this.game.shapeSystem.clearAll();
      this.renderMetrics();
    });
    btnContainer.appendChild(clearShapeBtn);

    // 坦克扣 50% 生命按鈕 (用於測試受傷血條)
    const dmgTankBtn = createBtn(
      'Damage Tank 50%',
      () => {
        const tank = this.game.playerTank;
        tank.hp = Math.max(1, Math.floor(tank.hp * 0.5));
        tank.lastDamageTick = this.game.currentTick;
        this.renderMetrics();
      },
      '#8c3b3b',
    );
    btnContainer.appendChild(dmgTankBtn);

    // 視野內形狀扣血 50% 按鈕 (用於測試形狀血條)
    const dmgShapesBtn = createBtn(
      'Damage Shapes 50%',
      () => {
        const shapes = this.game.shapeSystem.shapes;
        for (let i = 0; i < shapes.length; i++) {
          if (shapes[i].active) {
            shapes[i].hp = Math.max(1, Math.floor(shapes[i].maxHp * 0.5));
          }
        }
        this.renderMetrics();
      },
      '#8c3b3b',
    );
    btnContainer.appendChild(dmgShapesBtn);

    // 切換 HUD 顯示開關
    const toggleHudBtn = createBtn('Toggle HUD', () => {
      this.game.hud.visible = !this.game.hud.visible;
      this.renderMetrics();
    });
    btnContainer.appendChild(toggleHudBtn);

    // 600 子彈壓力測試按鈕
    const stressBtn = createBtn(
      'Stress: 600 Bullets',
      () => {
        this.triggerStressTest(600);
      },
      '#a83232',
    );
    stressBtn.style.gridColumn = 'span 2';
    btnContainer.appendChild(stressBtn);

    el.appendChild(btnContainer);

    // 分隔線
    const hr2 = document.createElement('hr');
    hr2.style.border = '0';
    hr2.style.borderTop = '1px solid rgba(255,255,255,0.15)';
    hr2.style.margin = '8px 0';
    el.appendChild(hr2);

    // 3. 常數即時調參滑桿區 (TODO(tune))
    const sliderContainer = document.createElement('div');
    sliderContainer.style.fontSize = '11px';

    const createSlider = (
      label: string,
      min: number,
      max: number,
      step: number,
      getValue: () => number,
      setValue: (val: number) => void,
    ) => {
      const row = document.createElement('div');
      row.style.marginBottom = '5px';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `${label}: ${getValue().toFixed(3)}`;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min.toString();
      input.max = max.toString();
      input.step = step.toString();
      input.value = getValue().toString();
      input.style.width = '100%';
      input.style.display = 'block';

      input.addEventListener('input', () => {
        const val = Number.parseFloat(input.value);
        setValue(val);
        labelSpan.textContent = `${label}: ${val.toFixed(3)}`;
      });

      // 操作結束後失焦，把焦點還給遊戲 canvas
      const returnFocus = () => {
        input.blur();
        this.game.renderer.app.canvas.focus?.();
      };
      input.addEventListener('change', returnFocus);
      input.addEventListener('pointerup', returnFocus);

      row.appendChild(labelSpan);
      row.appendChild(input);
      sliderContainer.appendChild(row);
    };

    createSlider(
      'Move Accel',
      0.1,
      3.0,
      0.05,
      () => this.game.physics.moveAccel,
      (v) => {
        this.game.physics.moveAccel = v;
      },
    );
    createSlider(
      'Move Damping',
      0.5,
      0.99,
      0.01,
      () => this.game.physics.damping,
      (v) => {
        this.game.physics.damping = v;
      },
    );
    createSlider(
      'Bullet Speed',
      5.0,
      30.0,
      0.5,
      () => this.game.fireSystem.bulletSpeed,
      (v) => {
        this.game.fireSystem.bulletSpeed = v;
      },
    );
    createSlider(
      'Recoil Impulse',
      0.0,
      2.0,
      0.05,
      () => this.game.fireSystem.recoilImpulse,
      (v) => {
        this.game.fireSystem.recoilImpulse = v;
      },
    );
    createSlider(
      'Push Factor',
      0.1,
      1.5,
      0.05,
      () => this.game.collisionSystem.pushFactor,
      (v) => {
        this.game.collisionSystem.pushFactor = v;
      },
    );
    createSlider(
      'Knockback Factor',
      0.0,
      2.0,
      0.05,
      () => this.game.collisionSystem.knockbackFactor,
      (v) => {
        this.game.collisionSystem.knockbackFactor = v;
      },
    );
    createSlider(
      'FOV Level Scaling',
      0.0,
      0.03,
      0.001,
      () => this.game.camera.fovLevelScaling,
      (v) => {
        this.game.camera.fovLevelScaling = v;
      },
    );
    createSlider(
      'Hyper Regen %/sec',
      0.01,
      0.5,
      0.01,
      () => this.game.regenSystem.hyperRegenPercent,
      (v) => {
        this.game.regenSystem.hyperRegenPercent = v;
      },
    );
    createSlider(
      'HealthBar Offset',
      0.8,
      2.5,
      0.05,
      () => this.game.healthBarRenderer.healthBarOffsetFactor,
      (v) => {
        this.game.healthBarRenderer.healthBarOffsetFactor = v;
      },
    );
    createSlider(
      'HealthBar Width',
      0.5,
      3.0,
      0.05,
      () => this.game.healthBarRenderer.healthBarWidthFactor,
      (v) => {
        this.game.healthBarRenderer.healthBarWidthFactor = v;
      },
    );

    el.appendChild(sliderContainer);

    document.body.appendChild(el);
    this.element = el;
    this.renderMetrics();
  }

  /**
   * 觸發壓力測試：自坦克座標向 360 度射出 600 發子彈
   */
  public triggerStressTest(count = 600): void {
    const tank = this.game.playerTank;
    const pool = this.game.bulletPool;
    const step = (Math.PI * 2) / count;
    const speed = this.game.fireSystem.bulletSpeed;

    for (let i = 0; i < count; i++) {
      const idx = pool.acquire();
      if (idx === -1) break;

      const angle = i * step;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      pool.items[idx].init(
        idx,
        tank.id,
        tank.x,
        tank.y,
        vx,
        vy,
        BASE_BULLET_RADIUS,
        2,
        7,
        BULLET_LIFESPAN_TICKS,
      );
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }
}
