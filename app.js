// app.js — Realtime multi-finger picker with colored touches and winner color wash

// Elements
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const splash = document.getElementById("splash");
const countdownEl = document.getElementById("countdown");
const replayBtn = document.getElementById("replayBtn");
const hint = document.getElementById("hint");
const statusEl = document.getElementById("status");
const versionBadge = document.getElementById("versionBadge");

// State
const touches = new Map(); // pointerId → { x, y, color, joinedAt }
let roundState = "idle"; // "idle" | "countdown" | "won"
let countdown = 3;
let countdownTimer = null;
let winnerId = null;
let winnerStart = 0;
let nextColorIndex = 0;

const COUNTDOWN_SECONDS = 3;
const WASH_DURATION = 1200;
const WINNER_HOLD_DURATION = 2600;
const FINGER_RADIUS = 48;
const RING_COUNT = 6;
const RING_INTERVAL = 100;
const RING_SPREAD = 50;
const APP_VERSION = "Color rings v10";
const COLORS = [
  "#ff4d6d",
  "#ffd166",
  "#06d6a0",
  "#4cc9f0",
  "#b517ff",
  "#ff8fab",
  "#f77f00",
  "#80ed99",
  "#90dbf4",
  "#c77dff"
];

// Audio
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  else if (audioCtx.state === "suspended") audioCtx.resume();
}

function note(freq, { type = "sine", dur = 0.2, gain = 0.1, when = 0 } = {}) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

function playJoinSound() {
  initAudio();
  note(560 + touches.size * 35, { type: "square", dur: 0.06, gain: 0.08 });
}

function playWinSound() {
  initAudio();
  note(659, { type: "triangle", dur: 0.14, gain: 0.12 });
  note(784, { type: "triangle", dur: 0.16, gain: 0.12, when: 0.12 });
  note(988, { type: "triangle", dur: 0.32, gain: 0.16, when: 0.26 });
}

// Canvas sizing
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function hideSplash() {
  splash.classList.add("hidden");
}

function updateStatus(message) {
  statusEl.textContent = message;
  versionBadge.textContent = APP_VERSION;
}

function colorForNextFinger() {
  const color = COLORS[nextColorIndex % COLORS.length];
  nextColorIndex++;
  return color;
}

function startCountdown() {
  if (roundState !== "idle" || touches.size === 0) return;

  roundState = "countdown";
  countdown = COUNTDOWN_SECONDS;
  countdownEl.textContent = countdown;
  countdownEl.style.display = "block";
  hint.textContent = "Keep holding. Add more fingers before zero!";
  updateStatus(`${touches.size} finger${touches.size === 1 ? "" : "s"} in`);

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownEl.textContent = countdown;
      updateStatus(`${touches.size} finger${touches.size === 1 ? "" : "s"} in`);
      return;
    }

    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownEl.style.display = "none";
    pickWinner();
  }, 1000);
}

function cancelCountdownIfEmpty() {
  if (roundState !== "countdown" || touches.size > 0) return;

  clearInterval(countdownTimer);
  countdownTimer = null;
  roundState = "idle";
  countdownEl.style.display = "none";
  hint.textContent = "Place your fingers and hold…";
  updateStatus("Waiting for players");
}

function pickWinner() {
  const ids = Array.from(touches.keys());
  if (!ids.length) {
    resetRound();
    return;
  }

  winnerId = ids[Math.floor(Math.random() * ids.length)];
  roundState = "won";
  winnerStart = performance.now();
  hint.textContent = "Winner!";
  updateStatus("Winner selected!");
  replayBtn.style.display = "block";
  playWinSound();
}

function resetRound() {
  clearInterval(countdownTimer);
  touches.clear();
  winnerId = null;
  roundState = "idle";
  winnerStart = 0;
  countdownTimer = null;
  countdownEl.style.display = "none";
  replayBtn.style.display = "none";
  hint.textContent = "Place your fingers and hold…";
  updateStatus("Waiting for players");
}

function addOrUpdatePointer(e) {
  hideSplash();
  initAudio();
  e.preventDefault();

  if (roundState === "won") return;

  const existing = touches.get(e.pointerId);
  touches.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    color: existing?.color || colorForNextFinger(),
    joinedAt: existing?.joinedAt || performance.now()
  });

  canvas.setPointerCapture?.(e.pointerId);
  if (!existing) playJoinSound();
  if (!countdownTimer) startCountdown();
  else updateStatus(`${touches.size} finger${touches.size === 1 ? "" : "s"} in`);
}

function movePointer(e) {
  if (roundState === "won" || !touches.has(e.pointerId)) return;

  e.preventDefault();
  const touch = touches.get(e.pointerId);
  touch.x = e.clientX;
  touch.y = e.clientY;
}

function removePointer(e) {
  if (roundState === "won") return;

  touches.delete(e.pointerId);
  canvas.releasePointerCapture?.(e.pointerId);
  updateStatus(touches.size ? `${touches.size} finger${touches.size === 1 ? "" : "s"} in` : "Waiting for players");
  cancelCountdownIfEmpty();
}

canvas.addEventListener("pointerdown", addOrUpdatePointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", removePointer);
canvas.addEventListener("pointercancel", removePointer);
canvas.addEventListener("pointerleave", e => {
  if (e.pointerType === "mouse") removePointer(e);
});

replayBtn.addEventListener("click", resetRound);


// Prevent iOS text loupe / zoom gestures while fingers are held on the game area.
function preventNativeGesture(e) {
  e.preventDefault();
}

document.addEventListener("gesturestart", preventNativeGesture, { passive: false });
document.addEventListener("gesturechange", preventNativeGesture, { passive: false });
document.addEventListener("gestureend", preventNativeGesture, { passive: false });
document.addEventListener("touchstart", preventNativeGesture, { passive: false });
document.addEventListener("touchmove", preventNativeGesture, { passive: false });
canvas.addEventListener("contextmenu", preventNativeGesture);
canvas.addEventListener("dblclick", preventNativeGesture);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=color-rings-v10").then(registration => {
      registration.update();
    }).catch(() => {
      // The game still works without offline support.
    });
  });
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function drawRadiatingRings(pos, ts, isWinner = false) {
  const age = Math.max(0, ts - pos.joinedAt);
  const { r, g, b } = hexToRgb(pos.color);
  const spin = age / 520 + (pos.joinedAt % 360) * (Math.PI / 180);

  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = pos.color;
  ctx.shadowBlur = isWinner ? 36 : 24;
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < RING_COUNT; i++) {
    const progress = ((age / RING_INTERVAL) + (i / RING_COUNT)) % 1;
    const radius = FINGER_RADIUS + 14 + progress * RING_SPREAD;
    const edgeAlpha = (1 - progress) * (isWinner ? 0.95 : 0.82);
    const ringWidth = (isWinner ? 11 : 8) * (1 - progress * 0.4);

    // Main traveling wave ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${edgeAlpha})`;
    ctx.lineWidth = ringWidth;
    ctx.stroke();

    // Dynamic swirl segments to make the outward motion obvious and lively
    const segmentArc = (isWinner ? 0.34 : 0.26) * Math.PI;
    const segmentGap = (isWinner ? 0.72 : 0.9) * Math.PI;
    const start = spin + i * 0.92;
    ctx.lineWidth = ringWidth * 0.72;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${edgeAlpha * 0.9})`;

    for (let seg = 0; seg < 2; seg++) {
      const a0 = start + seg * segmentGap;
      const a1 = a0 + segmentArc;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + (seg * 6 - 3), a0, a1);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTouch(pos, ts, isWinner = false) {
  drawRadiatingRings(pos, ts, isWinner);

  ctx.save();
  ctx.shadowColor = pos.color;
  ctx.shadowBlur = isWinner ? 40 : 24;

  const pulse = 1 + Math.sin(ts / 180 + pos.joinedAt) * 0.04;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, FINGER_RADIUS * pulse, 0, 2 * Math.PI);
  ctx.fillStyle = pos.color;
  ctx.fill();

  ctx.lineWidth = isWinner ? 8 : 5;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();
  ctx.restore();
}

function render(ts) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const [id, pos] of touches) {
    drawTouch(pos, ts, roundState === "won" && id === winnerId);
  }

  if (roundState === "won" && winnerId !== null) {
    const winner = touches.get(winnerId);
    const elapsed = ts - winnerStart;
    const t = Math.min(elapsed / WASH_DURATION, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const maxR = Math.hypot(window.innerWidth, window.innerHeight);
    const r = maxR * ease;
    const pos = winner || { x: window.innerWidth / 2, y: window.innerHeight / 2, color: "#ffffff" };

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = pos.color;
    ctx.fill();
    ctx.restore();

    if (winner) drawTouch(winner, ts, true);
    if (elapsed >= WASH_DURATION + WINNER_HOLD_DURATION) resetRound();
  }

  requestAnimationFrame(render);
}

updateStatus("Waiting for players");
requestAnimationFrame(render);
