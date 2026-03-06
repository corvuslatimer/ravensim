const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const state = {
  started: false,
  keys: new Set(),
  score: 0,
  cawTimer: 0,
  t: 0,
  raven: { x: 300, y: 320, vx: 0, vy: 0, speed: 220 },
  shinies: []
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function spawnShinies(n = 12) {
  state.shinies = [];
  for (let i = 0; i < n; i++) {
    state.shinies.push({
      x: Math.random() * (canvas.width - 80) + 40,
      y: Math.random() * (canvas.height - 160) + 80,
      r: 6 + Math.random() * 3,
      tw: Math.random() * Math.PI * 2
    });
  }
}
spawnShinies();

window.addEventListener('keydown', (e) => {
  state.keys.add(e.key.toLowerCase());
  if (e.key === ' ') state.cawTimer = 0.25;
});
window.addEventListener('keyup', (e) => state.keys.delete(e.key.toLowerCase()));

startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  state.started = true;
});

function update(dt) {
  if (!state.started) return;
  state.t += dt;
  state.cawTimer = Math.max(0, state.cawTimer - dt);

  const k = state.keys;
  const xDir = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const yDir = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
  const boost = k.has('shift') ? 1.45 : 1;

  state.raven.vx = xDir * state.raven.speed * boost;
  state.raven.vy = yDir * state.raven.speed * boost;

  state.raven.x += state.raven.vx * dt;
  state.raven.y += state.raven.vy * dt;

  state.raven.x = Math.max(20, Math.min(canvas.width - 20, state.raven.x));
  state.raven.y = Math.max(20, Math.min(canvas.height - 20, state.raven.y));

  for (let i = state.shinies.length - 1; i >= 0; i--) {
    const s = state.shinies[i];
    s.tw += dt * 6;
    const dx = s.x - state.raven.x;
    const dy = s.y - state.raven.y;
    if (dx * dx + dy * dy < (s.r + 14) ** 2) {
      state.shinies.splice(i, 1);
      state.score += 1;
    }
  }

  if (state.shinies.length === 0) spawnShinies(14);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#121a2a');
  g.addColorStop(1, '#1e2e3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // hills
  ctx.fillStyle = 'rgba(20,36,40,0.55)';
  for (let i = 0; i < 4; i++) {
    const y = canvas.height * (0.72 + i * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width; x += 30) {
      ctx.lineTo(x, y + Math.sin(x * 0.005 + i + state.t * 0.15) * 10);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShinies() {
  for (const s of state.shinies) {
    const pulse = 0.6 + 0.4 * Math.sin(s.tw);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 226, 120, ${0.5 + pulse * 0.35})`;
    ctx.fill();
  }
}

function drawRaven() {
  const { x, y } = state.raven;
  ctx.save();
  ctx.translate(x, y);

  // body
  ctx.fillStyle = '#0a0c10';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 11, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // wing flap
  const flap = Math.sin(state.t * 12) * 4;
  ctx.beginPath();
  ctx.ellipse(-8, -2, 12, 6 + flap * 0.35, -0.5, 0, Math.PI * 2);
  ctx.ellipse(8, -2, 12, 6 - flap * 0.35, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // beak
  ctx.fillStyle = '#d0d5df';
  ctx.beginPath();
  ctx.moveTo(14, -2);
  ctx.lineTo(23, 0);
  ctx.lineTo(14, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  if (state.cawTimer > 0) {
    ctx.strokeStyle = `rgba(230,240,255,${state.cawTimer * 2})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 16, y, 8 + i * 8 + (0.25 - state.cawTimer) * 30, -0.6, 0.6);
      ctx.stroke();
    }
  }
}

function drawUI() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(14, 14, 190, 64);
  ctx.fillStyle = '#eef4ff';
  ctx.font = '700 20px Inter, sans-serif';
  ctx.fillText(`Shiny: ${state.score}`, 24, 41);
  ctx.font = '500 13px Inter, sans-serif';
  ctx.fillStyle = '#bcc7d8';
  ctx.fillText('Raven Simulator v0.1', 24, 62);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  drawBackground();
  drawShinies();
  drawRaven();
  drawUI();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
