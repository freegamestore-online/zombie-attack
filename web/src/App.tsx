import { useRef, useEffect, useState, useCallback } from "react";
import { Shell } from "./components/Shell";
import * as BABYLON from "@babylonjs/core";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Zombie {
  id: number;
  root: BABYLON.Mesh;
  body: BABYLON.Mesh;
  head: BABYLON.Mesh;
  leftArm: BABYLON.Mesh;
  rightArm: BABYLON.Mesh;
  leftLeg: BABYLON.Mesh;
  rightLeg: BABYLON.Mesh;
  hp: number;
  speed: number;
  animTime: number;
  dead: boolean;
  attackCooldown: number;
}

interface GameState {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  wave: number;
  kills: number;
  totalKills: number;
  phase: "playing" | "dead" | "waveBreak";
  waveBreakTimer: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ARENA_SIZE = 40;
const ZOMBIE_BASE_HP = 3;
const ZOMBIE_BASE_SPEED = 0.035;
const ATTACK_RANGE = 1.6;
const ATTACK_DAMAGE = 8;
const ATTACK_COOLDOWN = 1.2;
const RELOAD_TIME = 1.8;
const MAX_AMMO = 12;
const WAVE_BREAK_DURATION = 4.0;
const PLAYER_SPEED = 0.12;
const PLAYER_HEIGHT = 1.7;

// ─── HUD Component ────────────────────────────────────────────────────────────
interface HudProps {
  state: GameState;
  reloading: boolean;
  reloadProgress: number;
  highScore: number;
}

function Hud({ state, reloading, reloadProgress, highScore }: HudProps) {
  const hpPct = (state.hp / state.maxHp) * 100;
  const hpColor =
    hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      {/* Crosshair */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 20,
          height: 20,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(255,255,255,0.85)",
            marginTop: -1,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(255,255,255,0.85)",
            marginLeft: -1,
          }}
        />
      </div>

      {/* Health bar — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 24,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textShadow: "0 1px 4px #000",
          }}
        >
          ❤ HEALTH
        </span>
        <div
          style={{
            width: 160,
            height: 14,
            background: "rgba(0,0,0,0.55)",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${hpPct}%`,
              height: "100%",
              background: hpColor,
              borderRadius: 7,
              transition: "width 0.2s, background 0.3s",
            }}
          />
        </div>
        <span
          style={{
            color: hpColor,
            fontSize: 11,
            fontWeight: 600,
            textShadow: "0 1px 4px #000",
          }}
        >
          {state.hp} / {state.maxHp}
        </span>
      </div>

      {/* Ammo — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          right: 24,
          textAlign: "right",
        }}
      >
        {reloading ? (
          <>
            <div
              style={{
                color: "#f59e0b",
                fontSize: 13,
                fontWeight: 700,
                textShadow: "0 1px 4px #000",
                marginBottom: 4,
              }}
            >
              RELOADING…
            </div>
            <div
              style={{
                width: 100,
                height: 6,
                background: "rgba(0,0,0,0.55)",
                borderRadius: 3,
                overflow: "hidden",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  width: `${reloadProgress * 100}%`,
                  height: "100%",
                  background: "#f59e0b",
                  borderRadius: 3,
                }}
              />
            </div>
          </>
        ) : (
          <span
            style={{
              color: state.ammo === 0 ? "#ef4444" : "#fff",
              fontSize: 26,
              fontWeight: 800,
              textShadow: "0 2px 8px #000",
              fontFamily: "Fraunces, serif",
            }}
          >
            {state.ammo}
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
              {" "}
              / {state.maxAmmo}
            </span>
          </span>
        )}
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 11,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          🔫 AMMO &nbsp;[R] reload
        </div>
      </div>

      {/* Wave / kills — top right */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 24,
          textAlign: "right",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 800,
            textShadow: "0 2px 8px #000",
            fontFamily: "Fraunces, serif",
          }}
        >
          WAVE {state.wave}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Kills: {state.totalKills} &nbsp;|&nbsp; Best: {highScore}
        </div>
      </div>

      {/* Wave break overlay */}
      {state.phase === "waveBreak" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              color: "#22c55e",
              fontSize: 38,
              fontWeight: 800,
              fontFamily: "Fraunces, serif",
              textShadow: "0 4px 24px #000",
            }}
          >
            Wave {state.wave - 1} Cleared!
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 16,
              marginTop: 10,
              fontWeight: 600,
            }}
          >
            Next wave in {Math.ceil(state.waveBreakTimer)}s…
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
interface GameOverProps {
  kills: number;
  wave: number;
  highScore: number;
  onRestart: () => void;
}

function GameOverScreen({ kills, wave, highScore, onRestart }: GameOverProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.78)",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div
        style={{
          color: "#ef4444",
          fontSize: 52,
          fontWeight: 800,
          fontFamily: "Fraunces, serif",
          textShadow: "0 4px 32px #000",
          marginBottom: 8,
        }}
      >
        YOU DIED
      </div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, marginBottom: 4 }}>
        Survived to Wave <strong style={{ color: "#fff" }}>{wave}</strong>
      </div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, marginBottom: 4 }}>
        Total Kills: <strong style={{ color: "#f59e0b" }}>{kills}</strong>
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 32 }}>
        Best: {highScore} kills
      </div>
      <button
        onClick={onRestart}
        style={{
          background: "#ef4444",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "14px 48px",
          fontSize: 18,
          fontWeight: 800,
          cursor: "pointer",
          fontFamily: "Fraunces, serif",
          letterSpacing: "0.04em",
          boxShadow: "0 4px 24px rgba(239,68,68,0.5)",
          minHeight: 48,
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}

// ─── Start Screen ─────────────────────────────────────────────────────────────
interface StartScreenProps {
  onStart: () => void;
  highScore: number;
}

function StartScreen({ onStart, highScore }: StartScreenProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div
        style={{
          color: "#ef4444",
          fontSize: 52,
          fontWeight: 800,
          fontFamily: "Fraunces, serif",
          textShadow: "0 4px 32px #000",
          marginBottom: 4,
        }}
      >
        🧟 ZOMBIE ATTACK
      </div>
      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 28, textAlign: "center", maxWidth: 320 }}>
        Survive endless waves of zombies. Aim with your mouse, shoot with{" "}
        <strong style={{ color: "#fff" }}>Left Click</strong>, move with{" "}
        <strong style={{ color: "#fff" }}>WASD</strong>, reload with{" "}
        <strong style={{ color: "#fff" }}>R</strong>.
      </div>
      {highScore > 0 && (
        <div style={{ color: "#f59e0b", fontSize: 14, marginBottom: 20, fontWeight: 700 }}>
          🏆 Best: {highScore} kills
        </div>
      )}
      <button
        onClick={onStart}
        style={{
          background: "#ef4444",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "14px 48px",
          fontSize: 18,
          fontWeight: 800,
          cursor: "pointer",
          fontFamily: "Fraunces, serif",
          letterSpacing: "0.04em",
          boxShadow: "0 4px 24px rgba(239,68,68,0.5)",
          minHeight: 48,
        }}
      >
        CLICK TO PLAY
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const cameraRef = useRef<BABYLON.UniversalCamera | null>(null);

  // Game state (React UI)
  const [uiState, setUiState] = useState<GameState>({
    hp: 100,
    maxHp: 100,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    wave: 1,
    kills: 0,
    totalKills: 0,
    phase: "playing",
    waveBreakTimer: WAVE_BREAK_DURATION,
  });
  const [reloading, setReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState(0);
  const [screen, setScreen] = useState<"start" | "game" | "dead">("start");
  const [highScore, setHighScore] = useState(() => {
    const s = localStorage.getItem("zombie_attack_highscore");
    return s ? parseInt(s, 10) || 0 : 0;
  });

  // Mutable game refs (no re-render needed)
  const gsRef = useRef<GameState>({
    hp: 100,
    maxHp: 100,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    wave: 1,
    kills: 0,
    totalKills: 0,
    phase: "playing",
    waveBreakTimer: WAVE_BREAK_DURATION,
  });
  const zombiesRef = useRef<Zombie[]>([]);
  const zombieIdRef = useRef(0);
  const reloadingRef = useRef(false);
  const reloadTimerRef = useRef(0);
  const playerPosRef = useRef(new BABYLON.Vector3(0, PLAYER_HEIGHT, 0));
  const keysRef = useRef<Record<string, boolean>>({});
  const lastTimeRef = useRef(0);
  const muzzleFlashRef = useRef<BABYLON.Mesh | null>(null);
  const muzzleFlashTimerRef = useRef(0);
  const screenRef = useRef<"start" | "game" | "dead">("start");
  const flashRef = useRef<HTMLDivElement | null>(null);
  const damageFlashTimerRef = useRef(0);

  // Sync screen ref
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ── Build / destroy Babylon scene ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
    });
    engineRef.current = engine;

    const scene = buildScene(engine, canvas);
    sceneRef.current = scene;

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build Scene ───────────────────────────────────────────────────────────
  function buildScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.05, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.025;
    scene.fogColor = new BABYLON.Color3(0.05, 0.08, 0.05);

    // ── Camera (FPS) ─────────────────────────────────────────────────────
    const camera = new BABYLON.UniversalCamera(
      "fpCam",
      new BABYLON.Vector3(0, PLAYER_HEIGHT, 0),
      scene
    );
    camera.setTarget(new BABYLON.Vector3(0, PLAYER_HEIGHT, 1));
    camera.minZ = 0.05;
    camera.maxZ = 200;
    camera.fov = 1.1;
    cameraRef.current = camera;

    // ── Lighting ──────────────────────────────────────────────────────────
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new BABYLON.Color3(0.5, 0.8, 0.5);
    hemi.groundColor = new BABYLON.Color3(0.05, 0.1, 0.05);

    const dirLight = new BABYLON.DirectionalLight(
      "dir",
      new BABYLON.Vector3(-0.5, -1, -0.3),
      scene
    );
    dirLight.intensity = 0.7;
    dirLight.diffuse = new BABYLON.Color3(0.9, 0.95, 0.7);

    // ── Ground ────────────────────────────────────────────────────────────
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: ARENA_SIZE, height: ARENA_SIZE, subdivisions: 8 },
      scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.18, 0.1);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;

    // ── Arena walls ───────────────────────────────────────────────────────
    buildWalls(scene);

    // ── Obstacles ─────────────────────────────────────────────────────────
    buildObstacles(scene);

    // ── Gun model (FP view) ───────────────────────────────────────────────
    buildGunModel(scene, camera);

    // ── Muzzle flash ──────────────────────────────────────────────────────
    const muzzleFlash = BABYLON.MeshBuilder.CreateSphere(
      "muzzle",
      { diameter: 0.18 },
      scene
    );
    const muzzleMat = new BABYLON.StandardMaterial("muzzleMat", scene);
    muzzleMat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.3);
    muzzleMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.2);
    muzzleFlash.material = muzzleMat;
    muzzleFlash.isVisible = false;
    muzzleFlashRef.current = muzzleFlash;

    // ── Input ─────────────────────────────────────────────────────────────
    setupInput(scene, canvas);

    // ── Game loop ─────────────────────────────────────────────────────────
    let lastT = performance.now();
    scene.onBeforeRenderObservable.add(() => {
      if (screenRef.current !== "game") return;
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      lastTimeRef.current = now;
      gameLoop(scene, dt);
    });

    return scene;
  }

  // ── Walls ─────────────────────────────────────────────────────────────────
  function buildWalls(scene: BABYLON.Scene) {
    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.18, 0.22, 0.16);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const h = 5;
    const half = ARENA_SIZE / 2;
    const wallDefs: Array<{ pos: BABYLON.Vector3; w: number; d: number }> = [
      { pos: new BABYLON.Vector3(0, h / 2, half), w: ARENA_SIZE, d: 0.6 },
      { pos: new BABYLON.Vector3(0, h / 2, -half), w: ARENA_SIZE, d: 0.6 },
      { pos: new BABYLON.Vector3(half, h / 2, 0), w: 0.6, d: ARENA_SIZE },
      { pos: new BABYLON.Vector3(-half, h / 2, 0), w: 0.6, d: ARENA_SIZE },
    ];
    wallDefs.forEach((def, i) => {
      const w = BABYLON.MeshBuilder.CreateBox(
        `wall${i}`,
        { width: def.w, height: h, depth: def.d },
        scene
      );
      w.position = def.pos;
      w.material = wallMat;
    });
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────
  function buildObstacles(scene: BABYLON.Scene) {
    const cratePositions = [
      [6, 4], [-6, 4], [6, -4], [-6, -4],
      [10, 10], [-10, 10], [10, -10], [-10, -10],
      [0, 8], [8, 0], [-8, 0], [0, -8],
    ];
    const crateMat = new BABYLON.StandardMaterial("crateMat", scene);
    crateMat.diffuseColor = new BABYLON.Color3(0.35, 0.27, 0.18);
    cratePositions.forEach(([x, z], i) => {
      const c = BABYLON.MeshBuilder.CreateBox(
        `crate${i}`,
        { width: 1.2, height: 1.2, depth: 1.2 },
        scene
      );
      c.position.set(x ?? 0, 0.6, z ?? 0);
      c.material = crateMat;
    });

    // Barrel clusters
    const barrelMat = new BABYLON.StandardMaterial("barrelMat", scene);
    barrelMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
    [[4, 12], [-4, 12], [4, -12], [-4, -12]].forEach(([x, z], i) => {
      const b = BABYLON.MeshBuilder.CreateCylinder(
        `barrel${i}`,
        { diameter: 0.7, height: 1.1, tessellation: 8 },
        scene
      );
      b.position.set(x ?? 0, 0.55, z ?? 0);
      b.material = barrelMat;
    });
  }

  // ── Gun model ─────────────────────────────────────────────────────────────
  function buildGunModel(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
    const gunRoot = new BABYLON.Mesh("gunRoot", scene);

    // Body
    const body = BABYLON.MeshBuilder.CreateBox(
      "gunBody",
      { width: 0.08, height: 0.1, depth: 0.38 },
      scene
    );
    const bodyMat = new BABYLON.StandardMaterial("gunBodyMat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    body.material = bodyMat;
    body.parent = gunRoot;
    body.position.set(0, 0, 0);

    // Barrel
    const barrel = BABYLON.MeshBuilder.CreateCylinder(
      "barrel",
      { diameter: 0.035, height: 0.28, tessellation: 8 },
      scene
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.material = bodyMat;
    barrel.parent = gunRoot;
    barrel.position.set(0, 0.02, 0.32);

    // Handle
    const handle = BABYLON.MeshBuilder.CreateBox(
      "handle",
      { width: 0.07, height: 0.14, depth: 0.07 },
      scene
    );
    const handleMat = new BABYLON.StandardMaterial("handleMat", scene);
    handleMat.diffuseColor = new BABYLON.Color3(0.22, 0.14, 0.08);
    handle.material = handleMat;
    handle.parent = gunRoot;
    handle.position.set(0, -0.1, -0.06);
    handle.rotation.x = 0.2;

    // Sight
    const sight = BABYLON.MeshBuilder.CreateBox(
      "sight",
      { width: 0.015, height: 0.025, depth: 0.015 },
      scene
    );
    sight.material = bodyMat;
    sight.parent = gunRoot;
    sight.position.set(0, 0.065, 0.14);

    // Position gun in FP view
    gunRoot.parent = camera;
    gunRoot.position.set(0.22, -0.2, 0.45);
    gunRoot.rotation.set(0.05, 0.04, 0);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function setupInput(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
    // Keyboard
    scene.onKeyboardObservable.add((info) => {
      const key = info.event.code.toLowerCase();
      if (info.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        keysRef.current[key] = true;
        if (key === "keyr") tryReload();
      } else {
        keysRef.current[key] = false;
      }
    });

    // Pointer lock for mouse look
    canvas.addEventListener("click", () => {
      if (screenRef.current === "game" && !document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      // pointer lock state changed
    });

    // Mouse move (pointer lock)
    document.addEventListener("mousemove", (e) => {
      if (
        screenRef.current !== "game" ||
        document.pointerLockElement !== canvas
      )
        return;
      const camera = cameraRef.current;
      if (!camera) return;
      const sens = 0.002;
      camera.rotation.y += e.movementX * sens;
      camera.rotation.x = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, camera.rotation.x + e.movementY * sens)
      );
    });

    // Shoot on click
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (screenRef.current !== "game") return;
      if (document.pointerLockElement !== canvas) return;
      tryShoot(scene);
    });

    // Touch shoot
    canvas.addEventListener("touchstart", (e) => {
      if (screenRef.current !== "game") return;
      e.preventDefault();
      tryShoot(scene);
    }, { passive: false });
  }

  // ── Shoot ──────────────────────────────────────────────────────────────────
  function tryShoot(scene: BABYLON.Scene) {
    const gs = gsRef.current;
    if (gs.phase !== "playing") return;
    if (reloadingRef.current) return;
    if (gs.ammo <= 0) {
      tryReload();
      return;
    }

    // Consume ammo
    gs.ammo -= 1;
    syncUi();

    // Muzzle flash
    const mf = muzzleFlashRef.current;
    const cam = cameraRef.current;
    if (mf && cam) {
      const fwd = cam.getForwardRay().direction;
      mf.position = cam.position.add(fwd.scale(0.5)).add(new BABYLON.Vector3(0.22, -0.15, 0));
      mf.isVisible = true;
      muzzleFlashTimerRef.current = 0.06;
    }

    // Raycast
    const camera = cameraRef.current;
    if (!camera) return;
    const ray = camera.getForwardRay(200);
    const hit = scene.pickWithRay(ray, (m) => m.name.startsWith("zbody_"));
    if (hit?.hit && hit.pickedMesh) {
      const id = parseInt(hit.pickedMesh.name.split("_")[1] ?? "0", 10);
      const zombie = zombiesRef.current.find((z) => z.id === id);
      if (zombie && !zombie.dead) {
        zombie.hp -= 1;
        if (zombie.hp <= 0) killZombie(zombie);
      }
    }

    // Auto-reload when empty
    if (gs.ammo === 0) tryReload();
  }

  // ── Reload ─────────────────────────────────────────────────────────────────
  function tryReload() {
    const gs = gsRef.current;
    if (reloadingRef.current) return;
    if (gs.ammo === gs.maxAmmo) return;
    reloadingRef.current = true;
    reloadTimerRef.current = 0;
    setReloading(true);
    setReloadProgress(0);
  }

  // ── Kill zombie ────────────────────────────────────────────────────────────
  function killZombie(zombie: Zombie) {
    zombie.dead = true;
    zombie.root.dispose();
    const gs = gsRef.current;
    gs.kills += 1;
    gs.totalKills += 1;
    syncUi();

    // Check wave cleared
    const alive = zombiesRef.current.filter((z) => !z.dead);
    if (alive.length === 0) {
      gs.wave += 1;
      gs.phase = "waveBreak";
      gs.waveBreakTimer = WAVE_BREAK_DURATION;
      syncUi();
    }
  }

  // ── Spawn wave ─────────────────────────────────────────────────────────────
  function spawnWave(scene: BABYLON.Scene) {
    const gs = gsRef.current;
    const count = 3 + (gs.wave - 1) * 2;
    zombiesRef.current = zombiesRef.current.filter((z) => !z.dead);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 14 + Math.random() * 6;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const zombie = createZombie(scene, new BABYLON.Vector3(x, 0, z), gs.wave);
      zombiesRef.current.push(zombie);
    }
  }

  // ── Create zombie ──────────────────────────────────────────────────────────
  function createZombie(
    scene: BABYLON.Scene,
    pos: BABYLON.Vector3,
    wave: number
  ): Zombie {
    const id = zombieIdRef.current++;
    const hp = ZOMBIE_BASE_HP + Math.floor(wave * 0.8);
    const speed = ZOMBIE_BASE_SPEED + wave * 0.003;

    // Materials
    const skinMat = new BABYLON.StandardMaterial(`zSkin${id}`, scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.28, 0.38, 0.22);

    const shirtMat = new BABYLON.StandardMaterial(`zShirt${id}`, scene);
    shirtMat.diffuseColor = new BABYLON.Color3(0.18, 0.22, 0.15);

    const pantsMat = new BABYLON.StandardMaterial(`zPants${id}`, scene);
    pantsMat.diffuseColor = new BABYLON.Color3(0.14, 0.16, 0.12);

    // Root
    const root = new BABYLON.Mesh(`zroot_${id}`, scene);
    root.position = pos.clone();
    root.position.y = 0;

    // Body (torso)
    const body = BABYLON.MeshBuilder.CreateBox(
      `zbody_${id}`,
      { width: 0.55, height: 0.7, depth: 0.3 },
      scene
    );
    body.material = shirtMat;
    body.parent = root;
    body.position.y = 1.05;

    // Head
    const head = BABYLON.MeshBuilder.CreateBox(
      `zhead_${id}`,
      { width: 0.38, height: 0.38, depth: 0.35 },
      scene
    );
    head.material = skinMat;
    head.parent = root;
    head.position.y = 1.65;

    // Eyes (red dots)
    const eyeMat = new BABYLON.StandardMaterial(`zEye${id}`, scene);
    eyeMat.diffuseColor = new BABYLON.Color3(1, 0.1, 0.1);
    eyeMat.emissiveColor = new BABYLON.Color3(0.8, 0, 0);
    [-0.1, 0.1].forEach((ex, ei) => {
      const eye = BABYLON.MeshBuilder.CreateSphere(
        `zeye${id}_${ei}`,
        { diameter: 0.06 },
        scene
      );
      eye.material = eyeMat;
      eye.parent = head;
      eye.position.set(ex, 0.04, 0.18);
    });

    // Left arm
    const leftArm = BABYLON.MeshBuilder.CreateBox(
      `zlarm_${id}`,
      { width: 0.16, height: 0.55, depth: 0.16 },
      scene
    );
    leftArm.material = shirtMat;
    leftArm.parent = root;
    leftArm.position.set(-0.37, 1.0, 0);

    // Right arm
    const rightArm = BABYLON.MeshBuilder.CreateBox(
      `zrarm_${id}`,
      { width: 0.16, height: 0.55, depth: 0.16 },
      scene
    );
    rightArm.material = shirtMat;
    rightArm.parent = root;
    rightArm.position.set(0.37, 1.0, 0);

    // Left leg
    const leftLeg = BABYLON.MeshBuilder.CreateBox(
      `zlleg_${id}`,
      { width: 0.2, height: 0.6, depth: 0.2 },
      scene
    );
    leftLeg.material = pantsMat;
    leftLeg.parent = root;
    leftLeg.position.set(-0.16, 0.4, 0);

    // Right leg
    const rightLeg = BABYLON.MeshBuilder.CreateBox(
      `zrleg_${id}`,
      { width: 0.2, height: 0.6, depth: 0.2 },
      scene
    );
    rightLeg.material = pantsMat;
    rightLeg.parent = root;
    rightLeg.position.set(0.16, 0.4, 0);

    return {
      id,
      root,
      body,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      hp,
      speed,
      animTime: Math.random() * Math.PI * 2,
      dead: false,
      attackCooldown: 0,
    };
  }

  // ── Sync UI ────────────────────────────────────────────────────────────────
  function syncUi() {
    setUiState({ ...gsRef.current });
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  function gameLoop(scene: BABYLON.Scene, dt: number) {
    const gs = gsRef.current;
    const camera = cameraRef.current;
    if (!camera) return;

    // Reload timer
    if (reloadingRef.current) {
      reloadTimerRef.current += dt;
      const prog = Math.min(reloadTimerRef.current / RELOAD_TIME, 1);
      setReloadProgress(prog);
      if (reloadTimerRef.current >= RELOAD_TIME) {
        reloadingRef.current = false;
        gs.ammo = gs.maxAmmo;
        setReloading(false);
        syncUi();
      }
    }

    // Muzzle flash
    if (muzzleFlashTimerRef.current > 0) {
      muzzleFlashTimerRef.current -= dt;
      if (muzzleFlashTimerRef.current <= 0 && muzzleFlashRef.current) {
        muzzleFlashRef.current.isVisible = false;
      }
    }

    // Damage flash
    if (damageFlashTimerRef.current > 0) {
      damageFlashTimerRef.current -= dt;
      if (flashRef.current) {
        const alpha = Math.min(damageFlashTimerRef.current / 0.3, 1) * 0.45;
        flashRef.current.style.opacity = String(alpha);
      }
    } else if (flashRef.current) {
      flashRef.current.style.opacity = "0";
    }

    // Wave break
    if (gs.phase === "waveBreak") {
      gs.waveBreakTimer -= dt;
      setUiState({ ...gs });
      if (gs.waveBreakTimer <= 0) {
        gs.phase = "playing";
        gs.kills = 0;
        spawnWave(scene);
        syncUi();
      }
      return;
    }

    if (gs.phase !== "playing") return;

    // ── Player movement ─────────────────────────────────────────────────
    const keys = keysRef.current;
    const yaw = camera.rotation.y;
    const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    let moveDir = BABYLON.Vector3.Zero();
    if (keys["keyw"] || keys["arrowup"]) moveDir = moveDir.add(fwd);
    if (keys["keys"] || keys["arrowdown"]) moveDir = moveDir.subtract(fwd);
    if (keys["keyd"] || keys["arrowright"]) moveDir = moveDir.add(right);
    if (keys["keya"] || keys["arrowleft"]) moveDir = moveDir.subtract(right);

    if (moveDir.lengthSquared() > 0) {
      moveDir.normalize().scaleInPlace(PLAYER_SPEED);
      const newPos = camera.position.add(moveDir);
      // Clamp to arena
      const half = ARENA_SIZE / 2 - 0.8;
      newPos.x = Math.max(-half, Math.min(half, newPos.x));
      newPos.z = Math.max(-half, Math.min(half, newPos.z));
      newPos.y = PLAYER_HEIGHT;
      camera.position = newPos;
      playerPosRef.current = newPos;
    } else {
      playerPosRef.current = camera.position.clone();
    }

    // ── Zombie AI ───────────────────────────────────────────────────────
    const playerPos = playerPosRef.current;
    const aliveZombies = zombiesRef.current.filter((z) => !z.dead);

    for (const zombie of aliveZombies) {
      const zPos = zombie.root.position;
      const toPlayer = playerPos.subtract(zPos);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      // Face player
      if (dist > 0.01) {
        const angle = Math.atan2(toPlayer.x, toPlayer.z);
        zombie.root.rotation.y = angle;
      }

      // Move toward player
      if (dist > ATTACK_RANGE) {
        const dir = toPlayer.normalize();
        zombie.root.position.addInPlace(dir.scale(zombie.speed));
        // Clamp to arena
        const half = ARENA_SIZE / 2 - 0.5;
        zombie.root.position.x = Math.max(-half, Math.min(half, zombie.root.position.x));
        zombie.root.position.z = Math.max(-half, Math.min(half, zombie.root.position.z));
      }

      // Walk animation
      zombie.animTime += dt * 6;
      const swing = Math.sin(zombie.animTime) * 0.5;
      zombie.leftArm.rotation.x = swing;
      zombie.rightArm.rotation.x = -swing;
      zombie.leftLeg.rotation.x = -swing * 0.7;
      zombie.rightLeg.rotation.x = swing * 0.7;
      // Zombie lurch
      zombie.head.rotation.x = 0.25 + Math.sin(zombie.animTime * 0.5) * 0.08;
      zombie.root.position.y = Math.abs(Math.sin(zombie.animTime)) * 0.04;

      // Attack
      if (dist <= ATTACK_RANGE) {
        zombie.attackCooldown -= dt;
        if (zombie.attackCooldown <= 0) {
          zombie.attackCooldown = ATTACK_COOLDOWN;
          gs.hp -= ATTACK_DAMAGE;
          damageFlashTimerRef.current = 0.35;
          if (gs.hp <= 0) {
            gs.hp = 0;
            gs.phase = "dead";
            const newHs = Math.max(highScore, gs.totalKills);
            setHighScore(newHs);
            localStorage.setItem("zombie_attack_highscore", String(newHs));
            setScreen("dead");
            document.exitPointerLock();
          }
          syncUi();
        }
      }
    }
  }

  // ── Start / Restart ────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    // Clear zombies
    zombiesRef.current.forEach((z) => {
      if (!z.dead) z.root.dispose();
    });
    zombiesRef.current = [];
    zombieIdRef.current = 0;

    // Reset camera
    camera.position = new BABYLON.Vector3(0, PLAYER_HEIGHT, 0);
    camera.rotation = new BABYLON.Vector3(0, 0, 0);

    // Reset state
    const fresh: GameState = {
      hp: 100,
      maxHp: 100,
      ammo: MAX_AMMO,
      maxAmmo: MAX_AMMO,
      wave: 1,
      kills: 0,
      totalKills: 0,
      phase: "playing",
      waveBreakTimer: WAVE_BREAK_DURATION,
    };
    gsRef.current = fresh;
    reloadingRef.current = false;
    reloadTimerRef.current = 0;
    setReloading(false);
    setReloadProgress(0);
    setUiState({ ...fresh });
    setScreen("game");
    screenRef.current = "game";

    // Spawn wave 1
    spawnWave(scene);

    // Request pointer lock
    setTimeout(() => canvasRef.current?.requestPointerLock(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Damage flash overlay */}
        <div
          ref={flashRef}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(220,30,30,1)",
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 0.05s",
          }}
        />

        {/* HUD */}
        {screen === "game" && (
          <Hud
            state={uiState}
            reloading={reloading}
            reloadProgress={reloadProgress}
            highScore={highScore}
          />
        )}

        {/* Start screen */}
        {screen === "start" && (
          <StartScreen onStart={startGame} highScore={highScore} />
        )}

        {/* Game over screen */}
        {screen === "dead" && (
          <GameOverScreen
            kills={uiState.totalKills}
            wave={uiState.wave}
            highScore={highScore}
            onRestart={startGame}
          />
        )}
      </div>
    </Shell>
  );
}
