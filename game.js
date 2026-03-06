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
scene.background = new THREE.Color(0x8fa9c4);
scene.fog = new THREE.Fog(0x8fa9c4, 35, 180);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 12);

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x334433, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(20, 30, 10);
scene.add(sun);

// ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshStandardMaterial({ color: 0x314c3a, roughness: 0.95, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
scene.add(ground);

// simple trees
const treeMat = new THREE.MeshStandardMaterial({ color: 0x1f2e1f, roughness: 1 });
for (let i = 0; i < 120; i++) {
  const h = 2 + Math.random() * 7;
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.8 + h * 0.2, h, 6), treeMat);
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 240;
  tree.position.set(Math.cos(angle) * dist, h * 0.5 - 1, Math.sin(angle) * dist);
  scene.add(tree);
}

// raven placeholder (low-poly-ish group)
const raven = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.8 })
);
body.scale.set(1.4, 0.8, 1);
raven.add(body);

const wingGeo = new THREE.BoxGeometry(1.2, 0.08, 0.5);
const wingL = new THREE.Mesh(wingGeo, body.material);
const wingR = new THREE.Mesh(wingGeo, body.material);
wingL.position.set(-0.9, 0, 0);
wingR.position.set(0.9, 0, 0);
raven.add(wingL, wingR);

const beak = new THREE.Mesh(
  new THREE.ConeGeometry(0.12, 0.45, 5),
  new THREE.MeshStandardMaterial({ color: 0xcfd5df, roughness: 0.4 })
);
beak.rotation.x = Math.PI / 2;
beak.position.set(0, -0.02, 0.75);
raven.add(beak);

raven.position.set(0, 4, 0);
scene.add(raven);

// pickups
const shinies = [];
const shinyGeo = new THREE.IcosahedronGeometry(0.28, 0);
const shinyMat = new THREE.MeshStandardMaterial({ color: 0xffdf6a, emissive: 0x8a6d1c, emissiveIntensity: 0.7, metalness: 0.7, roughness: 0.2 });

function spawnShinies(n = 40) {
  while (shinies.length) scene.remove(shinies.pop());
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shinyGeo, shinyMat);
    m.position.set((Math.random() - 0.5) * 140, 1.5 + Math.random() * 26, (Math.random() - 0.5) * 140);
    scene.add(m);
    shinies.push(m);
  }
}
spawnShinies();

const keys = new Set();
let started = false;
let score = 0;
let yaw = 0;
let pitch = -0.08;

window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function setPointerLock() {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
}

document.addEventListener('mousemove', (e) => {
  if (!started || document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0018;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
});

canvas.addEventListener('click', () => {
  if (started) setPointerLock();
});

startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  started = true;
  setPointerLock();
});

function update(dt, t) {
  if (!started) return;

  const boost = keys.has('shift') ? 1.85 : 1;
  const speed = 12 * boost;
  const up = (keys.has(' ') ? 1 : 0) - ((keys.has('control') || keys.has('c')) ? 1 : 0);

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const move = new THREE.Vector3();

  if (keys.has('w')) move.add(forward);
  if (keys.has('s')) move.sub(forward);
  if (keys.has('d')) move.add(right);
  if (keys.has('a')) move.sub(right);
  move.y += up;

  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
  raven.position.add(move);

  // bounds / floor
  raven.position.x = THREE.MathUtils.clamp(raven.position.x, -180, 180);
  raven.position.z = THREE.MathUtils.clamp(raven.position.z, -180, 180);
  raven.position.y = THREE.MathUtils.clamp(raven.position.y, 1.2, 45);

  // bird animation
  const flap = Math.sin(t * 16) * 0.7;
  wingL.rotation.z = flap;
  wingR.rotation.z = -flap;
  raven.rotation.y = yaw + Math.PI;

  // camera follow
  const camOffset = new THREE.Vector3(0, 1.8, -4.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.lerp(raven.position.clone().add(camOffset), 0.12);
  const lookTarget = raven.position.clone().add(new THREE.Vector3(Math.sin(yaw), Math.sin(pitch) * 0.8, Math.cos(yaw)).multiplyScalar(18));
  camera.lookAt(lookTarget);

  // rotate + collect shinies
  for (let i = shinies.length - 1; i >= 0; i--) {
    const s = shinies[i];
    s.rotation.y += dt * 2.0;
    s.position.y += Math.sin(t * 3 + i) * 0.003;
    if (s.position.distanceTo(raven.position) < 1.2) {
      scene.remove(s);
      shinies.splice(i, 1);
      score += 1;
      scoreEl.textContent = String(score);
    }
  }

  if (shinies.length === 0) spawnShinies(55);
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
