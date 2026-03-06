import * as THREE from './vendor/three.module.v3.js';
import { GLTFLoader } from './vendor/GLTFLoader.v3.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('score');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ba7c4);
scene.fog = new THREE.Fog(0x8ba7c4, 45, 260);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 4, 12);

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2b3c2f, 1.25));
const sun = new THREE.DirectionalLight(0xfff6de, 1.05);
sun.position.set(34, 50, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 180;
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
scene.add(sun);

const sunDisk = new THREE.Mesh(
  new THREE.SphereGeometry(10, 20, 20),
  new THREE.MeshBasicMaterial({ color: 0xffe9b0 })
);
sunDisk.position.copy(sun.position).multiplyScalar(6.5);
scene.add(sunDisk);

const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(15, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.18 })
);
sunHalo.position.copy(sunDisk.position);
scene.add(sunHalo);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(700, 32, 20),
  new THREE.MeshBasicMaterial({ color: 0xaec7e2, side: THREE.BackSide })
);
scene.add(skyDome);

const groundGeo = new THREE.PlaneGeometry(900, 900, 140, 140);
const gp = groundGeo.attributes.position;
for (let i = 0; i < gp.count; i++) {
  const x = gp.getX(i);
  const y = gp.getY(i);
  const h = Math.sin(x * 0.012) * 0.9 + Math.cos(y * 0.014) * 0.7 + (Math.random() - 0.5) * 0.18;
  gp.setZ(i, h);
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({ color: 0x314c3a, roughness: 0.97, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.2;
ground.receiveShadow = true;
scene.add(ground);

const treeMat = new THREE.MeshStandardMaterial({ color: 0x243724, roughness: 1, flatShading: true });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3628, roughness: 1, flatShading: true });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7f43, roughness: 0.96, metalness: 0.0, flatShading: true });

const cloudMat = new THREE.MeshStandardMaterial({ color: 0xe9f1fb, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.75 });
const clouds = [];
const cloudRadius = 240;
for (let i = 0; i < 32; i++) {
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random() * 4, 8, 8), cloudMat);
  cloud.scale.y = 0.45;
  cloud.userData.seed = Math.random() * 1000;
  cloud.userData.drift = 0.4 + Math.random() * 0.8;
  cloud.userData.height = 30 + Math.random() * 30;
  cloud.position.set((Math.random() - 0.5) * cloudRadius * 2, cloud.userData.height, (Math.random() - 0.5) * cloudRadius * 2);
  scene.add(cloud);
  clouds.push(cloud);
}

// Procedural river segments around player
const rivers = [];
const riverMat = new THREE.MeshStandardMaterial({
  color: 0x4d87bf,
  roughness: 0.18,
  metalness: 0.08,
  transparent: true,
  opacity: 0.72
});
const riverSegmentCount = 12;
for (let i = 0; i < riverSegmentCount; i++) {
  const river = new THREE.Mesh(new THREE.PlaneGeometry(220, 16, 36, 2), riverMat.clone());
  river.rotation.x = -Math.PI / 2;
  river.receiveShadow = true;
  river.userData.seed = i * 17.37;
  scene.add(river);
  rivers.push(river);
}

function updateDynamicEnvironment(px, pz, t) {
  // clouds: wrap around raven so sky feels endless
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.position.x += Math.sin(t * 0.03 + c.userData.seed) * c.userData.drift * 0.02;
    c.position.z += Math.cos(t * 0.025 + c.userData.seed) * c.userData.drift * 0.02;

    const dx = c.position.x - px;
    const dz = c.position.z - pz;
    if (Math.abs(dx) > cloudRadius) c.position.x = px - Math.sign(dx) * cloudRadius;
    if (Math.abs(dz) > cloudRadius) c.position.z = pz - Math.sign(dz) * cloudRadius;
  }

  // rivers: deterministic random-ish placement around active area
  const rcx = Math.floor(px / 140);
  const rcz = Math.floor(pz / 140);
  for (let i = 0; i < rivers.length; i++) {
    const r = rivers[i];
    const ox = (i % 4) - 1.5;
    const oz = Math.floor(i / 4) - 1;
    const sx = rcx + ox;
    const sz = rcz + oz;
    const n = hash2(sx * 3 + i * 5, sz * 7 + i * 11);

    r.position.x = sx * 140 + (n - 0.5) * 50;
    r.position.z = sz * 140 + (hash2(sz * 2 + i * 13, sx * 5 + i) - 0.5) * 50;
    r.position.y = -0.5 + Math.sin(t * 0.7 + i) * 0.02;
    r.rotation.z = (n - 0.5) * 1.2;
    r.material.opacity = 0.58 + Math.sin(t * 1.2 + i * 0.5) * 0.1;
  }
}

// Browser-side procedural generation around player
const chunkSize = 60;
const chunkRadius = 2;
const chunkMap = new Map();
const procGeo = {
  trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 6),
  crown: new THREE.ConeGeometry(1, 1, 6),
  grass: new THREE.ConeGeometry(0.18, 1.2, 3)
};

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function makeChunk(cx, cz) {
  const group = new THREE.Group();
  group.userData.cx = cx;
  group.userData.cz = cz;
  const baseX = cx * chunkSize;
  const baseZ = cz * chunkSize;

  const treeCount = 8 + Math.floor(hash2(cx, cz) * 10);
  for (let i = 0; i < treeCount; i++) {
    const rx = hash2(cx * 19 + i, cz * 7 + i * 13);
    const rz = hash2(cx * 11 + i * 5, cz * 23 + i * 17);
    const px = baseX + (rx - 0.5) * chunkSize;
    const pz = baseZ + (rz - 0.5) * chunkSize;
    const h = 3 + hash2(cx * 3 + i, cz * 5 + i) * 8;

    const trunk = new THREE.Mesh(procGeo.trunk, trunkMat);
    trunk.position.set(px, h * 0.225 - 1.2, pz);
    trunk.scale.y = h * 0.45;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const crown = new THREE.Mesh(procGeo.crown, treeMat);
    crown.position.set(px, h * 0.5 - 1.2, pz);
    crown.scale.set(0.8 + h * 0.16, h, 0.8 + h * 0.16);
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  }

  const grassCount = 45;
  for (let i = 0; i < grassCount; i++) {
    const rx = hash2(cx * 37 + i, cz * 29 + i * 3);
    const rz = hash2(cx * 41 + i * 7, cz * 31 + i * 11);
    const px = baseX + (rx - 0.5) * chunkSize;
    const pz = baseZ + (rz - 0.5) * chunkSize;
    const g = new THREE.Mesh(procGeo.grass, grassMat);
    g.position.set(px, -0.8, pz);
    g.rotation.y = hash2(cx * 2 + i, cz * 9 + i) * Math.PI;
    const s = 0.6 + hash2(cx + i * 2, cz + i * 3) * 0.9;
    g.scale.set(1, s, 1);
    g.castShadow = true;
    g.receiveShadow = true;
    group.add(g);
  }

  scene.add(group);
  chunkMap.set(`${cx},${cz}`, group);
}

function updateChunks(px, pz) {
  const ccx = Math.floor(px / chunkSize);
  const ccz = Math.floor(pz / chunkSize);
  const needed = new Set();

  for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      const cx = ccx + dx;
      const cz = ccz + dz;
      const key = `${cx},${cz}`;
      needed.add(key);
      if (!chunkMap.has(key)) makeChunk(cx, cz);
    }
  }

  for (const [key, grp] of chunkMap.entries()) {
    if (!needed.has(key)) {
      scene.remove(grp);
      chunkMap.delete(key);
    }
  }
}

// Raven actor + model loader
const raven = new THREE.Group();
raven.position.set(0, 5, 0);
scene.add(raven);

const ravenPivot = new THREE.Group();
raven.add(ravenPivot);

// tiny fallback mesh while GLB loads
const fallbackRaven = new THREE.Mesh(
  new THREE.ConeGeometry(0.22, 0.9, 5),
  new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.85, metalness: 0.02, flatShading: true })
);
fallbackRaven.rotation.x = Math.PI / 2;
ravenPivot.add(fallbackRaven);

const gltfLoader = new GLTFLoader();
gltfLoader.load(
  './assets/Bird_1_by_get3dmodels.glb',
  (gltf) => {
    ravenPivot.remove(fallbackRaven);
    const model = gltf.scene;
    model.scale.setScalar(0.012);

    model.rotation.x = -2;
    model.rotation.y = Math.PI;
    model.rotation.z = -Math.PI / 2;


    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (!o.material) {
          o.material = new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.86, metalness: 0.02 });
        }
      }
    });
    ravenPivot.add(model);
  },
  undefined,
  () => {
    // keep fallback if load fails
  }
);

updateChunks(raven.position.x, raven.position.z);

// pickups
const shinies = [];
const shinyGeo = new THREE.IcosahedronGeometry(0.24, 0);
const shinyMat = new THREE.MeshStandardMaterial({
  color: 0xffdf6a,
  emissive: 0x7a5f19,
  emissiveIntensity: 0.52,
  metalness: 0.72,
  roughness: 0.2
});

function spawnShiny() {
  const m = new THREE.Mesh(shinyGeo, shinyMat);
  const cx = raven ? raven.position.x : 0;
  const cz = raven ? raven.position.z : 0;
  m.position.set(cx + (Math.random() - 0.5) * 180, 1.8 + Math.random() * 30, cz + (Math.random() - 0.5) * 180);
  m.castShadow = true;
  scene.add(m);
  shinies.push(m);
}

function resetShinies(n = 50) {
  while (shinies.length) scene.remove(shinies.pop());
  for (let i = 0; i < n; i++) spawnShiny();
}
resetShinies();

const keys = new Set();
let started = false;
let score = 0;
let yaw = 0;
let pitch = -0.08;
const vel = new THREE.Vector3();
const camTarget = new THREE.Vector3();

window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function setPointerLock() {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
}

document.addEventListener('mousemove', (e) => {
  if (!started || document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0023;
  pitch -= e.movementY * 0.0019;
  pitch = Math.max(-1.1, Math.min(1.1, pitch));
});

canvas.addEventListener('click', () => started && setPointerLock());
startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  started = true;
  setPointerLock();
});

function update(dt, t) {
  if (!started) return;

  const boost = keys.has('q') ? 1.8 : 1;
  const accel = 28 * boost;
  const damping = 4.0;

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const upInput = (keys.has(' ') ? 1 : 0) - (keys.has('shift') ? 1 : 0);

  const input = new THREE.Vector3();
  if (keys.has('w')) input.add(forward);
  if (keys.has('s')) input.sub(forward);
  if (keys.has('d')) input.add(right);
  if (keys.has('a')) input.sub(right);
  input.y += upInput;

  if (input.lengthSq() > 0) {
    input.normalize().multiplyScalar(accel * dt);
    vel.add(input);
  }

  vel.multiplyScalar(Math.exp(-damping * dt));
  vel.clampLength(0, 18 * boost);
  raven.position.addScaledVector(vel, dt * 5.5);

  raven.position.y = THREE.MathUtils.clamp(raven.position.y, 1.3, 52);

  updateChunks(raven.position.x, raven.position.z);
  updateDynamicEnvironment(raven.position.x, raven.position.z, t);

  // Flight animation / banking
  const flapRate = 13 + vel.length() * 0.4;
  const flap = Math.sin(t * flapRate);

  const sideSpeed = vel.dot(right);
  raven.rotation.y = yaw;
  raven.rotation.z = THREE.MathUtils.lerp(raven.rotation.z, -sideSpeed * 0.035, 0.12);
  raven.rotation.x = THREE.MathUtils.lerp(raven.rotation.x, -vel.y * 0.03 + pitch * 0.2, 0.1);
  ravenPivot.rotation.x = flap * 0.04;
  ravenPivot.position.y = flap * 0.08;

  const camOffset = new THREE.Vector3(0, 1.7, -5.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.lerp(raven.position.clone().add(camOffset), 0.09);
  camTarget.copy(raven.position).add(new THREE.Vector3(Math.sin(yaw), Math.sin(pitch) * 0.75, Math.cos(yaw)).multiplyScalar(18));
  camera.lookAt(camTarget);

  for (let i = shinies.length - 1; i >= 0; i--) {
    const s = shinies[i];
    s.rotation.y += dt * 2.4;
    s.rotation.x += dt * 1.2;
    s.position.y += Math.sin(t * 2.6 + i * 0.35) * 0.004;

    if (s.position.distanceTo(raven.position) < 1.02) {
      scene.remove(s);
      shinies.splice(i, 1);
      score += 1;
      scoreEl.textContent = String(score);
      spawnShiny();
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  update(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop(performance.now());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
