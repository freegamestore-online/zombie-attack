import { useRef, useEffect, useState, useCallback } from "react";
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

function ZOMBIE_BASE_HP(waveNum: number) { return 2 + Math.floor(waveNum * 1.4); }
function ZOMBIE_BASE_SPEED(waveNum: number) { return 0.03 + waveNum * 0.004; }

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

      {/* Tip when not locked */}
      {!locked && (
        <div style={{ position: "absolute", top: 14, left: 22, background: "rgba(0,0,0,.65)", borderRadius: 8, padding: "8px 14px", border: "1px solid rgba(255,255,255,.18)", maxWidth: 260 }}>
          <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
            🖱️ Click the screen to aim &amp; shoot
          </div>
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: 11, lineHeight: 1.5 }}>
            Left-click locks your mouse. Then aim and <strong style={{ color: "#fff" }}>left-click to fire</strong>. Press <strong style={{ color: "#fff" }}>Esc</strong> to release.
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
      <div style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.45)", borderRadius: 10, padding: "10px 20px", marginBottom: 22, maxWidth: 340, textAlign: "center" }}>
        <span style={{ color: "#fca5a5", fontSize: 14, fontWeight: 700 }}>
          🔫 Click the screen to lock your mouse, then <strong style={{ color: "#fff" }}>left-click to shoot</strong> zombies. Press <strong style={{ color: "#fff" }}>Esc</strong> to release.
        </span>
      </div>
      {best > 0 && <div style={{ color: "#f59e0b", fontSize: 14, marginBottom: 18, fontWeight: 700 }}>🏆 Best: {best} kills</div>}
      <button onClick={onStart} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "14px 52px", fontSize: 19, fontWeight: 800, cursor: "pointer", fontFamily: "Fraunces,serif", boxShadow: "0 4px 24px rgba(239,68,68,.5)", minHeight: 52 }}>CLICK TO PLAY</button>
    </div>
  );
}

// ─── Zombie builder (pure, no hooks) ─────────────────────────────────────────
function spawnZombie(scene: BABYLON.Scene, id: number, waveNum: number): ZombieEntity {
  const half = ARENA / 2 - 2;
  const side = Math.floor(Math.random() * 4);
  let sx = 0, sz = 0;
  if (side === 0) { sx = (Math.random() - 0.5) * ARENA; sz = half; }
  else if (side === 1) { sx = (Math.random() - 0.5) * ARENA; sz = -half; }
  else if (side === 2) { sx = half; sz = (Math.random() - 0.5) * ARENA; }
  else { sx = -half; sz = (Math.random() - 0.5) * ARENA; }

  const root = new BABYLON.Mesh(`zroot_${id}`, scene);
  root.position.set(sx, 0, sz);

  const zm = new BABYLON.StandardMaterial(`zm_${id}`, scene);
  zm.diffuseColor = new BABYLON.Color3(0.22, 0.38, 0.18);
  zm.specularColor = BABYLON.Color3.Black();

  const skinM = new BABYLON.StandardMaterial(`zskin_${id}`, scene);
  skinM.diffuseColor = new BABYLON.Color3(0.55, 0.48, 0.38);
  skinM.specularColor = BABYLON.Color3.Black();

  // Body
  const body = BABYLON.MeshBuilder.CreateBox(`zbody_${id}`, { width: 0.6, height: 0.8, depth: 0.35 }, scene);
  body.material = zm;
  body.parent = root;
  body.position.y = 1.1;
  body.isPickable = true;

  // Head
  const head = BABYLON.MeshBuilder.CreateBox(`zhead_${id}`, { width: 0.42, height: 0.42, depth: 0.42 }, scene);
  head.material = skinM;
  head.parent = root;
  head.position.y = 1.72;
  head.isPickable = false;

  // Eyes
  const eyeM = new BABYLON.StandardMaterial(`zeye_${id}`, scene);
  eyeM.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.05);
  eyeM.emissiveColor = new BABYLON.Color3(0.6, 0.0, 0.0);
  const eyeL = BABYLON.MeshBuilder.CreateSphere(`zeL_${id}`, { diameter: 0.09, segments: 4 }, scene);
  eyeL.material = eyeM; eyeL.parent = head; eyeL.position.set(-0.1, 0.05, 0.21); eyeL.isPickable = false;
  const eyeR = BABYLON.MeshBuilder.CreateSphere(`zeR_${id}`, { diameter: 0.09, segments: 4 }, scene);
  eyeR.material = eyeM; eyeR.parent = head; eyeR.position.set(0.1, 0.05, 0.21); eyeR.isPickable = false;

  // Arms
  const lArm = BABYLON.MeshBuilder.CreateBox(`zlA_${id}`, { width: 0.18, height: 0.65, depth: 0.18 }, scene);
  lArm.material = zm; lArm.parent = root; lArm.position.set(-0.42, 1.1, 0); lArm.isPickable = false;
  const rArm = BABYLON.MeshBuilder.CreateBox(`zrA_${id}`, { width: 0.18, height: 0.65, depth: 0.18 }, scene);
  rArm.material = zm; rArm.parent = root; rArm.position.set(0.42, 1.1, 0); rArm.isPickable = false;

  // Legs
  const lLeg = BABYLON.MeshBuilder.CreateBox(`zlL_${id}`, { width: 0.2, height: 0.65, depth: 0.2 }, scene);
  lLeg.material = zm; lLeg.parent = root; lLeg.position.set(-0.18, 0.38, 0); lLeg.isPickable = false;
  const rLeg = BABYLON.MeshBuilder.CreateBox(`zrL_${id}`, { width: 0.2, height: 0.65, depth: 0.2 }, scene);
  rLeg.material = zm; rLeg.parent = root; rLeg.position.set(0.18, 0.38, 0); rLeg.isPickable = false;

  // Suppress unused warnings for eye meshes (they're attached to scene)
  void eyeL; void eyeR;

  return {
    id, root, body, head, lArm, rArm, lLeg, rLeg,
    hp: ZOMBIE_BASE_HP(waveNum),
    maxHp: ZOMBIE_BASE_HP(waveNum),
    speed: ZOMBIE_BASE_SPEED(waveNum),
    animT: Math.random() * Math.PI * 2,
    dead: false,
    atkCd: 0,
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [screen, setScreen] = useState<"start" | "game" | "dead">("start");
  const [ui, setUi] = useState<UIState>({ hp: MAX_HP, ammo: MAX_AMMO, wave: 1, kills: 0, phase: "playing", waveTimer: WAVE_BREAK, reloading: false, reloadPct: 0 });
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("za_best") ?? "0", 10) || 0);
  const [pointerLocked, setPointerLocked] = useState(false);

  // Mutable refs — no re-render
  const screenRef = useRef<"start" | "game" | "dead">("start");
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const cameraRef = useRef<BABYLON.UniversalCamera | null>(null);

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
  const bestRef = useRef(best);

  // Keep screenRef in sync
  useEffect(() => { screenRef.current = screen; }, [screen]);
  // Keep bestRef in sync
  useEffect(() => { bestRef.current = best; }, [best]);

  // Track pointer-lock state for HUD tip
  useEffect(() => {
    const onChange = () => setPointerLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  // ── Push UI ──────────────────────────────────────────────────────────────────
  const pushUi = useCallback(() => {
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
  }, []);

  // ── Reload ─────────────────────────────────────────────────────────────────
  const startReload = useCallback(() => {
    if (reloading.current || ammo.current === MAX_AMMO) return;
    reloading.current = true;
    reloadTimer.current = RELOAD_TIME;
    pushUi();
  }, [pushUi]);

  // ── Kill zombie ────────────────────────────────────────────────────────────
  const killZombie = useCallback((z: ZombieEntity) => {
    z.dead = true;
    z.root.dispose();
    kills.current++;
    if (kills.current > bestRef.current) {
      setBest(kills.current);
      bestRef.current = kills.current;
      localStorage.setItem("za_best", String(kills.current));
    }
    pushUi();
  }, [pushUi]);

  // ── Spawn wave ─────────────────────────────────────────────────────────────
  const spawnWave = useCallback((scene: BABYLON.Scene) => {
    const count = 4 + wave.current * 2;
    for (let i = 0; i < count; i++) {
      const z = spawnZombie(scene, zombieId.current++, wave.current);
      zombies.current.push(z);
    }
  }, []);

  // ── Shoot ──────────────────────────────────────────────────────────────────
  const shoot = useCallback((scene: BABYLON.Scene) => {
    if (reloading.current) return;
    if (ammo.current <= 0) { startReload(); return; }

    ammo.current--;
    pushUi();

    // Muzzle flash
    const mf = muzzleFlash.current;
    if (mf) {
      const cam = cameraRef.current;
      if (cam) {
        const fwd = cam.getForwardRay(1).direction;
        mf.position.copyFrom(cam.position).addInPlace(fwd.scale(0.55)).addInPlace(new BABYLON.Vector3(0.18, -0.13, 0));
      }
      mf.isVisible = true;
      muzzleTimer.current = 0.06;
    }

    // Raycast
    const cam = cameraRef.current;
    if (!cam) return;
    const ray = cam.getForwardRay(80);
    const hit = scene.pickWithRay(ray, (m) => {
      if (!m.isEnabled() || !m.isVisible) return false;
      if (m.name.startsWith("zbody_")) return true;
      if (m.metadata && (m.metadata as { solid?: boolean }).solid === true) return true;
      return false;
    });

    if (hit?.pickedMesh) {
      const meshName = hit.pickedMesh.name;
      if (meshName.startsWith("zbody_")) {
        const idStr = meshName.slice("zbody_".length);
        const zid = parseInt(idStr, 10);
        const z = zombies.current.find((z) => z.id === zid);
        if (z && !z.dead) {
          z.hp -= 1;
          if (z.hp <= 0) killZombie(z);
        }
      }
    }
  }, [pushUi, startReload, killZombie]);

  // ── Main tick ─────────────────────────────────────────────────────────────
  const tick = useCallback((scene: BABYLON.Scene, dt: number) => {
    if (phase.current === "dead") return;

    const cam = cameraRef.current;
    if (!cam) return;

    // ── Player movement ──────────────────────────────────────────────────────
    if (phase.current === "playing") {
      const fwd = cam.getForwardRay(1).direction;
      const right = BABYLON.Vector3.Cross(fwd, BABYLON.Vector3.Up()).normalize();
      const move = BABYLON.Vector3.Zero();
      if (keys.current["KeyW"] || keys.current["ArrowUp"]) move.addInPlace(fwd);
      if (keys.current["KeyS"] || keys.current["ArrowDown"]) move.subtractInPlace(fwd);
      if (keys.current["KeyA"] || keys.current["ArrowLeft"]) move.subtractInPlace(right);
      if (keys.current["KeyD"] || keys.current["ArrowRight"]) move.addInPlace(right);
      if (move.length() > 0.001) {
        move.normalize().scaleInPlace(PLAYER_SPEED);
        move.y = 0;
        cam.position.addInPlace(move);
        // Clamp to arena
        const half = ARENA / 2 - 0.6;
        cam.position.x = Math.max(-half, Math.min(half, cam.position.x));
        cam.position.z = Math.max(-half, Math.min(half, cam.position.z));
      }
    }

    // ── Gun bob ──────────────────────────────────────────────────────────────
    const moving = keys.current["KeyW"] || keys.current["KeyS"] || keys.current["KeyA"] || keys.current["KeyD"];
    if (moving) gunBobT.current += dt * 7;
    const gun = gunRoot.current;
    if (gun) {
      const bobY = moving ? Math.sin(gunBobT.current) * 0.012 : 0;
      const bobX = moving ? Math.sin(gunBobT.current * 0.5) * 0.006 : 0;
      gun.position.set(0.21 + bobX, -0.19 + bobY, 0.44);
    }

    // ── Muzzle flash ─────────────────────────────────────────────────────────
    if (muzzleTimer.current > 0) {
      muzzleTimer.current -= dt;
      if (muzzleTimer.current <= 0) {
        const mf = muzzleFlash.current;
        if (mf) mf.isVisible = false;
      }
    }

    // ── Damage flash ─────────────────────────────────────────────────────────
    if (damageFlashTimer.current > 0) damageFlashTimer.current -= dt;

    // ── Reload ───────────────────────────────────────────────────────────────
    if (reloading.current) {
      reloadTimer.current -= dt;
      if (reloadTimer.current <= 0) {
        reloading.current = false;
        ammo.current = MAX_AMMO;
      }
      pushUi();
    }

    // ── Wave break ───────────────────────────────────────────────────────────
    if (phase.current === "waveBreak") {
      waveTimer.current -= dt;
      if (waveTimer.current <= 0) {
        phase.current = "playing";
        spawnWave(scene);
      }
      pushUi();
      return;
    }

    // ── Zombies ──────────────────────────────────────────────────────────────
    const camPos = cam.position;
    let allDead = true;

    for (const z of zombies.current) {
      if (z.dead) continue;
      allDead = false;

      // Move toward player
      const dx = camPos.x - z.root.position.x;
      const dz = camPos.z - z.root.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.01) {
        const nx = dx / dist;
        const nz = dz / dist;
        z.root.position.x += nx * z.speed;
        z.root.position.z += nz * z.speed;
        // Face player
        z.root.rotation.y = Math.atan2(nx, nz);
      }

      // Animate limbs
      z.animT += dt * 5;
      const swing = Math.sin(z.animT) * 0.7;
      z.lArm.rotation.x = swing;
      z.rArm.rotation.x = -swing;
      z.lLeg.rotation.x = -swing * 0.6;
      z.rLeg.rotation.x = swing * 0.6;
      // Outstretched arms
      z.lArm.rotation.z = 0.35;
      z.rArm.rotation.z = -0.35;

      // Attack player
      if (z.atkCd > 0) z.atkCd -= dt;
      if (dist < ZOMBIE_ATTACK_RANGE && z.atkCd <= 0) {
        hp.current = Math.max(0, hp.current - ZOMBIE_ATTACK_DAMAGE);
        z.atkCd = ZOMBIE_ATTACK_COOLDOWN;
        damageFlashTimer.current = 0.25;
        pushUi();
        if (hp.current <= 0) {
          phase.current = "dead";
          setScreen("dead");
          pushUi();
          return;
        }
      }
    }

    // ── Check wave cleared ───────────────────────────────────────────────────
    if (allDead && zombies.current.length > 0) {
      zombies.current = [];
      wave.current++;
      phase.current = "waveBreak";
      waveTimer.current = WAVE_BREAK;
      pushUi();
    }
  }, [pushUi, spawnWave]);

  // ── Reset game state ───────────────────────────────────────────────────────
  const resetGame = useCallback((scene: BABYLON.Scene) => {
    // Kill all zombies
    for (const z of zombies.current) {
      if (!z.dead) z.root.dispose();
    }
    zombies.current = [];

    // Reset camera
    const cam = cameraRef.current;
    if (cam) {
      cam.position.set(0, PLAYER_HEIGHT, 0);
      cam.rotation.set(0, 0, 0);
    }

    // Reset state
    hp.current = MAX_HP;
    ammo.current = MAX_AMMO;
    wave.current = 1;
    kills.current = 0;
    phase.current = "playing";
    waveTimer.current = WAVE_BREAK;
    reloading.current = false;
    reloadTimer.current = 0;
    muzzleTimer.current = 0;
    damageFlashTimer.current = 0;
    gunBobT.current = 0;

    pushUi();
    spawnWave(scene);
  }, [pushUi, spawnWave]);

  // ── Build Babylon scene (once) ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    scene.collisionsEnabled = true;

    // Sky / fog
    scene.clearColor = new BABYLON.Color4(0.04, 0.06, 0.04, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.022;
    scene.fogColor = new BABYLON.Color3(0.04, 0.07, 0.04);

    // ── Camera ────────────────────────────────────────────────────────────────
    const cam = new BABYLON.UniversalCamera("fp", new BABYLON.Vector3(0, PLAYER_HEIGHT, 0), scene);
    cam.setTarget(new BABYLON.Vector3(0, PLAYER_HEIGHT, 1));
    cam.minZ = 0.04;
    cam.maxZ = 220;
    cam.fov = 1.08;
    cam.checkCollisions = true;
    cam.applyGravity = false;
    cam.ellipsoid = new BABYLON.Vector3(0.45, PLAYER_HEIGHT / 2, 0.45);
    cam.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
    cameraRef.current = cam;

    // ── Lighting ──────────────────────────────────────────────────────────────
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.5;
    hemi.diffuse = new BABYLON.Color3(0.45, 0.75, 0.45);
    hemi.groundColor = new BABYLON.Color3(0.04, 0.08, 0.04);
    const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.4, -1, -0.3), scene);
    dir.intensity = 0.65;
    dir.diffuse = new BABYLON.Color3(0.85, 0.95, 0.65);
    void hemi; void dir;

    // ── Ground ────────────────────────────────────────────────────────────────
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: ARENA, height: ARENA, subdivisions: 6 }, scene);
    const gm = new BABYLON.StandardMaterial("gm", scene);
    gm.diffuseColor = new BABYLON.Color3(0.1, 0.16, 0.08);
    gm.specularColor = BABYLON.Color3.Black();
    ground.material = gm;
    ground.checkCollisions = true;

    // ── Walls ────────────────────────────────────────────────────────────────
    const wm = new BABYLON.StandardMaterial("wm", scene);
    wm.diffuseColor = new BABYLON.Color3(0.16, 0.2, 0.14);
    wm.specularColor = BABYLON.Color3.Black();
    const wallH = 6, wallHalf = ARENA / 2;
    const wallDefs: { pos: [number, number, number]; w: number; d: number }[] = [
      { pos: [0, wallH / 2, wallHalf],  w: ARENA + 1.2, d: 0.7 },
      { pos: [0, wallH / 2, -wallHalf], w: ARENA + 1.2, d: 0.7 },
      { pos: [wallHalf, wallH / 2, 0],  w: 0.7, d: ARENA },
      { pos: [-wallHalf, wallH / 2, 0], w: 0.7, d: ARENA },
    ];
    wallDefs.forEach((d, i) => {
      const wall = BABYLON.MeshBuilder.CreateBox(`wall${i}`, { width: d.w, height: wallH, depth: d.d }, scene);
      wall.position.set(...d.pos);
      wall.material = wm;
      wall.checkCollisions = true;
      wall.isPickable = true;
      wall.metadata = { solid: true };
    });

    // ── Obstacles ────────────────────────────────────────────────────────────
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
      const c = BABYLON.MeshBuilder.CreateBox(`crate${i}`, { width: 1.3, height: 1.3, depth: 1.3 }, scene);
      c.position.set(x, 0.65, z);
      c.material = cm;
      c.checkCollisions = true;
      c.isPickable = true;
      c.metadata = { solid: true };
    });

    const barrelPos: [number, number][] = [
      [4, 12], [-4, 12], [4, -12], [-4, -12],
      [12, 4], [-12, 4], [12, -4], [-12, -4],
    ];
    barrelPos.forEach(([x, z], i) => {
      const b = BABYLON.MeshBuilder.CreateCylinder(`barrel${i}`, { diameter: 0.75, height: 1.1, tessellation: 8 }, scene);
      b.position.set(x, 0.55, z);
      b.material = bm;
      b.checkCollisions = true;
      b.isPickable = true;
      b.metadata = { solid: true };
    });

    // ── Gun model ────────────────────────────────────────────────────────────
    const gunRootMesh = new BABYLON.Mesh("gunRoot", scene);
    const dark = new BABYLON.StandardMaterial("gd", scene);
    dark.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.11);
    dark.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    const wood = new BABYLON.StandardMaterial("gw", scene);
    wood.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.08);

    const gbody = BABYLON.MeshBuilder.CreateBox("gbody", { width: 0.085, height: 0.1, depth: 0.38 }, scene);
    gbody.material = dark; gbody.parent = gunRootMesh;

    const gbarrel = BABYLON.MeshBuilder.CreateCylinder("gbarrel", { diameter: 0.036, height: 0.3, tessellation: 8 }, scene);
    gbarrel.rotation.x = Math.PI / 2; gbarrel.material = dark; gbarrel.parent = gunRootMesh; gbarrel.position.set(0, 0.018, 0.33);

    const gshroud = BABYLON.MeshBuilder.CreateCylinder("gshroud", { diameter: 0.055, height: 0.18, tessellation: 8 }, scene);
    gshroud.rotation.x = Math.PI / 2; gshroud.material = dark; gshroud.parent = gunRootMesh; gshroud.position.set(0, 0.018, 0.28);

    const ggrip = BABYLON.MeshBuilder.CreateBox("ggrip", { width: 0.072, height: 0.15, depth: 0.075 }, scene);
    ggrip.material = wood; ggrip.parent = gunRootMesh; ggrip.position.set(0, -0.11, -0.06); ggrip.rotation.x = 0.22;

    const gtg = BABYLON.MeshBuilder.CreateTorus("gtg", { diameter: 0.06, thickness: 0.012, tessellation: 8 }, scene);
    gtg.material = dark; gtg.parent = gunRootMesh; gtg.position.set(0, -0.045, 0.02); gtg.rotation.x = Math.PI / 2;

    const gsr = BABYLON.MeshBuilder.CreateBox("gsr", { width: 0.022, height: 0.028, depth: 0.012 }, scene);
    gsr.material = dark; gsr.parent = gunRootMesh; gsr.position.set(0, 0.066, -0.06);

    const gsf = BABYLON.MeshBuilder.CreateBox("gsf", { width: 0.012, height: 0.024, depth: 0.012 }, scene);
    gsf.material = dark; gsf.parent = gunRootMesh; gsf.position.set(0, 0.066, 0.16);

    const gmag = BABYLON.MeshBuilder.CreateBox("gmag", { width: 0.065, height: 0.1, depth: 0.055 }, scene);
    gmag.material = dark; gmag.parent = gunRootMesh; gmag.position.set(0, -0.075, 0.0);

    void gbody; void gbarrel; void gshroud; void ggrip; void gtg; void gsr; void gsf; void gmag;

    gunRootMesh.parent = cam;
    gunRootMesh.position.set(0.21, -0.19, 0.44);
    gunRootMesh.rotation.set(0.04, 0.03, 0);
    gunRoot.current = gunRootMesh;

    // ── Muzzle flash ─────────────────────────────────────────────────────────
    const mf = BABYLON.MeshBuilder.CreateSphere("mf", { diameter: 0.22, segments: 5 }, scene);
    const mfm = new BABYLON.StandardMaterial("mfm", scene);
    mfm.diffuseColor = new BABYLON.Color3(1, 0.9, 0.3);
    mfm.emissiveColor = new BABYLON.Color3(1, 0.75, 0.1);
    mf.material = mfm;
    mf.isVisible = false;
    muzzleFlash.current = mf;

    // ── Input ─────────────────────────────────────────────────────────────────
    scene.onKeyboardObservable.add((info) => {
      const k = info.event.code;
      if (info.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        keys.current[k] = true;
        if (k === "KeyR") startReload();
      } else {
        keys.current[k] = false;
      }
    });

    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (screenRef.current !== "game") return;
      if (!document.pointerLockElement) {
        canvas.requestPointerLock();
      } else {
        shoot(scene);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);

    document.addEventListener("mousemove", (e) => {
      if (screenRef.current !== "game" || document.pointerLockElement !== canvas) return;
      const c = cameraRef.current;
      if (!c) return;
      c.rotation.y += e.movementX * MOUSE_SENS;
      c.rotation.x = Math.max(-1.35, Math.min(1.35, c.rotation.x + e.movementY * MOUSE_SENS));
    });

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
      const c = cameraRef.current;
      if (!c) return;
      c.rotation.y += (t.clientX - lastTouch.clientX) * MOUSE_SENS * 0.6;
      c.rotation.x = Math.max(-1.35, Math.min(1.35, c.rotation.x + (t.clientY - lastTouch.clientY) * MOUSE_SENS * 0.6));
      lastTouch = t;
    }, { passive: false });

    // ── Render loop ───────────────────────────────────────────────────────────
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
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("resize", onResize);
      engine.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle start / restart ─────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    setScreen("game");
    screenRef.current = "game";
    resetGame(scene);
  }, [resetGame]);

  return (
    <Shell>
      <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", outline: "none" }}
          tabIndex={0}
        />

        {screen === "game" && (
          <Hud ui={ui} best={best} locked={pointerLocked} />
        )}

        {screen === "start" && (
          <StartScreen best={best} onStart={handleStart} />
        )}

        {screen === "dead" && (
          <GameOver
            kills={ui.kills}
            wave={ui.wave}
            best={best}
            onRestart={handleStart}
          />
        )}

        {/* Damage flash overlay */}
        {screen === "game" && damageFlashTimer.current > 0 && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(220,0,0,.22)", pointerEvents: "none" }} />
        )}
      </div>
    </Shell>
  );
}
