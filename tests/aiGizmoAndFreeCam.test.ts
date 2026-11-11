import { describe, expect, it, vi } from 'vitest';
import { PERSONA_COLORS, PERSONA_TAGS } from '../src/ai/aiPersonas.config';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config/constants';
import { Camera } from '../src/core/Camera';
import { InputManager } from '../src/core/InputManager';
import { Tank } from '../src/entities/Tank';
import { SpawnSystem } from '../src/systems/SpawnSystem';
import { minimapToWorld } from '../src/ui/hudMath';
import { MiniMap } from '../src/ui/MiniMap';

describe('AI Persona Colors & FreeCam & Gizmo', () => {
  it('PERSONA_COLORS should have distinct colors for all 4 personas', () => {
    expect(PERSONA_COLORS.apex).toBe(0xffaa00);
    expect(PERSONA_COLORS.tactician).toBe(0xbf7ff5);
    expect(PERSONA_COLORS.aggressor).toBe(0xf14e54);
    expect(PERSONA_COLORS.newbie).toBe(0x00e16e);

    expect(PERSONA_TAGS.apex).toBe('APEX');
    expect(PERSONA_TAGS.tactician).toBe('TACTICIAN');
    expect(PERSONA_TAGS.aggressor).toBe('AGGRESSOR');
    expect(PERSONA_TAGS.newbie).toBe('NEWBIE');
  });

  it('SpawnSystem should assign bot color based on its persona', () => {
    const spawnSystem = new SpawnSystem();
    const player = new Tank(1, 4000, 4000);
    spawnSystem.init(player);

    const bots = spawnSystem.aiTanks;
    expect(bots.length).toBeGreaterThan(0);

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.persona) {
        expect(bot.color).toBe(PERSONA_COLORS[bot.persona]);
      }
    }
  });

  describe('Camera FreeCam functionality', () => {
    it('should calculate scale based on freeCamZoom when isFreeCam is active', () => {
      const camera = new Camera(4000, 4000);
      camera.resize(1920, 1080);
      expect(camera.scale).toBeGreaterThan(0);

      camera.isFreeCam = true;
      camera.freeCamZoom = 2.0;
      expect(camera.scale).toBeCloseTo(camera.baseScale * 2.0);

      camera.zoomFreeCam(0.5); // 2.0 * 0.5 = 1.0
      expect(camera.freeCamZoom).toBeCloseTo(1.0);
      expect(camera.scale).toBeCloseTo(camera.baseScale * 1.0);

      // Clamping limits (0.2x ~ 2.5x)
      camera.zoomFreeCam(0.01);
      expect(camera.freeCamZoom).toBe(0.2);

      camera.zoomFreeCam(100);
      expect(camera.freeCamZoom).toBe(2.5);
    });

    it('panFreeCam should translate camera target and clamp to world bounds', () => {
      const camera = new Camera(4000, 4000);
      camera.resize(1920, 1080);
      camera.isFreeCam = true;
      camera.freeCamTargetX = 4000;
      camera.freeCamTargetY = 4000;

      // Pan right by 100 pixels on screen -> targetX decreases by 100 / scale
      const s = camera.scale;
      camera.panFreeCam(100, 50);
      expect(camera.freeCamTargetX).toBeCloseTo(4000 - 100 / s);
      expect(camera.freeCamTargetY).toBeCloseTo(4000 - 50 / s);

      // Pan beyond map limits
      camera.panFreeCam(1000000, 1000000);
      expect(camera.freeCamTargetX).toBe(0);
      expect(camera.freeCamTargetY).toBe(0);

      camera.panFreeCam(-2000000, -2000000);
      expect(camera.freeCamTargetX).toBe(WORLD_WIDTH);
      expect(camera.freeCamTargetY).toBe(WORLD_HEIGHT);
    });

    it('setTarget should respect isFreeCam', () => {
      const camera = new Camera(4000, 4000);
      camera.isFreeCam = true;
      camera.setFreeCamTarget(1500, 2500);

      // Ordinary player target update should not override freeCamTarget
      camera.setTarget(500, 500);
      expect(camera.targetX).toBe(1500);
      expect(camera.targetY).toBe(2500);
    });
  });

  describe('MiniMap & World coordinate conversion', () => {
    it('minimapToWorld should correctly map local coords to world coords', () => {
      const mapSize = 160;
      const origin = minimapToWorld(0, 0, mapSize, 8000, 8000);
      expect(origin.x).toBe(0);
      expect(origin.y).toBe(0);

      const center = minimapToWorld(80, 80, mapSize, 8000, 8000);
      expect(center.x).toBe(4000);
      expect(center.y).toBe(4000);

      const corner = minimapToWorld(160, 160, mapSize, 8000, 8000);
      expect(corner.x).toBe(8000);
      expect(corner.y).toBe(8000);
    });

    it('MiniMap.handleClick should return null outside bounding box and world coords inside', () => {
      const miniMap = new MiniMap();
      miniMap.resize(1920, 1080, 1.0);

      // Outside minimap
      expect(miniMap.handleClick(100, 100)).toBeNull();

      // Inside minimap center
      const centerScreenX = miniMap.screenX + miniMap.screenWidth * 0.5;
      const centerScreenY = miniMap.screenY + miniMap.screenHeight * 0.5;
      const worldTarget = miniMap.handleClick(centerScreenX, centerScreenY);

      expect(worldTarget).not.toBeNull();
      if (worldTarget) {
        expect(worldTarget.x).toBeCloseTo(WORLD_WIDTH * 0.5, 0);
        expect(worldTarget.y).toBeCloseTo(WORLD_HEIGHT * 0.5, 0);
      }
    });
  });

  describe('InputManager FreeCam triggers', () => {
    it('should trigger onToggleFreeCam on KeyC', () => {
      const inputManager = new InputManager();
      const toggleFn = vi.fn();
      inputManager.onToggleFreeCam = toggleFn;

      // Simulate keydown KeyC
      // @ts-expect-error test mock
      inputManager.handleKeyDown({ code: 'KeyC', repeat: false, target: null });
      expect(toggleFn).toHaveBeenCalledTimes(1);

      // Repeated keydown ignored
      // @ts-expect-error test mock
      inputManager.handleKeyDown({ code: 'KeyC', repeat: true, target: null });
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });

    it('should trigger onCameraPan on pointer move while right/middle mouse is down', () => {
      const inputManager = new InputManager();
      const panFn = vi.fn();
      inputManager.onCameraPan = panFn;

      // Right mouse button down (button = 2)
      // @ts-expect-error test mock
      inputManager.handlePointerDown({ button: 2, clientX: 100, clientY: 100 });

      // Move mouse to (150, 120)
      // @ts-expect-error test mock
      inputManager.handlePointerMove({ clientX: 150, clientY: 120 });
      expect(panFn).toHaveBeenCalledWith(50, 20);

      // Right mouse up
      // @ts-expect-error test mock
      inputManager.handlePointerUp({ button: 2 });

      // Move mouse again - should no longer pan
      // @ts-expect-error test mock
      inputManager.handlePointerMove({ clientX: 180, clientY: 130 });
      expect(panFn).toHaveBeenCalledTimes(1);
    });

    it('should trigger onCameraZoom on wheel', () => {
      const inputManager = new InputManager();
      const zoomFn = vi.fn();
      inputManager.onCameraZoom = zoomFn;

      // Wheel up (deltaY < 0) -> zoom in (1.15)
      // @ts-expect-error test mock
      inputManager.handleWheel({
        deltaY: -100,
        preventDefault: vi.fn(),
      });
      expect(zoomFn).toHaveBeenCalledWith(1.15);

      // Wheel down (deltaY > 0) -> zoom out (0.85)
      // @ts-expect-error test mock
      inputManager.handleWheel({
        deltaY: 100,
        preventDefault: vi.fn(),
      });
      expect(zoomFn).toHaveBeenCalledWith(0.85);
    });

    it('should allow left mouse drag to pan camera and silence tank shooting when isFreeCamActive is true', () => {
      const inputManager = new InputManager();
      const panFn = vi.fn();
      inputManager.onCameraPan = panFn;
      inputManager.isFreeCamActive = () => true;

      // Left mouse button down (button = 0) in FreeCam
      // @ts-expect-error test mock
      inputManager.handlePointerDown({ button: 0, clientX: 200, clientY: 200 });

      // Moving mouse should trigger camera pan
      // @ts-expect-error test mock
      inputManager.handlePointerMove({ clientX: 230, clientY: 240 });
      expect(panFn).toHaveBeenCalledWith(30, 40);

      // Tank sample should have zero movement and zero shooting
      const cmd = { moveX: 1, moveY: 1, aimX: 0, aimY: 0, shooting: true };
      inputManager.keyW = true;
      inputManager.keyD = true;
      inputManager.sample(cmd, (x, y) => ({ x: x * 2, y: y * 2 }));

      expect(cmd.moveX).toBe(0);
      expect(cmd.moveY).toBe(0);
      expect(cmd.shooting).toBe(false);

      // Left mouse up ends panning
      // @ts-expect-error test mock
      inputManager.handlePointerUp({ button: 0 });
      // @ts-expect-error test mock
      inputManager.handlePointerMove({ clientX: 300, clientY: 300 });
      expect(panFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Camera FreeCam vs GodView Precedence', () => {
    it('isFreeCam should take precedence over isGodView in scale and target', () => {
      const camera = new Camera(4000, 4000);
      camera.resize(1920, 1080);
      camera.isGodView = true;
      camera.isFreeCam = true;
      camera.freeCamTargetX = 2500;
      camera.freeCamTargetY = 3500;
      camera.freeCamZoom = 1.5;

      expect(camera.scale).toBeCloseTo(camera.baseScale * 1.5);

      camera.setTarget(100, 100);
      expect(camera.targetX).toBe(2500);
      expect(camera.targetY).toBe(3500);
    });
  });
});
