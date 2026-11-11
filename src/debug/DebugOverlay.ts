import { BASE_BULLET_RADIUS, BULLET_LIFESPAN_TICKS } from '../config/constants';
import { MAX_LEVEL, SCORE_FOR_LEVEL } from '../config/levels.config';
import {
  STAT_BULLET_DAMAGE,
  STAT_BULLET_PENETRATION,
  STAT_MAX_HEALTH,
  STAT_RELOAD,
} from '../config/stats.config';
import { TANKS_CONFIG, type TankClassId } from '../config/tanks.config';
import type { Game } from '../core/Game';

/**
 * 完整開發除錯面板 (DebugOverlay)
 * 僅在 import.meta.env.DEV 環境動態載入，按 Backquote (`) 或 Slash (/) 開啟/關閉
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
  public isGodMode = true; // 開局預設開啟無敵模式

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
    if (e.code === 'Backquote' || e.code === 'Slash' || e.key === '/') {
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
      this.game.playerTank.isGodMode = true;
    } else {
      this.game.playerTank.isGodMode = false;
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
      <div style="font-weight:bold;color:#00ffcc;margin-bottom:4px;display:flex;justify-content:space-between;">
        <span>[DEBUG PANEL] (\` or /)</span>
        <span style="font-size:10px;color:#888;">M8</span>
      </div>
      <div>FPS: <b>${this.currentFps}</b> | TPS: <b>${this.currentTps}</b></div>
      <div>Tick: <b>${this.avgTickMs.toFixed(2)}ms</b> (max <b>${this.maxTickMs.toFixed(2)}ms</b>)</div>
      <div>Render: <b>${this.avgRenderMs.toFixed(2)}ms</b> (max <b>${this.maxRenderMs.toFixed(2)}ms</b>)</div>
      <div>HUD: <b>${this.avgHudMs.toFixed(2)}ms</b> (max <b>${this.maxHudMs.toFixed(2)}ms</b>)</div>
      <div>HealthBars: <b>${this.game.healthBarRenderer.activeCount}</b> / ${this.game.healthBarRenderer.capacity}</div>
      <div>Bullets: ${bulletAlert ? `<b style="color:#ff3333">${activeBullets} / ${visibleBullets} [ALERT]</b>` : `<b>${activeBullets}</b> act / <b>${visibleBullets}</b> vis`} | Clash: <b style="color:#ffcc00">${this.game.collisionSystem.bulletClashCount}</b></div>
      <div>Shapes: ${shapeAlert ? `<b style="color:#ff3333">${activeShapes} / ${visibleShapes} [ALERT]</b>` : `<b>${activeShapes}</b> act / <b>${visibleShapes}</b> vis`}</div>
      <div>Particles: <b>${this.game.particleRenderer.visibleCount}</b> vis / <b>${this.game.particlePool.capacity}</b></div>
      <div style="border-top:1px dashed rgba(255,255,255,0.15);margin:3px 0;padding-top:3px;">
        Lv: <b style="color:#ffff00">${tank.level}</b>/30 | Score: <b>${tank.score}</b> (next: <b>${nextScore}</b>)
      </div>
      <div>Class: <b style="color:#00e5ff">${tank.definition.name}</b> (Tier ${tank.definition.tier})</div>
      <div>Pts: <b style="color:#00ff88">${tank.statPoints}</b> | Stats: <b style="color:#33ccff">${statsArr}</b></div>
      <div>HP: <b>${Math.ceil(tank.hp)}</b>/${tank.maxHp} | FOV: <b>${fovVal}</b></div>
      <div style="border-top:1px dashed rgba(255,255,255,0.15);margin:3px 0;padding-top:3px;">
        AI: <b style="color:#00ff88">${this.game.spawnSystem.getActiveAiCount()}</b>/40 | Passive: <b style="color:${this.game.aiSystem.passiveMode ? '#ffbb00' : '#00ff88'}">${this.game.aiSystem.passiveMode ? 'ON' : 'OFF'}</b>
      </div>
      <div>Keys: <b style="color:#ffff00">${pressedStr}</b> | Dead: S:<b>${this.shapeDestroyedCount}</b> T:<b>${this.tankDiedCount}</b></div>
      <div>God: <b style="color:${this.isGodMode ? '#00ff88' : '#ff5555'}">${this.isGodMode ? 'ON' : 'OFF'}</b> | GodView: <b style="color:${this.game.camera.isGodView ? '#00ff88' : '#888888'}">${this.game.camera.isGodView ? 'ON' : 'OFF'}</b></div>
      <div>FreeCam: <b style="color:${this.game.camera.isFreeCam ? '#00ff88' : '#888888'}">${this.game.camera.isFreeCam ? `ON (${this.game.camera.freeCamZoom.toFixed(1)}x)` : 'OFF'}</b> | Gizmos: <b style="color:${this.game.showAiGizmos ? '#00ff88' : '#888888'}">${this.game.showAiGizmos ? 'ON' : 'OFF'}</b></div>
      <div>IgnorePlayer: <b style="color:${this.game.aiSystem.ignorePlayer ? '#00ff88' : '#ff5555'}">${this.game.aiSystem.ignorePlayer ? 'ON' : 'OFF'}</b> | Sandbox: <b style="color:${this.game.agentTest.isSandboxActive ? '#00ff88' : '#888888'}">${this.game.agentTest.isSandboxActive ? `ON (${this.game.agentTest.sandboxDummyClass})` : 'OFF'}</b></div>
      <div>AI Duel: <b style="color:${this.game.agentTest.isAiDuelActive ? '#00ff88' : '#888888'}">${this.game.agentTest.isAiDuelActive ? `ON (${this.game.agentTest.duelClassAlpha} vs ${this.game.agentTest.duelClassBeta})` : 'OFF'}</b></div>
    `;
  }

  private createDOM(): void {
    const el = document.createElement('div');
    el.id = 'debug-overlay';
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.left = '10px';
    el.style.padding = '8px 10px';
    el.style.backgroundColor = 'rgba(15, 20, 28, 0.88)';
    el.style.color = '#e0e0e0';
    el.style.fontFamily = 'Consolas, monospace';
    el.style.fontSize = '11px';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
    el.style.border = '1px solid rgba(255,255,255,0.15)';
    el.style.zIndex = '999999';
    el.style.lineHeight = '1.35';
    el.style.userSelect = 'none';
    el.style.maxWidth = '265px';
    el.style.maxHeight = '85vh';
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
    hr1.style.margin = '6px 0';
    el.appendChild(hr1);

    // 2. 快捷動作按鈕區 (Collapsible Details)
    const detailsActions = document.createElement('details');
    detailsActions.open = true;
    detailsActions.style.marginBottom = '6px';

    const sumActions = document.createElement('summary');
    sumActions.textContent = '⚡ Actions & AI';
    sumActions.style.cursor = 'pointer';
    sumActions.style.color = '#70a5fd';
    sumActions.style.fontWeight = 'bold';
    sumActions.style.outline = 'none';
    sumActions.style.marginBottom = '4px';
    detailsActions.appendChild(sumActions);

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'grid';
    btnContainer.style.gridTemplateColumns = '1fr 1fr';
    btnContainer.style.gap = '3px';

    const createBtn = (
      text: string,
      onClick: () => void,
      color = '#3a4454',
    ) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.padding = '3px 4px';
      b.style.backgroundColor = color;
      b.style.color = '#ffffff';
      b.style.border = '1px solid rgba(255,255,255,0.2)';
      b.style.borderRadius = '3px';
      b.style.cursor = 'pointer';
      b.style.fontSize = '10px';
      b.style.fontFamily = 'inherit';
      b.style.whiteSpace = 'nowrap';
      b.style.overflow = 'hidden';
      b.style.textOverflow = 'ellipsis';
      b.addEventListener('click', () => {
        onClick();
        b.blur();
        this.game.renderer.app.canvas.focus?.();
      });
      return b;
    };

    // 無敵切換按鈕 (預設開啟)
    const godBtn = createBtn(
      `God: ${this.isGodMode ? 'ON' : 'OFF'}`,
      () => {
        this.isGodMode = !this.isGodMode;
        this.game.playerTank.isGodMode = this.isGodMode;
        godBtn.textContent = `God: ${this.isGodMode ? 'ON' : 'OFF'}`;
        godBtn.style.backgroundColor = this.isGodMode ? '#1b4965' : '#555555';
        this.renderMetrics();
      },
      this.isGodMode ? '#1b4965' : '#555555',
    );
    btnContainer.appendChild(godBtn);

    // 無視玩家切換按鈕 (預設開啟)
    const ignorePlayerBtn = createBtn(
      `Ignore: ${this.game.aiSystem.ignorePlayer ? 'ON' : 'OFF'}`,
      () => {
        this.game.aiSystem.ignorePlayer = !this.game.aiSystem.ignorePlayer;
        ignorePlayerBtn.textContent = `Ignore: ${this.game.aiSystem.ignorePlayer ? 'ON' : 'OFF'}`;
        ignorePlayerBtn.style.backgroundColor = this.game.aiSystem.ignorePlayer
          ? '#1b4965'
          : '#555555';
        this.renderMetrics();
      },
      this.game.aiSystem.ignorePlayer ? '#1b4965' : '#555555',
    );
    btnContainer.appendChild(ignorePlayerBtn);

    // 自由相機切換按鈕 (C 鍵快捷切換)
    const freeCamBtn = createBtn(
      `FreeCam: ${this.game.camera.isFreeCam ? 'ON' : 'OFF'}`,
      () => {
        this.game.toggleFreeCam();
        freeCamBtn.textContent = `FreeCam: ${this.game.camera.isFreeCam ? 'ON' : 'OFF'}`;
        freeCamBtn.style.backgroundColor = this.game.camera.isFreeCam
          ? '#1b4965'
          : '#555555';
        this.renderMetrics();
      },
      this.game.camera.isFreeCam ? '#1b4965' : '#555555',
    );
    btnContainer.appendChild(freeCamBtn);

    // AI 決策可視化開關按鈕
    const gizmoBtn = createBtn(
      `Gizmos: ${this.game.showAiGizmos ? 'ON' : 'OFF'}`,
      () => {
        this.game.toggleAiGizmos();
        gizmoBtn.textContent = `Gizmos: ${this.game.showAiGizmos ? 'ON' : 'OFF'}`;
        gizmoBtn.style.backgroundColor = this.game.showAiGizmos
          ? '#1b4965'
          : '#555555';
        this.renderMetrics();
      },
      this.game.showAiGizmos ? '#1b4965' : '#555555',
    );
    btnContainer.appendChild(gizmoBtn);

    // 上帝鳥瞰視角切換
    const godViewBtn = createBtn(
      `GodView: ${this.game.camera.isGodView ? 'ON' : 'OFF'}`,
      () => {
        this.game.toggleGodView();
        godViewBtn.textContent = `GodView: ${this.game.camera.isGodView ? 'ON' : 'OFF'}`;
        godViewBtn.style.backgroundColor = this.game.camera.isGodView
          ? '#1b4965'
          : '#555555';
        this.renderMetrics();
      },
      this.game.camera.isGodView ? '#1b4965' : '#555555',
    );
    btnContainer.appendChild(godViewBtn);

    // 相機重設回玩家
    const resetCamBtn = createBtn(
      'Reset Cam',
      () => {
        this.game.resetCamera();
        freeCamBtn.textContent = 'FreeCam: OFF';
        freeCamBtn.style.backgroundColor = '#555555';
        godViewBtn.textContent = 'GodView: OFF';
        godViewBtn.style.backgroundColor = '#555555';
        this.renderMetrics();
      },
      '#4a5568',
    );
    btnContainer.appendChild(resetCamBtn);

    // 補滿形狀按鈕
    const fillShapeBtn = createBtn('Fill Shapes (1400)', () => {
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

    // 升至 Lv 45 滿級按鈕 (23536 分)
    const lv45Btn = createBtn(
      'Level 45 (23536)',
      () => {
        const tank = this.game.playerTank;
        if (tank.score < 23536) {
          this.game.levelingSystem.addScore(
            tank,
            23536 - tank.score,
            this.game.eventBus,
          );
        }
        this.renderMetrics();
      },
      '#783a3a',
    );
    btnContainer.appendChild(lv45Btn);

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

    // 觸發 Lv 15 轉職面板按鈕
    const triggerEvoBtn = createBtn(
      'Trigger Evolution Panel',
      () => {
        this.game.hud.evolutionPanel.show([
          'twin',
          'sniper',
          'machine_gun',
          'flank_guard',
        ]);
        this.renderMetrics();
      },
      '#2a6f97',
    );
    btnContainer.appendChild(triggerEvoBtn);

    // 子彈相消測試按鈕
    const clashBasicBtn = createBtn(
      'Clash: Basic x2',
      () => {
        this.game.agentTest.spawnClash('basic', 'basic');
      },
      '#7b4397',
    );
    btnContainer.appendChild(clashBasicBtn);

    const clashDestrBtn = createBtn(
      'Clash: Destr vs Gun',
      () => {
        this.game.agentTest.spawnClash('destroyer', 'gunner', {
          bulletCountB: 5,
        });
      },
      '#8f3b76',
    );
    btnContainer.appendChild(clashDestrBtn);

    const clashDestr2Btn = createBtn(
      'Clash: Destr x2',
      () => {
        this.game.agentTest.spawnClash('destroyer', 'destroyer');
      },
      '#a03b5b',
    );
    btnContainer.appendChild(clashDestr2Btn);

    const clearBulletsBtn = createBtn(
      'Clear Bullets',
      () => {
        this.game.agentTest.clearAllBullets();
      },
      '#5a5a5a',
    );
    btnContainer.appendChild(clearBulletsBtn);

    // 小型對打測試沙盒按鈕
    const sandboxBtn = createBtn(
      this.game.agentTest.isSandboxActive ? 'Exit Sandbox' : '🎯 Duel Sandbox',
      () => {
        if (this.game.agentTest.isSandboxActive) {
          this.game.agentTest.stopBulletSandbox();
        } else {
          this.game.agentTest.startBulletSandbox('basic');
        }
        sandboxBtn.textContent = this.game.agentTest.isSandboxActive
          ? 'Exit Sandbox'
          : '🎯 Duel Sandbox';
        sandboxBtn.style.backgroundColor = this.game.agentTest.isSandboxActive
          ? '#e63946'
          : '#2a9d8f';
        this.renderMetrics();
      },
      this.game.agentTest.isSandboxActive ? '#e63946' : '#2a9d8f',
    );
    btnContainer.appendChild(sandboxBtn);

    const dummyTwinBtn = createBtn(
      'Dummy: Twin',
      () => {
        this.game.agentTest.setSandboxDummyClass('twin');
        this.renderMetrics();
      },
      '#457b9d',
    );
    btnContainer.appendChild(dummyTwinBtn);

    const dummyDestrBtn = createBtn(
      'Dummy: Destr',
      () => {
        this.game.agentTest.setSandboxDummyClass('destroyer');
        this.renderMetrics();
      },
      '#6a4c93',
    );
    btnContainer.appendChild(dummyDestrBtn);

    const dummyGunnerBtn = createBtn(
      'Dummy: Gunner',
      () => {
        this.game.agentTest.setSandboxDummyClass('gunner');
        this.renderMetrics();
      },
      '#e76f51',
    );
    btnContainer.appendChild(dummyGunnerBtn);

    // AI 決鬥對戰沙盒按鈕組
    const aiDuelBtn = createBtn(
      this.game.agentTest.isAiDuelActive ? 'Exit AI Duel' : '⚔️ AI Duel Arena',
      () => {
        if (this.game.agentTest.isAiDuelActive) {
          this.game.agentTest.stopAiDuelSandbox();
        } else {
          this.game.agentTest.startAiDuelSandbox('twin', 'destroyer', true);
        }
        aiDuelBtn.textContent = this.game.agentTest.isAiDuelActive
          ? 'Exit AI Duel'
          : '⚔️ AI Duel Arena';
        aiDuelBtn.style.backgroundColor = this.game.agentTest.isAiDuelActive
          ? '#e63946'
          : '#3a0ca3';
        this.renderMetrics();
      },
      this.game.agentTest.isAiDuelActive ? '#e63946' : '#3a0ca3',
    );
    aiDuelBtn.style.gridColumn = 'span 2';
    btnContainer.appendChild(aiDuelBtn);

    const duelAlphaBtn = createBtn(
      'Alpha: Twin/Sniper',
      () => {
        const nextA =
          this.game.agentTest.duelClassAlpha === 'twin' ? 'sniper' : 'twin';
        this.game.agentTest.setAiDuelClasses(
          nextA,
          this.game.agentTest.duelClassBeta,
        );
        this.renderMetrics();
      },
      '#1d3557',
    );
    btnContainer.appendChild(duelAlphaBtn);

    const duelBetaBtn = createBtn(
      'Beta: Destr/MachineGun',
      () => {
        const nextB =
          this.game.agentTest.duelClassBeta === 'destroyer'
            ? 'machine_gun'
            : 'destroyer';
        this.game.agentTest.setAiDuelClasses(
          this.game.agentTest.duelClassAlpha,
          nextB,
        );
        this.renderMetrics();
      },
      '#7209b7',
    );
    btnContainer.appendChild(duelBetaBtn);

    const duelGodBtn = createBtn(
      'Toggle Duel GodMode',
      () => {
        this.game.agentTest.toggleAiDuelGodMode();
        this.renderMetrics();
      },
      '#4361ee',
    );
    duelGodBtn.style.gridColumn = 'span 2';
    btnContainer.appendChild(duelGodBtn);

    // 職業一鍵切換折疊區 (Tier 1 ~ Tier 4 全 21 款職業)
    const detailsClasses = document.createElement('details');
    detailsClasses.style.marginBottom = '6px';
    const sumClasses = document.createElement('summary');
    sumClasses.textContent = '🎮 Tank Classes (21)';
    sumClasses.style.cursor = 'pointer';
    sumClasses.style.color = '#70a5fd';
    sumClasses.style.fontWeight = 'bold';
    sumClasses.style.outline = 'none';
    sumClasses.style.marginBottom = '4px';
    detailsClasses.appendChild(sumClasses);

    const classBtnContainer = document.createElement('div');
    classBtnContainer.style.display = 'grid';
    classBtnContainer.style.gridTemplateColumns = '1fr 1fr';
    classBtnContainer.style.gap = '3px';

    const classList: TankClassId[] = [
      'basic',
      'twin',
      'sniper',
      'machine_gun',
      'flank_guard',
      'triple_shot',
      'assassin',
      'destroyer',
      'twin_flank',
      'quad_tank',
      'hunter',
      'gunner',
      'tri_angle',
      'triplet',
      'penta_shot',
      'octo_tank',
      'ranger',
      'predator',
      'annihilator',
      'booster',
      'fighter',
    ];
    for (let c = 0; c < classList.length; c++) {
      const cid = classList[c];
      const btn = createBtn(
        TANKS_CONFIG[cid].name,
        () => {
          const reqLv = TANKS_CONFIG[cid].requiredLevel;
          if (this.game.playerTank.level < reqLv) {
            const reqScore = SCORE_FOR_LEVEL[reqLv - 1];
            if (this.game.playerTank.score < reqScore) {
              this.game.levelingSystem.addScore(
                this.game.playerTank,
                reqScore - this.game.playerTank.score,
                this.game.eventBus,
              );
            }
          }
          this.game.levelingSystem.evolveTank(
            this.game.playerTank,
            cid,
            this.game.eventBus,
          );
          this.renderMetrics();
        },
        '#2d5a3f',
      );
      classBtnContainer.appendChild(btn);
    }
    detailsClasses.appendChild(classBtnContainer);

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

    // AI 測試與調參控制按鈕組
    const toggleGodViewBtn = createBtn(
      'Toggle God View (Full Map)',
      () => {
        this.game.toggleGodView();
        this.renderMetrics();
      },
      '#d9534f',
    );
    toggleGodViewBtn.style.gridColumn = 'span 2';
    btnContainer.appendChild(toggleGodViewBtn);

    const toggleAiPassiveBtn = createBtn(
      'Toggle AI Passive',
      () => {
        this.game.aiSystem.passiveMode = !this.game.aiSystem.passiveMode;
        this.renderMetrics();
      },
      '#7b2cbf',
    );
    btnContainer.appendChild(toggleAiPassiveBtn);

    const toggleAiLabelsBtn = createBtn(
      'Toggle AI Labels',
      () => {
        this.game.showAiDevLabels = !this.game.showAiDevLabels;
        this.renderMetrics();
      },
      '#5a189a',
    );
    btnContainer.appendChild(toggleAiLabelsBtn);

    const respawnAiBtn = createBtn(
      'Respawn 40 AI',
      () => {
        this.game.spawnSystem.init(this.game.playerTank);
        this.renderMetrics();
      },
      '#3f37c9',
    );
    btnContainer.appendChild(respawnAiBtn);

    const clearAiBtn = createBtn(
      'Clear All AI',
      () => {
        this.game.spawnSystem.clearAllAi();
        this.renderMetrics();
      },
      '#9d0208',
    );
    btnContainer.appendChild(clearAiBtn);

    const spawnDestroyerAiBtn = createBtn(
      'Spawn AI: Destroyer',
      () => {
        for (let i = 0; i < this.game.spawnSystem.aiTanks.length; i++) {
          const bot = this.game.spawnSystem.aiTanks[i];
          if (!bot.active) {
            this.game.spawnSystem.spawnAiTank(
              bot,
              30,
              this.game.playerTank.x,
              this.game.playerTank.y,
              'destroyer',
            );
            break;
          }
        }
        this.renderMetrics();
      },
      '#2d6a4f',
    );
    btnContainer.appendChild(spawnDestroyerAiBtn);

    const spawnAssassinAiBtn = createBtn(
      'Spawn AI: Assassin',
      () => {
        for (let i = 0; i < this.game.spawnSystem.aiTanks.length; i++) {
          const bot = this.game.spawnSystem.aiTanks[i];
          if (!bot.active) {
            this.game.spawnSystem.spawnAiTank(
              bot,
              30,
              this.game.playerTank.x,
              this.game.playerTank.y,
              'assassin',
            );
            break;
          }
        }
        this.renderMetrics();
      },
      '#1b4965',
    );
    btnContainer.appendChild(spawnAssassinAiBtn);

    // M6 功能測試按鈕：模擬玩家死亡與粒子爆發
    const suicideBtn = createBtn(
      'Trigger GameOver',
      () => {
        this.game.playerTank.hp = 0;
        this.game.eventBus.emitTankDied(
          this.game.playerTank.id,
          -1,
          this.game.playerTank.x,
          this.game.playerTank.y,
        );
        this.renderMetrics();
      },
      '#c1121f',
    );
    btnContainer.appendChild(suicideBtn);

    const particleBurstBtn = createBtn(
      'Burst 100 Particles',
      () => {
        this.game.spawnTankExplosion(
          this.game.playerTank.x,
          this.game.playerTank.y,
          0x00ff88,
        );
        this.game.spawnShapeExplosion(
          this.game.playerTank.x + 40,
          this.game.playerTank.y,
          'pentagon',
        );
        this.renderMetrics();
      },
      '#7b2cbf',
    );
    btnContainer.appendChild(particleBurstBtn);

    detailsActions.appendChild(btnContainer);
    el.appendChild(detailsActions);
    el.appendChild(detailsClasses);

    // 3. 常數即時調參滑桿區 (Collapsible Details)
    const detailsSliders = document.createElement('details');
    detailsSliders.style.marginBottom = '6px';
    const sumSliders = document.createElement('summary');
    sumSliders.textContent = '⚙️ Sliders & Tuning';
    sumSliders.style.cursor = 'pointer';
    sumSliders.style.color = '#70a5fd';
    sumSliders.style.fontWeight = 'bold';
    sumSliders.style.outline = 'none';
    sumSliders.style.marginBottom = '4px';
    detailsSliders.appendChild(sumSliders);

    const sliderContainer = document.createElement('div');
    sliderContainer.style.fontSize = '10px';
    sliderContainer.style.marginTop = '4px';

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
    createSlider(
      'Bullet Push',
      0.0,
      2.0,
      0.05,
      () => this.game.collisionSystem.bulletPushFactor,
      (v) => {
        this.game.collisionSystem.bulletPushFactor = v;
      },
    );
    createSlider(
      'Bullet Damping',
      0.5,
      1.0,
      0.01,
      () => this.game.collisionSystem.bulletDamping,
      (v) => {
        this.game.collisionSystem.bulletDamping = v;
      },
    );
    createSlider(
      'Bullet Restitution',
      0.0,
      1.0,
      0.05,
      () => this.game.collisionSystem.bulletRestitution,
      (v) => {
        this.game.collisionSystem.bulletRestitution = v;
      },
    );
    createSlider(
      'Bullet Deflection',
      0.0,
      2.0,
      0.05,
      () => this.game.collisionSystem.bulletDeflectionFactor,
      (v) => {
        this.game.collisionSystem.bulletDeflectionFactor = v;
      },
    );

    detailsSliders.appendChild(sliderContainer);
    el.appendChild(detailsSliders);

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
