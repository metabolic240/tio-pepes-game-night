// app.js — Multi-touch picker with screen-wipe winner, blip/win sounds, auto-reset

// Elements
const canvas      = document.getElementById("gameCanvas");
const ctx         = canvas.getContext("2d");
const splash      = document.getElementById("splash");
const countdownEl = document.getElementById("countdown");
const replayBtn   = document.getElementById("replayBtn");
const hint        = document.getElementById("hint");

// Hide splash on first touch so canvas can get events
splash.addEventListener("touchstart", e => {
  splash.style.display = "none";
  e.preventDefault();
}, { passive: false });

// State
let touches        = new Map();    // touchId → { x, y, color }
let roundState     = "idle";       // "idle" | "countdown" | "won"
let countdown      = 3;
let countdownTimer = null;
let winnerId       = null;
let winnerStart    = 0;
let winnerColor    = "#FFF";
const WIPE_DURATION = 1000;        // ms for full wipe

// Color palette for fingers
const COLORS = ["#FF4D4D","#4DD0FF","#4DFF91","#FFD24D","#A64DFF","#FF6EC7","#4DFFDB","#FF8F4D"];
let nextColor = 0;

// Confetti particles for flashy winner celebration
let confetti = []; // each {x,y,vx,vy,color,life}

// Audio
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
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
  g.gain.exponentialRampToValueAtTime(gain,    t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur);
}
function echo(freq,{repeats=2,delay=0.1,decay=0.6,baseGain=0.1,dur=0.15,type="sine",startWhen=0}={}) {
  for (let i=0; i<=repeats; i++) {
    note(freq, {
      type,
      dur,
      gain: baseGain * Math.pow(decay,i),
      when: startWhen + i*delay
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

function spawnConfetti(origin) {
  const pos = origin || { x: canvas.width/2, y: canvas.height/2 };
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    confetti.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0
    });
  }
}

// Handle HiDPI
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Countdown
function startCountdown() {
  if (roundState !== "idle" || touches.size === 0) return;
  roundState = "countdown";
  countdown  = 3;
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

// Pick winner & start wipe
function pickWinner() {
  const ids = Array.from(touches.keys());
  if (!ids.length) {
    resetRound();
    return;
  }
  winnerId    = ids[Math.floor(Math.random() * ids.length)];
  const winner = touches.get(winnerId);
  winnerColor  = winner ? winner.color : "#FFF";
  roundState   = "won";
  winnerStart  = performance.now();
  playWinSound();
  spawnConfetti(winner);
}

// Reset for next round
function resetRound() {
  touches.clear();
  winnerId    = null;
  roundState  = "idle";
  winnerStart = 0;
  confetti    = [];
  countdownEl.style.display = "none";
  replayBtn.style.display   = "none";
  hint.style.display        = "block";
}

// Touch handlers
canvas.addEventListener("touchstart", e => {
  if (roundState === "won") return;

  initAudio();
  e.preventDefault();
  for (let t of e.changedTouches) {
    const color = COLORS[nextColor++ % COLORS.length];
    touches.set(t.identifier, { x: t.clientX, y: t.clientY, color });
    playBlip();
  }
  if (!countdownTimer) startCountdown();
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (roundState === "won") return;
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (touches.has(t.identifier)) {
      const data = touches.get(t.identifier);
      touches.set(t.identifier, { x: t.clientX, y: t.clientY, color: data.color });
    }
  }
}, { passive: false });

canvas.addEventListener("touchend",   e => { for (let t of e.changedTouches) touches.delete(t.identifier); });
canvas.addEventListener("touchcancel",e => { for (let t of e.changedTouches) touches.delete(t.identifier); });

// Manual reset if desired
replayBtn.addEventListener("click", resetRound);

// Render loop
function render(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw all finger blobs with glow and pulse
  for (let [, pos] of touches) {
    const pulse = 5 * Math.sin(ts / 200);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 50 + pulse, 0, 2 * Math.PI);
    ctx.fillStyle = pos.color;
    ctx.shadowColor = pos.color;
    ctx.shadowBlur  = 20;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.lineWidth   = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
  }

  // Confetti celebration
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life++;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 6, 6);
    if (p.life > 60) confetti.splice(i,1);
  }

  // Winner wipe
  if (roundState === "won" && winnerId !== null) {
    const elapsed = ts - winnerStart;
    const t       = Math.min(elapsed / WIPE_DURATION, 1);
    const ease    = t * t * t;
    const maxR    = Math.hypot(canvas.width, canvas.height);
    const r       = maxR * ease;
    const pos     = touches.get(winnerId) || { x: canvas.width/2, y: canvas.height/2 };

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
    ctx.globalAlpha = t;
    ctx.fillStyle   = winnerColor;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (elapsed > WIPE_DURATION + 1000 && confetti.length === 0) resetRound();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
