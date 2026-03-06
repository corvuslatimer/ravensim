import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('score');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91aeca);
scene.fog = new THREE.Fog(0x91aeca, 40, 220);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 4, 12);

scene.add(new THREE.HemisphereLight(0xcbe1ff, 0x2b3c2f, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(30, 45, -10);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 900, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0x314c3a, roughness: 0.95, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.2;
scene.add(ground);

const treeMat = new THREE.MeshStandardMaterial({ color: 0x1f2e1f, roughness: 1 });
for (let i = 0; i < 180; i++) {
  const h = 3 + Math.random() * 10;
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.8 + h * 0.16, h, 6), treeMat);
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 330;
  tree.position.set(Math.cos(angle) * dist, h * 0.5 - 1.2, Math.sin(angle) * dist);
  scene.add(tree);
}

// Stylized raven model (clean silhouette)
const raven = new THREE.Group();
const ravenMat = new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.86, metalness: 0.02, flatShading: true });

const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), ravenMat);
torso.scale.set(1.25, 0.75, 1.95);
torso.position.set(0, 0.02, 0.02);
raven.add(torso);

const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), ravenMat);
chest.scale.set(1.0, 0.85, 0.95);
chest.position.set(0, -0.02, 0.52);
raven.add(chest);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), ravenMat);
head.scale.set(1.0, 0.92, 1.12);
head.position.set(0, 0.16, 0.98);
raven.add(head);

const beak = new THREE.Mesh(
  new THREE.ConeGeometry(0.065, 0.35, 5),
  new THREE.MeshStandardMaterial({ color: 0xd3dae6, roughness: 0.45, metalness: 0.08, flatShading: true })
);
beak.rotation.x = Math.PI / 2;
beak.position.set(0, 0.14, 1.24);
raven.add(beak);

const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.2, metalness: 0.05 });
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
const eyeR = eyeL.clone();
eyeL.position.set(-0.09, 0.2, 1.08);
eyeR.position.set(0.09, 0.2, 1.08);
raven.add(eyeL, eyeR);

const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.7, 4), ravenMat);
tail.rotation.x = -Math.PI / 2;
tail.position.set(0, 0.0, -1.02);
tail.scale.set(1.4, 1, 0.75);
raven.add(tail);

// tapered wings
const wingGeo = new THREE.ConeGeometry(0.16, 1.7, 4);
const wingL = new THREE.Mesh(wingGeo, ravenMat);
const wingR = new THREE.Mesh(wingGeo, ravenMat);
wingL.position.set(-0.52, 0.04, 0.14);
wingR.position.set(0.52, 0.04, 0.14);
wingL.rotation.z = Math.PI / 2;
wingR.rotation.z = -Math.PI / 2;
wingL.rotation.y = -0.35;
wingR.rotation.y = 0.35;
raven.add(wingL, wingR);

raven.position.set(0, 5, 0);
scene.add(raven);

// pickups
const shinies = [];
const shinyGeo = new THREE.IcosahedronGeometry(0.24, 0);
const shinyMat = new THREE.MeshStandardMaterial({
  color: 0xffdf6a,
  emissive: 0x9a7b1f,
  emissiveIntensity: 0.85,
  metalness: 0.72,
  roughness: 0.2
});

function spawnShiny() {
  const m = new THREE.Mesh(shinyGeo, shinyMat);
  m.position.set((Math.random() - 0.5) * 180, 1.8 + Math.random() * 30, (Math.random() - 0.5) * 180);
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

  const boost = keys.has('shift') ? 1.8 : 1;
  const accel = 28 * boost;
  const damping = 4.0;

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const upInput = (keys.has(' ') ? 1 : 0) - ((keys.has('control') || keys.has('c')) ? 1 : 0);

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

  raven.position.x = THREE.MathUtils.clamp(raven.position.x, -210, 210);
  raven.position.z = THREE.MathUtils.clamp(raven.position.z, -210, 210);
  raven.position.y = THREE.MathUtils.clamp(raven.position.y, 1.3, 52);

  // Flight animation / banking
  const flapRate = 13 + vel.length() * 0.4;
  const flap = Math.sin(t * flapRate) * 0.62;
  wingL.rotation.z = Math.PI / 2 + flap;
  wingR.rotation.z = -Math.PI / 2 - flap;

  const sideSpeed = vel.dot(right);
  raven.rotation.y = yaw;
  raven.rotation.z = THREE.MathUtils.lerp(raven.rotation.z, -sideSpeed * 0.035, 0.12);
  raven.rotation.x = THREE.MathUtils.lerp(raven.rotation.x, -vel.y * 0.03 + pitch * 0.2, 0.1);

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
