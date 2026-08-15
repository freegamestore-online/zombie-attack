import { useRef, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import * as BABYLON from "@babylonjs/core";

// ─── Constants ────────────────────────────────────────────────────────────────
const ARENA = 44;
const PLAYER_HEIGHT = 1.72;
const PLAYER_SPEED = 0.13;
const MOUSE_SENS = 0.0022;
const MAX_HP = 100;
const MAX_AMMO = 12;
const RELOAD_TIME = 1.8;
const ZOMBIE_ATTACK_RANGE = 1.8;
const ZOMBIE_ATTACK_DAMAGE = 10;
const ZOMBIE_ATTACK_COOLDOWN = 1.1;
const WAVE_BREAK = 4.0;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ZombieEntity {
  id: number;
  root: BABYLON.Mesh;
  body: BABYLON.Mesh;
  head: BABYLON.Mesh;
  lArm: BABYLON.Mesh;
  rArm: BABYLON.Mesh;
  lLeg: BABYLON.Mesh;
  rLeg: BABYLON.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  animT: number;
  dead: boolean;
  atkCd: number;
}

interface UIState {
  hp: number;
  ammo: number;
  wave: number;
  kills: number;
  phase: "playing" | "waveBreak" | "dead";
  waveTimer: number;
  reloading: boolean;
  reloadPct: number;
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function Hud({ ui, best, locked }: { ui: UIState; best: number; locked: boolean }) {
  const hpPct = (ui.hp / MAX_HP) * 100;
  const hpCol = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: "Manrope,sans-serif" }}>
      {/* Crosshair */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22 }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "rgba(255,255,255,.82)", marginTop: -1 }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,.82)", marginLeft: -1 }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 6, height: 6, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.5)", transform: "translate(-50%,-50%)" }} />
      </div>

      {/* "How to shoot" tip — top left, fades when pointer is locked */}
      {!locked && (
        <div style={{
          position: "absolute", top: 14, left: 22,
          background: "rgba(0,0,0,.65)", borderRadius: 8,
          padding: "8px 14px", border: "1px solid rgba(255,255,255,.18)",
          maxWidth: 260,
        }}>
          <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
            🖱️ Click the screen to aim &amp; shoot
          </div>
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: 11, lineHeight: 1.5 }}>
            Left-click locks your mouse. Then aim with the mouse and <strong style={{ color: "#fff" }}>left-click to fire</strong>. Press <strong style={{ color: "#fff" }}>Esc</strong> to release.
          </div>
        </div>
      )}

      {/* Health — bottom left */}
      <div style={{ position: "absolute", bottom: 28, left: 24 }}>
        <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>❤ HEALTH</div>
        <div style={{ width: 170, height: 13, background: "rgba(0,0,0,.55)", borderRadius: 7, border: "1px solid rgba(255,255,255,.15)", overflow: "hidden" }}>
          <div style={{ width: `${hpPct}%`, height: "100%", background: hpCol, borderRadius: 7, transition: "width .15s,background .3s" }} />
        </div>
        <div style={{ color: hpCol, fontSize: 11, fontWeight: 700, marginTop: 3, textShadow: "0 1px 4px #000" }}>{ui.hp} / {MAX_HP}</div>
      </div>

      {/* Ammo — bottom right */}
      <div style={{ position: "absolute", bottom: 28, right: 24, textAlign: "right" }}>
        {ui.reloading ? (
          <>
            <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, textShadow: "0 1px 4px #000", marginBottom: 4 }}>RELOADING…</div>
            <div style={{ width: 110, height: 6, background: "rgba(0,0,0,.55)", borderRadius: 3, overflow: "hidden", marginLeft: "auto" }}>
              <div style={{ width: `${ui.reloadPct * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 3, transition: "width .05s" }} />
            </div>
          </>
        ) : (
          <div style={{ color: ui.ammo === 0 ? "#ef4444" : "#fff", fontSize: 30, fontWeight: 800, textShadow: "0 2px 8px #000", fontFamily: "Fraunces,serif", lineHeight: 1 }}>
            {ui.ammo}<span style={{ fontSize: 14, color: "rgba(255,255,255,.45)" }}> / {MAX_AMMO}</span>
          </div>
        )}
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginTop: 3 }}>🔫 AMMO · [R] reload</div>
      </div>

      {/* Wave / kills — top right */}
      <div style={{ position: "absolute", top: 14, right: 22, textAlign: "right" }}>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "Fraunces,serif", textShadow: "0 2px 8px #000" }}>WAVE {ui.wave}</div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12, fontWeight: 600 }}>Kills {ui.kills} · Best {best}</div>
      </div>

      {/* Wave-break overlay */}
      {ui.phase === "waveBreak" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.42)" }}>
          <div style={{ color: "#22c55e", fontSize: 42, fontWeight: 800, fontFamily: "Fraunces,serif", textShadow: "0 4px 24px #000" }}>Wave {ui.wave - 1} Cleared!</div>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 16, marginTop: 10, fontWeight: 600 }}>Next wave in {Math.ceil(ui.waveTimer)}s…</div>
        </div>
      )}
    </div>
  );
}

// ─── Game-Over Screen ─────────────────────────────────────────────────────────
function GameOver({ kills, wave, best, onRestart }: { kills: number; wave: number; best: number; onRestart: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.8)", fontFamily: "Manrope,sans-serif" }}>
      <div style={{ color: "#ef4444", fontSize: 56, fontWeight: 800, fontFamily: "Fraunces,serif", textShadow: "0 4px 32px #000", marginBottom: 8 }}>YOU DIED</div>
      <div style={{ color: "rgba(255,255,255,.7)", fontSize: 17, marginBottom: 4 }}>Survived to <strong style={{ color: "#fff" }}>Wave {wave}</strong></div>
      <div style={{ color: "rgba(255,255,255,.7)", fontSize: 17, marginBottom: 4 }}>Kills: <strong style={{ color: "#f59e0b" }}>{kills}</strong></div>
      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, marginBottom: 36 }}>Best: {best} kills</div>
      <button onClick={onRestart} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "14px 52px", fontSize: 19, fontWeight: 800, cursor: "pointer", fontFamily: "Fraunces,serif", boxShadow: "0 4px 24px rgba(239,68,68,.5)", minHeight: 52 }}>PLAY AGAIN</button>
    </div>
  );
}

// ─── Start Screen ─────────────────────────────────────────────────────────────
function StartScreen({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.75)", fontFamily: "Manrope,sans-serif" }}>
      <div style={{ color: "#ef4444", fontSize: 54, fontWeight: 800, fontFamily: "Fraunces,serif", textShadow: "0 4px 32px #000", marginBottom: 12 }}>🧟 ZOMBIE ATTACK</div>

      {/* Controls grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18, maxWidth: 360, width: "100%" }}>
        {[
          { key: "🖱️ Left Click", desc: "Shoot" },
          { key: "🖱️ Mouse Move", desc: "Aim" },
          { key: "WASD", desc: "Move" },
          { key: "R", desc: "Reload" },
        ].map(({ key, desc }) => (
          <div key={key} style={{ background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(255,255,255,.14)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: "rgba(239,68,68,.25)", color: "#f87171", fontWeight: 800, fontSize: 12, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{key}</span>
            <span style={{ color: "rgba(255,255,255,.75)", fontSize: 13 }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Prominent shoot callout */}
      <div style={{
        background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.45)",
        borderRadius: 10, padding: "10px 20px", marginBottom: 22, maxWidth: 340, textAlign: "center",
      }}>
        <span style={{ color: "#fca5a5", fontSize: 14, fontWeight: 700 }}>
          🔫 Click the screen to lock your mouse, then <strong style={{ color: "#fff" }}>left-click to shoot</strong> zombies. Press <strong style={{ color: "#fff" }}>Esc</strong> to release the mouse.
        </span>
      </div>

      {best > 0 && <div style={{ color: "#f59e0b", fontSize: 14, marginBottom: 18, fontWeight: 700 }}>🏆 Best: {best} kills</div>}
      <button onClick={onStart} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "14px 52px", fontSize: 19, fontWeight: 800, cursor: "pointer", fontFamily: "Fraunces,serif", boxShadow: "0 4px 24px rgba(239,68,68,.5)", minHeight: 52 }}>CLICK TO PLAY</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── React UI state ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<"start" | "game" | "dead">("start");
  const [ui, setUi] = useState<UIState>({ hp: MAX_HP, ammo: MAX_AMMO, wave: 1, kills: 0, phase: "playing", waveTimer: WAVE_BREAK, reloading: false, reloadPct: 0 });
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("za_best") ?? "0", 10) || 0);
  const [pointerLocked, setPointerLocked] = useState(false);

  // ── Mutable game state refs (no re-render) ──────────────────────────────────
  const screenRef = useRef<"start" | "game" | "dead">("start");
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const cameraRef = useRef<BABYLON.UniversalCamera | null>(null);

  // game state
  const hp = useRef(MAX_HP);
  const ammo = useRef(MAX_AMMO);
  const wave = useRef(1);
  const kills = useRef(0);
  const phase = useRef<"playing" | "waveBreak" | "dead">("playing");
  const waveTimer = useRef(WAVE_BREAK);
  const reloading = useRef(false);
  const reloadTimer = useRef(0);
  const zombieId = useRef(0);
  const zombies = useRef<ZombieEntity[]>([]);
  const keys = useRef<Record<string, boolean>>({});
  const muzzleFlash = useRef<BABYLON.Mesh | null>(null);
  const muzzleTimer = useRef(0);
  const damageFlashTimer = useRef(0);
  const gunRoot = useRef<BABYLON.Mesh | null>(null);
  const gunBobT = useRef(0);

  // sync screen ref
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // track pointer lock state for HUD tip
  useEffect(() => {
    const onChange = () => setPointerLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  // ── Push UI state ────────────────────────────────────────────────────────────
  function pushUi() {
    setUi({
      hp: hp.current,
      ammo: ammo.current,
      wave: wave.current,
      kills: kills.current,
      phase: phase.current,
      waveTimer: waveTimer.current,
      reloading: reloading.current,
      reloadPct: reloading.current ? Math.min(1, (RELOAD_TIME - reloadTimer.current) / RELOAD_TIME) : 0,
    });
  }

  // ── Build Babylon scene (once) ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    // Sky / fog
    scene.clearColor = new BABYLON.Color4(0.04, 0.06, 0.04, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.022;
    scene.fogColor = new BABYLON.Color3(0.04, 0.07, 0.04);

    // Camera
    const cam = new BABYLON.UniversalCamera("fp", new BABYLON.Vector3(0, PLAYER_HEIGHT, 0), scene);
    cam.setTarget(new BABYLON.Vector3(0, PLAYER_HEIGHT, 1));
    cam.minZ = 0.04;
    cam.maxZ = 220;
    cam.fov = 1.08;
    cameraRef.current = cam;

    // Lighting
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.5;
    hemi.diffuse = new BABYLON.Color3(0.45, 0.75, 0.45);
    hemi.groundColor = new BABYLON.Color3(0.04, 0.08, 0.04);
    const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.4, -1, -0.3), scene);
    dir.intensity = 0.65;
    dir.diffuse = new BABYLON.Color3(0.85, 0.95, 0.65);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: ARENA, height: ARENA, subdivisions: 6 }, scene);
    const gm = new BABYLON.StandardMaterial("gm", scene);
    gm.diffuseColor = new BABYLON.Color3(0.1, 0.16, 0.08);
    gm.specularColor = BABYLON.Color3.Black();
    ground.material = gm;

    // Walls
    buildWalls(scene);
    // Obstacles
    buildObstacles(scene);
    // Gun
    buildGun(scene, cam);
    // Muzzle flash
    const mf = BABYLON.MeshBuilder.CreateSphere("mf", { diameter: 0.22, segments: 5 }, scene);
    const mfm = new BABYLON.StandardMaterial("mfm", scene);
    mfm.diffuseColor = new BABYLON.Color3(1, 0.9, 0.3);
    mfm.emissiveColor = new BABYLON.Color3(1, 0.75, 0.1);
    mf.material = mfm;
    mf.isVisible = false;
    muzzleFlash.current = mf;

    // Input
    setupInput(scene, canvas);

    // Render loop
    let lastT = performance.now();
    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      if (screenRef.current === "game") tick(scene, dt);
    });

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); engine.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Walls ─────────────────────────────────────────────────────────────────
  function buildWalls(scene: BABYLON.Scene) {
    const wm = new BABYLON.StandardMaterial("wm", scene);
    wm.diffuseColor = new BABYLON.Color3(0.16, 0.2, 0.14);
    wm.specularColor = BABYLON.Color3.Black();
    const H = 6, half = ARENA / 2;
    const defs = [
      { pos: [0, H / 2, half] as [number, number, number], w: ARENA + 1.2, d: 0.7 },
      { pos: [0, H / 2, -half] as [number, number, number], w: ARENA + 1.2, d: 0.7 },
      { pos: [half, H / 2, 0] as [number, number, number], w: 0.7, d: ARENA },
      { pos: [-half, H / 2, 0] as [number, number, number], w: 0.7, d: ARENA },
    ];
    defs.forEach((d, i) => {
      const w = BABYLON.MeshBuilder.CreateBox(`wall${i}`, { width: d.w, height: H, depth: d.d }, scene);
      w.position.set(...d.pos);
      w.material = wm;
    });
  }

  // ── Obstacles ──────────────────────────────────────────────────────────────
  function buildObstacles(scene: BABYLON.Scene) {
    const cm = new BABYLON.StandardMaterial("cm", scene);
    cm.diffuseColor = new BABYLON.Color3(0.32, 0.24, 0.16);
    const bm = new BABYLON.StandardMaterial("bm", scene);
    bm.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.2);

    const cratePos: [number, number][] = [
      [6, 4], [-6, 4], [6, -4], [-6, -4],
      [11, 11], [-11, 11], [11, -11], [-11, -11],
      [0, 8], [8, 0], [-8, 0], [0, -8],
      [14, 0], [-14, 0], [0, 14], [0, -14],
    ];
    cratePos.forEach(([x, z], i) => {
      const c = BABYLON.MeshBuilder.CreateBox(`c${i}`, { width: 1.3, height: 1.3, depth: 1.3 }, scene);
      c.position.set(x, 0.65, z);
      c.material = cm;
    });

    const barrelPos: [number, number][] = [[4, 12], [-4, 12], [4, -12], [-4, -12], [12, 4], [-12, 4], [12, -4], [-12, -4]];
    barrelPos.forEach(([x, z], i) => {
      const b = BABYLON.MeshBuilder.CreateCylinder(`b${i}`, { diameter: 0.75, height: 1.1, tessellation: 8 }, scene);
      b.position.set(x, 0.55, z);
      b.material = bm;
    });
  }

  // ── Gun model ──────────────────────────────────────────────────────────────
  function buildGun(scene: BABYLON.Scene, cam: BABYLON.UniversalCamera) {
    const root = new BABYLON.Mesh("gunRoot", scene);
    const dark = new BABYLON.StandardMaterial("gd", scene);
    dark.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.11);
    dark.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    const wood = new BABYLON.StandardMaterial("gw", scene);
    wood.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.08);

    const body = BABYLON.MeshBuilder.CreateBox("gbody", { width: 0.085, height: 0.1, depth: 0.38 }, scene);
    body.material = dark; body.parent = root; body.position.set(0, 0, 0);

    const barrel = BABYLON.MeshBuilder.CreateCylinder("gbarrel", { diameter: 0.036, height: 0.3, tessellation: 8 }, scene);
    barrel.rotation.x = Math.PI / 2; barrel.material = dark; barrel.parent = root; barrel.position.set(0, 0.018, 0.33);

    const shroud = BABYLON.MeshBuilder.CreateCylinder("gshroud", { diameter: 0.055, height: 0.18, tessellation: 8 }, scene);
    shroud.rotation.x = Math.PI / 2; shroud.material = dark; shroud.parent = root; shroud.position.set(0, 0.018, 0.28);

    const grip = BABYLON.MeshBuilder.CreateBox("ggrip", { width: 0.072, height: 0.15, depth: 0.075 }, scene);
    grip.material = wood; grip.parent = root; grip.position.set(0, -0.11, -0.06); grip.rotation.x = 0.22;

    const tg = BABYLON.MeshBuilder.CreateTorus("gtg", { diameter: 0.06, thickness: 0.012, tessellation: 8 }, scene);
    tg.material = dark; tg.parent = root; tg.position.set(0, -0.045, 0.02); tg.rotation.x = Math.PI / 2;

    const sightR = BABYLON.MeshBuilder.CreateBox("gsr", { width: 0.022, height: 0.028, depth: 0.012 }, scene);
    sightR.material = dark; sightR.parent = root; sightR.position.set(0, 0.066, -0.06);

    const sightF = BABYLON.MeshBuilder.CreateBox("gsf", { width: 0.012, height: 0.024, depth: 0.012 }, scene);
    sightF.material = dark; sightF.parent = root; sightF.position.set(0, 0.066, 0.16);

    const mag = BABYLON.MeshBuilder.CreateBox("gmag", { width: 0.065, height: 0.1, depth: 0.055 }, scene);
    mag.material = dark; mag.parent = root; mag.position.set(0, -0.075, 0.0);

    root.parent = cam;
    root.position.set(0.21, -0.19, 0.44);
    root.rotation.set(0.04, 0.03, 0);
    gunRoot.current = root;
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function setupInput(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
    scene.onKeyboardObservable.add((info) => {
      const k = info.event.code;
      if (info.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        keys.current[k] = true;
        if (k === "KeyR") startReload();
      } else {
        keys.current[k] = false;
      }
    });

    canvas.addEventListener("click", () => {
      if (screenRef.current === "game" && !document.pointerLockElement) canvas.requestPointerLock();
    });

    document.addEventListener("mousemove", (e) => {
      if (screenRef.current !== "game" || document.pointerLockElement !== canvas) return;
      const cam = cameraRef.current;
      if (!cam) return;
      cam.rotation.y += e.movementX * MOUSE_SENS;
      cam.rotation.x = Math.max(-1.35, Math.min(1.35, cam.rotation.x + e.movementY * MOUSE_SENS));
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || screenRef.current !== "game" || document.pointerLockElement !== canvas) return;
      shoot(scene);
    });

    // Touch look + shoot
    let lastTouch: Touch | null = null;
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (screenRef.current !== "game") return;
      lastTouch = e.touches[0] ?? null;
      shoot(scene);
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (screenRef.current !== "game") return;
      const t = e.touches[0];
      if (!t || !lastTouch) return;
      const cam = cameraRef.current;
      if (!cam) return;
      cam.rotation.y += (t.clientX - lastTouch.clientX) * MOUSE_SENS * 0.6;
      cam.rotation.x = Math.max(-1.35, Math.min(1.35, cam.rotation.x + (t.clientY - lastTouch.clientY) * MOUSE_SENS * 0.6));
      lastTouch = t;
    }, { passive: false });
  }

  // ── Shoot ──────────────────────────────────────────────────────────────────
  function shoot(scene: BABYLON.Scene) {
    if (phase.current !== "playing") return;
    if (reloading.current) return;
    if (ammo.current <= 0) { startReload(); return; }

    ammo.current -= 1;

    const cam = cameraRef.current;
    const mf = muzzleFlash.current;
    if (cam && mf) {
      const fwd = cam.getForwardRay().direction;
      mf.position = cam.position.add(fwd.scale(0.55)).add(new BABYLON.Vector3(0.2, -0.12, 0));
      mf.isVisible = true;
      muzzleTimer.current = 0.06;
    }

    if (gunRoot.current) {
      gunRoot.current.position.z -= 0.04;
      gunRoot.current.rotation.x += 0.06;
    }

    if (cam) {
      const ray = cam.getForwardRay(200);
      const hit = scene.pickWithRay(ray, (m) => m.name.startsWith("zbody_"));
      if (hit?.hit && hit.pickedMesh) {
        const id = parseInt(hit.pickedMesh.name.split("_")[1] ?? "-1", 10);
        const z = zombies.current.find((z) => z.id === id);
        if (z && !z.dead) {
          z.hp -= 1;
          if (z.hp <= 0) killZombie(z);
        }
      }
    }

    if (ammo.current === 0) startReload();
    pushUi();
  }

  // ── Reload ─────────────────────────────────────────────────────────────────
  function startReload() {
    if (reloading.current || ammo.current === MAX_AMMO) return;
    reloading.current = true;
    reloadTimer.current = RELOAD_TIME;
    pushUi();
  }

  // ── Kill zombie ─────────────────────────────────────────────────────────────
  function killZombie(z: ZombieEntity) {
    z.dead = true;
    kills.current += 1;
    z.root.position.y = -0.6;
    z.body.rotation.x = Math.PI / 2;
    setTimeout(() => { z.root.dispose(); }, 2200);
    pushUi();
  }

  // ── Spawn wave ─────────────────────────────────────────────────────────────
  function spawnWave(scene: BABYLON.Scene) {
    const waveNum = wave.current;
    const count = 3 + waveNum * 2;
    const baseHp = ZOMBIE_BASE_HP(waveNum);
    const baseSpeed = ZOMBIE_BASE_SPEED(waveNum);
    const half = ARENA / 2 - 2;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = half * (0.7 + Math.random() * 0.28);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      spawnZombie(scene, x, z, baseHp, baseSpeed + (Math.random() - 0.5) * 0.01);
    }
  }

  function spawnZombie(scene: BABYLON.Scene, x: number, z: number, hp: number, speed: number) {
    const id = zombieId.current++;
    const root = new BABYLON.Mesh(`zroot_${id}`, scene);
    root.position.set(x, 0, z);

    const skinMat = new BABYLON.StandardMaterial(`zsk_${id}`, scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.28, 0.38, 0.18);
    const clothMat = new BABYLON.StandardMaterial(`zcl_${id}`, scene);
    clothMat.diffuseColor = new BABYLON.Color3(0.18, 0.22, 0.15);
    const eyeMat = new BABYLON.StandardMaterial(`ze_${id}`, scene);
    eyeMat.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.1);
    eyeMat.emissiveColor = new BABYLON.Color3(0.6, 0.0, 0.0);

    const body = BABYLON.MeshBuilder.CreateBox(`zbody_${id}`, { width: 0.55, height: 0.7, depth: 0.3 }, scene);
    body.material = clothMat; body.parent = root; body.position.set(0, 1.15, 0);

    const head = BABYLON.MeshBuilder.CreateBox(`zhead_${id}`, { width: 0.38, height: 0.38, depth: 0.36 }, scene);
    head.material = skinMat; head.parent = root; head.position.set(0, 1.72, 0);

    const eyeL = BABYLON.MeshBuilder.CreateSphere(`zel_${id}`, { diameter: 0.08, segments: 4 }, scene);
    eyeL.material = eyeMat; eyeL.parent = head; eyeL.position.set(-0.1, 0.04, 0.19);
    const eyeR = BABYLON.MeshBuilder.CreateSphere(`zer_${id}`, { diameter: 0.08, segments: 4 }, scene);
    eyeR.material = eyeMat; eyeR.parent = head; eyeR.position.set(0.1, 0.04, 0.19);

    const lArm = BABYLON.MeshBuilder.CreateBox(`zla_${id}`, { width: 0.18, height: 0.58, depth: 0.18 }, scene);
    lArm.material = skinMat; lArm.parent = root; lArm.position.set(-0.38, 1.12, 0);
    const rArm = BABYLON.MeshBuilder.CreateBox(`zra_${id}`, { width: 0.18, height: 0.58, depth: 0.18 }, scene);
    rArm.material = skinMat; rArm.parent = root; rArm.position.set(0.38, 1.12, 0);

    const lLeg = BABYLON.MeshBuilder.CreateBox(`zll_${id}`, { width: 0.2, height: 0.62, depth: 0.2 }, scene);
    lLeg.material = clothMat; lLeg.parent = root; lLeg.position.set(-0.16, 0.5, 0);
    const rLeg = BABYLON.MeshBuilder.CreateBox(`zrl_${id}`, { width: 0.2, height: 0.62, depth: 0.2 }, scene);
    rLeg.material = clothMat; rLeg.parent = root; rLeg.position.set(0.16, 0.5, 0);

    zombies.current.push({ id, root, body, head, lArm, rArm, lLeg, rLeg, hp, maxHp: hp, speed, animT: Math.random() * Math.PI * 2, dead: false, atkCd: 0 });
  }

  // ── Main tick ──────────────────────────────────────────────────────────────
  function tick(scene: BABYLON.Scene, dt: number) {
    const gs = phase.current;

    // Reload timer
    if (reloading.current) {
      reloadTimer.current -= dt;
      if (reloadTimer.current <= 0) {
        reloading.current = false;
        ammo.current = MAX_AMMO;
        pushUi();
      }
    }

    // Muzzle flash
    if (muzzleTimer.current > 0) {
      muzzleTimer.current -= dt;
      if (muzzleTimer.current <= 0 && muzzleFlash.current) muzzleFlash.current.isVisible = false;
    }

    // Damage flash
    if (damageFlashTimer.current > 0) {
      damageFlashTimer.current -= dt;
      if (overlayRef.current) {
        overlayRef.current.style.opacity = String(Math.max(0, damageFlashTimer.current / 0.35));
      }
    }

    // Gun bob return
    if (gunRoot.current) {
      const gr = gunRoot.current;
      gr.position.z += (0.44 - gr.position.z) * 0.18;
      gr.rotation.x += (0.04 - gr.rotation.x) * 0.18;
    }

    if (gs === "waveBreak") {
      waveTimer.current -= dt;
      if (waveTimer.current <= 0) {
        phase.current = "playing";
        spawnWave(scene);
      }
      pushUi();
      return;
    }

    if (gs !== "playing") return;

    // ── Player movement ──────────────────────────────────────────────────────
    const cam = cameraRef.current;
    if (cam) {
      const yaw = cam.rotation.y;
      const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      let move = BABYLON.Vector3.Zero();
      if (keys.current["KeyW"]) move = move.add(fwd);
      if (keys.current["KeyS"]) move = move.subtract(fwd);
      if (keys.current["KeyA"]) move = move.subtract(right);
      if (keys.current["KeyD"]) move = move.add(right);

      const moving = move.lengthSquared() > 0;
      if (moving) {
        move.normalize().scaleInPlace(PLAYER_SPEED);
        const np = cam.position.add(move);
        const half = ARENA / 2 - 0.5;
        np.x = Math.max(-half, Math.min(half, np.x));
        np.z = Math.max(-half, Math.min(half, np.z));
        cam.position = np;
        cam.position.y = PLAYER_HEIGHT;

        // Gun bob
        gunBobT.current += dt * 9;
        if (gunRoot.current) {
          gunRoot.current.position.y = -0.19 + Math.sin(gunBobT.current) * 0.012;
          gunRoot.current.position.x = 0.21 + Math.sin(gunBobT.current * 0.5) * 0.006;
        }
      }
    }

    // ── Zombie AI ────────────────────────────────────────────────────────────
    const playerPos = cam ? cam.position : new BABYLON.Vector3(0, PLAYER_HEIGHT, 0);
    let uiDirty = false;

    zombies.current = zombies.current.filter((z) => {
      if (z.dead) return !z.root.isDisposed();
      if (z.root.isDisposed()) return false;

      const dx = playerPos.x - z.root.position.x;
      const dz = playerPos.z - z.root.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Rotate toward player
      z.root.rotation.y = Math.atan2(dx, dz);

      if (dist > ZOMBIE_ATTACK_RANGE) {
        // Move toward player
        const nx = dx / dist;
        const nz = dz / dist;
        z.root.position.x += nx * z.speed;
        z.root.position.z += nz * z.speed;
      } else {
        // Attack
        z.atkCd -= dt;
        if (z.atkCd <= 0) {
          z.atkCd = ZOMBIE_ATTACK_COOLDOWN;
          hp.current = Math.max(0, hp.current - ZOMBIE_ATTACK_DAMAGE);
          damageFlashTimer.current = 0.35;
          if (overlayRef.current) overlayRef.current.style.opacity = "1";
          uiDirty = true;
          if (hp.current <= 0) {
            phase.current = "dead";
            const finalKills = kills.current;
            if (finalKills > best) {
              setBest(finalKills);
              localStorage.setItem("za_best", String(finalKills));
            }
            if (document.pointerLockElement) document.exitPointerLock();
            setScreen("dead");
          }
        }
      }

      // Animate limbs
      z.animT += dt * 5 * (z.speed / ZOMBIE_BASE_SPEED(wave.current));
      const swing = Math.sin(z.animT) * 0.55;
      z.lArm.rotation.x = swing + 0.6;
      z.rArm.rotation.x = -swing + 0.6;
      z.lLeg.rotation.x = -swing * 0.7;
      z.rLeg.rotation.x = swing * 0.7;
      z.head.rotation.x = Math.sin(z.animT * 0.4) * 0.08;

      return true;
    });

    // ── Wave clear check ─────────────────────────────────────────────────────
    const alive = zombies.current.filter((z) => !z.dead).length;
    if (alive === 0 && gs === "playing") {
      wave.current += 1;
      phase.current = "waveBreak";
      waveTimer.current = WAVE_BREAK;
      uiDirty = true;
    }

    if (uiDirty) pushUi();
  }

  // ── Start / restart game ──────────────────────────────────────────────────
  function startGame() {
    // Reset mutable state
    hp.current = MAX_HP;
    ammo.current = MAX_AMMO;
    wave.current = 1;
    kills.current = 0;
    phase.current = "playing";
    waveTimer.current = WAVE_BREAK;
    reloading.current = false;
    reloadTimer.current = 0;
    gunBobT.current = 0;

    // Clear existing zombies
    zombies.current.forEach((z) => { if (!z.root.isDisposed()) z.root.dispose(); });
    zombies.current = [];
    zombieId.current = 0;

    // Reset camera
    const cam = cameraRef.current;
    if (cam) {
      cam.position.set(0, PLAYER_HEIGHT, 0);
      cam.rotation.set(0, 0, 0);
    }

    pushUi();
    setScreen("game");

    // Request pointer lock
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.requestPointerLock();
    }, 100);

    // Spawn first wave
    const scene = sceneRef.current;
    if (scene) spawnWave(scene);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Damage flash overlay */}
        <div
          ref={overlayRef}
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "rgba(200,0,0,0.35)", opacity: 0,
            transition: "opacity .05s",
          }}
        />

        {screen === "game" && <Hud ui={ui} best={best} locked={pointerLocked} />}
        {screen === "start" && <StartScreen best={best} onStart={startGame} />}
        {screen === "dead" && <GameOver kills={kills.current} wave={wave.current} best={best} onRestart={startGame} />}
      </div>
    </Shell>
  );
}

function ZOMBIE_BASE_HP(wave: number) { return 2 + Math.floor(wave * 1.4); }
function ZOMBIE_BASE_SPEED(wave: number) { return 0.03 + wave * 0.004; }
