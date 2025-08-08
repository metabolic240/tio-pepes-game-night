// Tío Pepe's: Game Night! — per-finger colors, bigger blobs (1.5x), winner-colored animations

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
  {
    name: "Neon Nights",
    blobColor: "#00FFFF",
    glowColor: "#FF00AA",
    background:
      "radial-gradient(1200px 800px at 20% 30%, rgba(0,255,255,0.12), transparent 60%), radial-gradient(1200px 800px at 80% 70%, rgba(255,0,170,0.12), transparent 60%), #000",
    effect: "confetti"
  },
  {
    name: "Arcade Gold",
    blobColor: "#FFD700",
    glowColor: "#8B00FF",
    background: "linear-gradient(45deg,#2e003e,#36013f 40%,#12001e)",
    effect: "confetti"
  },
  {
    name: "Ocean Wave",
    blobColor: "#00CED1",
    glowColor: "#1E90FF",
    background: "linear-gradient(45deg,#000428,#004e92)",
    effect: "ripple"
  },
  {
    name: "Festival Pop",
    blobColor: "#FF1493",
    glowColor: "#FFFF00",
    background: "linear-gradient(135deg,#ff0080,#ff8c00)",
    effect: "confetti"
  },
  {
    name: "Minimal Luxe",
    blobColor: "#000000",
    glowColor: "#FFD700",
    background: "#ffffff",
    effect: "ripple"
  },
  {
    name: "Peruvian",
    blobColor: "#FFD700",
    glowColor: "#FF0000",
    background: "linear-gradient(90deg,#FF0000 0%,#FFFFFF 50%,#FF0000 100%)",
    effect: "confetti"
  }
];

let currentTheme;
let touches = new Map(); // id -> { x, y, born, color }
let countdown = COUNTDOWN_START;
let countdownTimer = null;
let winnerId = null;
let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
let confetti = [];
let ripples = [];

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
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      touches.set(t.identifier, {
        x: t.clientX,
        y: t.clientY,
        born: performance.now(),
        color: playerColors[colorIndex++ % playerColors.length]
      });
    }
    if (!countdownTimer) {
      startCountdown();
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const obj = touches.get(t.identifier);
      if (obj) {
        obj.x = t.clientX;
        obj.y = t.clientY;
      }
    }
  },
  { passive: false }
);

function clearTouch(id) {
  touches.delete(id);
}

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) clearTouch(t.identifier);
  },
  { passive: false }
);
canvas.addEventListener(
  "touchcancel",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) clearTouch(t.identifier);
  },
  { passive: false }
);

// Drawing helpers
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

// --- Winner-color palettes ---
function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(x => x+x).join("") : m, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function toHex(v) {
  const s = Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return s;
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + (255 - r) * amt)}${toHex(g + (255 - g) * amt)}${toHex(b + (255 - b) * amt)}`;
}
function winnerPalette(base) {
  return [base, lighten(base, 0.35), lighten(base, 0.65)];
}

// Winner effects
function launchConfetti(x, y, baseColor) {
  const palette = winnerPalette(baseColor);
  confetti.length = 0;
  const count = 80;
  for (let i = 0; i < count; i++) {
    confetti.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * 5,
      vy: Math.random() * -7 - 2,
      size: Math.random() * 6 + 3,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 120 + Math.random() * 40
    });
  }
}
function updateConfetti() {
  for (const c of confetti) {
    c.vy += 0.15;
    c.x += c.vx;
    c.y += c.vy;
    c.life -= 1;
  }
  confetti = confetti.filter((c) => c.life > 0 && c.y < window.innerHeight + 40);
}
function drawConfetti() {
  for (const c of confetti) {
    ctx.save();
    ctx.fillStyle = c.color;
    ctx.translate(c.x, c.y);
    ctx.rotate((c.life % 360) * 0.05);
    ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
    ctx.restore();
  }
}

function addRipple(x, y, color) {
  ripples.push({ x, y, r: 20, alpha: 1, color });
}
function updateRipples() {
  for (const r of ripples) {
    r.r += 6;
    r.alpha -= 0.02;
  }
  ripples = ripples.filter((r) => r.alpha > 0);
}
function drawRipples() {
  for (const r of ripples) {
    drawGlowRing(r.x, r.y, r.r, r.color, Math.max(0, r.alpha));
  }
}

function startCountdown() {
  winnerId = null;
  confetti.length = 0;
  ripples.length = 0;
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
    if (currentTheme.effect === "confetti") {
      launchConfetti(wTouch.x, wTouch.y, wTouch.color);
    } else {
      for (let i = 0; i < 8; i++)
        setTimeout(() => addRipple(wTouch.x, wTouch.y, wTouch.color), i * 80);
    }
  }
  replayBtn.style.display = "block";
}

function startRound() {
  replayBtn.style.display = "none";
  countdownEl.style.display = "none";
  hint.style.display = "block";
  pickRandomTheme();
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

  // 1.5x larger than your 0.2 setting => 0.3 of min dimension
  const now = performance.now();
  const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.3;

  for (const [id, t] of touches.entries()) {
    const pulse = (Math.sin((now - t.born) / 200) + 1) * 0.5; // 0..1
    const r = baseRadius * (0.9 + 0.08 * pulse);
    drawBlob(t.x, t.y, r, t.color, t.color);
    if (String(id) === String(winnerId)) {
      drawGlowRing(t.x, t.y, r + 12, t.color, 0.9);
    }
  }

  if (currentTheme && currentTheme.effect === "confetti") {
    updateConfetti();
    drawConfetti();
  } else {
    updateRipples();
    drawRipples();
  }

  requestAnimationFrame(render);
}
render();
