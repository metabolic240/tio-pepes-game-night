// app.js — Finger picker with screen-wipe winner, press-blip & win echo, auto-reset

// Elements
const canvas      = document.getElementById("gameCanvas");
const ctx         = canvas.getContext("2d");
const splash      = document.getElementById("splash");
const countdownEl = document.getElementById("countdown");
const replayBtn   = document.getElementById("replayBtn");
const hint        = document.getElementById("hint");

// State
let touches        = new Map();      // touchId → { x, y }
let roundState     = "idle";         // "idle" | "countdown" | "won"
let countdown      = 3;
let countdownTimer = null;
let winnerId       = null;
let winnerStart    = 0;
const WIPE_DURATION = 1000;         // ms

// Audio setup
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  else if (audioCtx.state === "suspended") audioCtx.resume();
}
function note(freq,{type="sine",dur=0.2,gain=0.1,when=0}={}) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const o  = audioCtx.createOscillator();
  const g  = audioCtx.createGain();
  o.type            = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain,      t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,   t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur);
}
function echo(freq,{repeats=2,delay=0.1,decay=0.6,baseGain=0.1,dur=0.15,type="sine",startWhen=0}={}) {
  for (let i=0; i<=repeats; i++) {
    note(freq, {
      type,
      dur,
      gain: baseGain * Math.pow(decay, i),
      when: startWhen + i * delay
    });
  }
}
function playBlip() {
  initAudio();
  echo(660, { repeats:1, delay:0.05, decay:0.5, baseGain:0.12, dur:0.05, type:"square" });
}
function playWinSound() {
  initAudio();
  echo(880, { repeats:3, delay:0.1, decay:0.6, baseGain:0.15, dur:0.2, type:"triangle" });
}

// Handle high-DPI
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Countdown logic
function startCountdown() {
  if (roundState !== "idle" || !touches.size) return;
  roundState      = "countdown";
  countdown       = 3;
  countdownEl.textContent = countdown;
  countdownEl.style.display = "block";
  hint.style.display = "none";

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownEl.textContent = countdown;
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownEl.style.display = "none";
      pickWinner();
    }
  }, 1000);
}

// Random winner & start wipe
function pickWinner() {
  const ids = Array.from(touches.keys());
  if (!ids.length) return resetRound();

  winnerId    = ids[Math.floor(Math.random() * ids.length)];
  roundState  = "won";
  winnerStart = performance.now();
  playWinSound();
}

// Reset everything for next round
function resetRound() {
  touches.clear();
  winnerId    = null;
  roundState  = "idle";
  winnerStart = 0;
  countdownEl.style.display = "none";
  replayBtn.style.display   = "none";
  hint.style.display        = "block";
}

// Touch handlers
canvas.addEventListener("touchstart", e => {
  // First touch hides splash
  if (splash.style.display !== "none") {
    splash.style.display = "none";
    return;
  }
  if (roundState !== "idle") return;

  initAudio();
  e.preventDefault();
  for (let t of e.changedTouches) {
    touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    playBlip();
  }
  startCountdown();
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (roundState !== "countdown") return;
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (touches.has(t.identifier)) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }
}, { passive: false });

canvas.addEventListener("touchend",   e => { for (let t of e.changedTouches) touches.delete(t.identifier); });
canvas.addEventListener("touchcancel",e => { for (let t of e.changedTouches) touches.delete(t.identifier); });

// Manual reset if needed
replayBtn.addEventListener("click", resetRound);

// Main render loop
function render(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw finger blobs
  for (let [id, pos] of touches) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 50, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFF";
    ctx.fill();
  }

  // Winner wipe animation
  if (roundState === "won" && winnerId !== null) {
    const elapsed = ts - winnerStart;
    const t       = Math.min(elapsed / WIPE_DURATION, 1);
    const ease    = t * t * t;  // cubic ease-in
    const maxR    = Math.hypot(canvas.width, canvas.height);
    const r       = maxR * ease;
    const pos     = touches.get(winnerId) || { x: canvas.width/2, y: canvas.height/2 };

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();

    if (t >= 1) {
      resetRound();
    }
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
