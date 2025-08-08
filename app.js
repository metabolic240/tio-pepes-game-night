// Tío Pepe's: Game Night! — per-finger colors, 0.25 blob size, winner color takeover, varied win FX

const COUNTDOWN_START = 3; // seconds

// Distinct player colors (cycles if >10 touches)
const playerColors = [
  "#FF3B30", // red
  "#34C759", // green
  "#007AFF", // blue
  "#FF9500", // orange
  "#AF52DE", // purple
  "#5AC8FA", // light blue
  "#FF2D55", // pink
  "#FFD60A", // yellow
  "#4CD964", // lime
  "#5856D6"  // indigo
];
let colorIndex = 0;

const themes = [
  { name: "Neon Nights",  blobColor: "#00FFFF", glowColor: "#FF00AA",
    background: "radial-gradient(1200px 800px at 20% 30%, rgba(0,255,255,0.12), transparent 60%), radial-gradient(1200px 800px at 80% 70%, rgba(255,0,170,0.12), transparent 60%), #000" },
  { name: "Arcade Gold",  blobColor: "#FFD700", glowColor: "#8B00FF",
    background: "linear-gradient(45deg,#2e003e,#36013f 40%,#12001e)" },
  { name: "Ocean Wave",   blobColor: "#00CED1", glowColor: "#1E90FF",
    background: "linear-gradient(45deg,#000428,#004e92)" },
  { name: "Festival Pop", blobColor: "#FF1493", glowColor: "#FFFF00",
    background: "linear-gradient(135deg,#ff0080,#ff8c00)" },
  { name: "Minimal Luxe", blobColor: "#000000", glowColor: "#FFD700",
    background: "#ffffff" },
  { name: "Peruvian",     blobColor: "#FFD700", glowColor: "#FF0000",
    background: "linear-gradient(90deg,#FF0000 0%,#FFFFFF 50%,#FF0000 100%)" }
];

// Win FX types we’ll cycle through randomly
const WIN_EFFECTS = ["confetti", "ripples", "rays", "fireworks", "spiral"];

let currentTheme;
let touches = new Map(); // id -> { x, y, born, color }
let countdown = COUNTDOWN_START;
let countdownTimer = null;
let winnerId = null;
let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

// FX state
let confetti = [];
let ripples = [];
let rays = [];
let sparks = [];
let spiral = [];
let winEffectType = "confetti";

// Winner overlay (screen flood)
let victoryColor = "#ffffff";
let victoryAlpha = 0;         // animate 0 → 0.85 on win
let victoryTargetAlpha = 0.85;
let victoryFadeSpeed = 0.06;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const countdownEl = document.getElementById("countdown");
const replayBtn = document.getElementById("replayBtn");
const splash = document.getElementById("splash");
const hint = document.getElementById("hint");

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function pickRandomTheme() {
  currentTheme = themes[Math.floor(Math.random() * themes.length)];
  document.body.style.background = currentTheme.background;
  replayBtn.style.background = currentTheme.glowColor;
}

// Touch handling
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    touches.set(t.identifier, {
      x: t.clientX,
      y: t.clientY,
      born: performance.now(),
      color: playerColors[colorIndex++ % playerColors.length]
    });
  }
  if (!countdownTimer) startCountdown();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const obj = touches.get(t.identifier);
    if (obj) { obj.x = t.clientX; obj.y = t.clientY; }
  }
}, { passive: false });

function clearTouch(id) { touches.delete(id); }

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) clearTouch(t.identifier);
}, { passive: false });

canvas.addEventListener("touchcancel", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) clearTouch(t.identifier);
}, { passive: false });

// Helpers
function drawBlob(x, y, r, color, glow) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowBlur = 30;
  ctx.shadowColor = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawGlowRing(x, y, r, glow, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineWidth = 8;
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 25;
  ctx.shadowColor = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(x => x + x).join("") : m, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (v) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt)));
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// === WIN EFFECTS ===
// Confetti
function launchConfetti(x, y, base) {
  confetti.length = 0;
  const palette = [base, lighten(base, 0.35), lighten(base, 0.65)];
  const count = 100;
  for (let i = 0; i < count; i++) {
    confetti.push({
      x, y,
      vx: (Math.random() * 2 - 1) * 6,
      vy: Math.random() * -8 - 3,
      size: Math.random() * 7 + 3,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 110 + Math.random() * 50,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() * 2 - 1) * 0.2
    });
  }
}
function updateConfetti() {
  for (const c of confetti) {
    c.vy += 0.18;
    c.x += c.vx;
    c.y += c.vy;
    c.rot += c.vr;
    c.life -= 1;
  }
  confetti = confetti.filter(c => c.life > 0 && c.y < window.innerHeight + 60);
}
function drawConfetti() {
  for (const c of confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
    ctx.restore();
  }
}

// Ripples
function addRipple(x, y, color) { ripples.push({ x, y, r: 20, alpha: 1, color }); }
function triggerRipples(x, y, color) { ripples.length = 0; for (let i = 0; i < 8; i++) setTimeout(() => addRipple(x, y, color), i * 80); }
function updateRipples() {
  for (const r of ripples) { r.r += 7; r.alpha -= 0.02; }
  ripples = ripples.filter(r => r.alpha > 0);
}
function drawRipples() {
  for (const r of ripples) drawGlowRing(r.x, r.y, r.r, r.color, Math.max(0, r.alpha));
}

// Rays (radial beams from win point)
function launchRays(x, y, color) {
  rays.length = 0;
  const count = 24;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    rays.push({ x, y, ang, len: 0, max: Math.hypot(window.innerWidth, window.innerHeight), color, alpha: 1 });
  }
}
function updateRays() {
  for (const r of rays) {
    r.len += 32;
    r.alpha -= 0.012;
  }
  rays = rays.filter(r => r.alpha > 0);
}
function drawRays() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const r of rays) {
    ctx.strokeStyle = rgba(r.color, Math.max(0, r.alpha));
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + Math.cos(r.ang) * r.len, r.y + Math.sin(r.ang) * r.len);
    ctx.stroke();
  }
  ctx.restore();
}

// Fireworks (spark particles)
function launchFireworks(x, y, base) {
  sparks.length = 0;
  const palette = [base, lighten(base, 0.3), lighten(base, 0.6)];
  const count = 140;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 4 + Math.random() * 5;
    sparks.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 90 + Math.random() * 30
    });
  }
}
function updateFireworks() {
  for (const s of sparks) {
    s.vy += 0.08;
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 1;
  }
  sparks = sparks.filter(s => s.life > 0);
}
function drawFireworks() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of sparks) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Spiral (swirling trail)
function launchSpiral(x, y, color) {
  spiral.length = 0;
  const arms = 3;
  const points = 160;
  for (let a = 0; a < arms; a++) {
    for (let i = 0; i < points; i++) {
      const t = i * 0.12 + a * (Math.PI * 2 / arms);
      const r = i * 3;
      spiral.push({
        x: x + Math.cos(t) * r,
        y: y + Math.sin(t) * r,
        color,
        alpha: Math.max(0.15, 1 - i / points)
      });
    }
  }
}
function updateSpiral() {
  // Slow fade-out
  for (const p of spiral) p.alpha -= 0.01;
  spiral = spiral.filter(p => p.alpha > 0);
}
function drawSpiral() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of spiral) {
    ctx.fillStyle = rgba(p.color, Math.max(0, p.alpha));
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.restore();
}

// Countdown & Win
function startCountdown() {
  // Reset FX + overlay
  confetti.length = sparks.length = rays.length = spiral.length = 0;
  ripples.length = 0;
  victoryAlpha = 0;

  winnerId = null;
  countdown = COUNTDOWN_START;
  countdownEl.style.display = "block";
  countdownEl.textContent = String(countdown);
  hint.style.display = "none";

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownEl.textContent = String(countdown);
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownEl.textContent = "";
      pickWinner();
    }
  }, 1000);
}

function pickWinner() {
  const ids = Array.from(touches.keys());
  if (ids.length === 0) {
    countdownEl.style.display = "block";
    countdownEl.textContent = "No Touch!";
    replayBtn.style.display = "block";
    return;
  }
  const id = ids[Math.floor(Math.random() * ids.length)];
  winnerId = id;

  const wTouch = touches.get(winnerId);
  if (wTouch) {
    victoryColor = wTouch.color; // flood color
    winEffectType = WIN_EFFECTS[Math.floor(Math.random() * WIN_EFFECTS.length)];

    // Kick off the chosen FX
    if (winEffectType === "confetti") {
      launchConfetti(wTouch.x, wTouch.y, wTouch.color);
    } else if (winEffectType === "ripples") {
      triggerRipples(wTouch.x, wTouch.y, wTouch.color);
    } else if (winEffectType === "rays") {
      launchRays(wTouch.x, wTouch.y, wTouch.color);
    } else if (winEffectType === "fireworks") {
      launchFireworks(wTouch.x, wTouch.y, wTouch.color);
    } else if (winEffectType === "spiral") {
      launchSpiral(wTouch.x, wTouch.y, wTouch.color);
    }
  }
  replayBtn.style.display = "block";
}

function startRound() {
  replayBtn.style.display = "none";
  countdownEl.style.display = "none";
  hint.style.display = "block";
  pickRandomTheme();
  victoryAlpha = 0;
  if (touches.size > 0) startCountdown();
}

replayBtn.addEventListener("click", startRound);

// Splash → auto-start
window.addEventListener("load", () => {
  setTimeout(() => {
    splash.style.display = "none";
    startRound();
  }, 1000);
});

// Render loop
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Blob size: split the difference (0.25 of min dimension)
  const now = performance.now();
  const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.25;

  for (const [id, t] of touches.entries()) {
    const pulse = (Math.sin((now - t.born) / 200) + 1) * 0.5; // 0..1
    const r = baseRadius * (0.9 + 0.08 * pulse);
    drawBlob(t.x, t.y, r, t.color, t.color);
    if (String(id) === String(winnerId)) {
      drawGlowRing(t.x, t.y, r + 12, t.color, 0.9);
    }
  }

  // WIN OVERLAY (flood in winner color under effects)
  if (winnerId !== null) {
    victoryAlpha = Math.min(victoryTargetAlpha, victoryAlpha + victoryFadeSpeed);
    ctx.fillStyle = rgba(victoryColor, victoryAlpha);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Effects (draw above flood)
  if (winnerId !== null) {
    if (winEffectType === "confetti") {
      updateConfetti(); drawConfetti();
    } else if (winEffectType === "ripples") {
      updateRipples();  drawRipples();
    } else if (winEffectType === "rays") {
      updateRays();     drawRays();
    } else if (winEffectType === "fireworks") {
      updateFireworks();drawFireworks();
    } else if (winEffectType === "spiral") {
      updateSpiral();   drawSpiral();
    }
  }

  requestAnimationFrame(render);
}
render();
