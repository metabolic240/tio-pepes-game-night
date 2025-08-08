// Tío Pepe's: Game Night! — per-finger colors, smaller blobs (0.15), winner-blob shrinks,
// ease-in winner color takeover, premium FX, losers shrink away, + musical procedural audio (no noise).

const COUNTDOWN_START = 3;

// Distinct player colors (cycles if >10 touches)
const playerColors = ["#FF3B30","#34C759","#007AFF","#FF9500","#AF52DE","#5AC8FA","#FF2D55","#FFD60A","#4CD964","#5856D6"];
let colorIndex = 0;

const themes = [
  { name:"Neon Nights",  glowColor:"#FF00AA", background:"radial-gradient(1200px 800px at 20% 30%, rgba(0,255,255,0.12), transparent 60%), radial-gradient(1200px 800px at 80% 70%, rgba(255,0,170,0.12), transparent 60%), #000" },
  { name:"Arcade Gold",  glowColor:"#8B00FF", background:"linear-gradient(45deg,#2e003e,#36013f 40%,#12001e)" },
  { name:"Ocean Wave",   glowColor:"#1E90FF", background:"linear-gradient(45deg,#000428,#004e92)" },
  { name:"Festival Pop", glowColor:"#FFFF00", background:"linear-gradient(135deg,#ff0080,#ff8c00)" },
  { name:"Minimal Luxe", glowColor:"#FFD700", background:"#ffffff" },
  { name:"Peruvian",     glowColor:"#FF0000", background:"linear-gradient(90deg,#FF0000 0%,#FFFFFF 50%,#FF0000 100%)" }
];

// Win FX types we’ll cycle randomly
const WIN_EFFECTS = ["confetti","ripples","rays","fireworks","spiral","sparkles","bokeh"];

let currentTheme;
let touches = new Map(); // id -> { x, y, born, color, shrink }
let countdown = COUNTDOWN_START;
let countdownTimer = null;
let winnerId = null;

let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

// Premium FX state
let confetti = [];
let ripples = [];
let rays = [];
let sparks = [];
let spiral = [];
let twinkles = []; // sparkles
let orbs = [];     // bokeh
let winEffectType = "confetti";

// Winner takeover state (time-based, ease-in)
let victoryColor = "#ffffff";
let winnerGrowT = 0;                // 0..1 progress for the wipe
let winnerGrowDuration = 1.2;       // seconds for full wipe (slightly slower/dramatic)
let winnerPos = { x: 0, y: 0 };
let winnerStartTime = 0;            // timestamp when win triggered

// --- Procedural Audio (no files, musical) ---
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } else if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Utilities
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function note(freq, { type="sine", dur=0.18, gain=0.12, when=0 } = {}) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + dur);
}

// Echo helper: repeat the same tone a few times, decaying
function echo(freq, { repeats=3, delay=0.11, decay=0.6, baseGain=0.09, dur=0.12, type="sine", startWhen=0 } = {}) {
  for (let i = 0; i <= repeats; i++) {
    note(freq, { type, dur, gain: baseGain * Math.pow(decay, i), when: startWhen + i * delay });
  }
}

// Simple arpeggio over a scale pattern with echo on each tone
function arpeggio({ rootFreq=440, semis=[0,2,4,7,12], tempo=12, waveshape="triangle", baseGain=0.09 }) {
  if (!audioCtx) return;
  const stepDur = 60 / tempo; // seconds per step
  semis.forEach((s, i) => {
    const f = rootFreq * Math.pow(2, s/12);
    echo(f, { repeats: 2, delay: 0.1, decay: 0.5, baseGain, dur: 0.12, type: waveshape, startWhen: i * stepDur * 0.8 });
  });
}

// A compact triad chord with a tiny echo tail
function triad({ rootFreq=440, type="triangle", gain=0.08, dur=0.35 }) {
  if (!audioCtx) return;
  const tri = [1, 5/4, 3/2].map(r => rootFreq * r);
  tri.forEach((f, i) => echo(f, { repeats: 2, delay: 0.1, decay: 0.5, baseGain: gain*(i===0?1:0.9), dur: 0.16 + i*0.02, type }));
}

// pick a root based on a color string for subtle variation
const ROOTS = [392.00, 440.00, 493.88, 523.25, 587.33]; // G4, A4, B4, C5, D5
function colorToRoot(colorHex) {
  let sum = 0; for (let i=0;i<colorHex.length;i++) sum += colorHex.charCodeAt(i);
  return ROOTS[sum % ROOTS.length];
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const countdownEl = document.getElementById("countdown");
const replayBtn = document.getElementById("replayBtn");
const splash = document.getElementById("splash");
const hint = document.getElementById("hint");

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
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
  initAudio(); // unlock audio on first touch
  e.preventDefault();
  for (const t of e.changedTouches) {
    touches.set(t.identifier, {
      x: t.clientX, y: t.clientY, born: performance.now(),
      color: playerColors[colorIndex++ % playerColors.length],
      shrink: 1
    });
  }
  if (!countdownTimer) startCountdown();
}, { passive:false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const obj = touches.get(t.identifier);
    if (obj) { obj.x = t.clientX; obj.y = t.clientY; }
  }
}, { passive:false });

function clearTouch(id) { touches.delete(id); }
canvas.addEventListener("touchend",   (e)=>{ e.preventDefault(); for (const t of e.changedTouches) clearTouch(t.identifier); }, {passive:false});
canvas.addEventListener("touchcancel",(e)=>{ e.preventDefault(); for (const t of e.changedTouches) clearTouch(t.identifier); }, {passive:false});

// Helpers
function drawBlob(x,y,r,color,glow){
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowBlur = 30; ctx.shadowColor = glow;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawGlowRing(x,y,r,glow,alpha=1){
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = 8; ctx.globalAlpha = alpha;
  ctx.shadowBlur = 25; ctx.shadowColor = glow;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}
function hexToRgb(hex){
  const m = hex.replace("#",""); const n = parseInt(m.length===3? m.split("").map(x=>x+x).join(""):m,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgba(hex,a){ const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lighten(hex, amt){
  const {r,g,b}=hexToRgb(hex);
  const mix=v=>Math.max(0,Math.min(255,Math.round(v+(255-v)*amt)));
  const toH=v=>v.toString(16).padStart(2,"0");
  return `#${toH(mix(r))}${toH(mix(g))}${toH(mix(b))}`;
}

// === PREMIUM WIN EFFECTS ===
// Confetti
function launchConfetti(x,y,base){
  confetti.length=0;
  const palette=[base,lighten(base,0.35),lighten(base,0.65)];
  for(let i=0;i<120;i++){
    confetti.push({
      x,y, vx:(Math.random()*2-1)*6.5, vy:Math.random()*-9-3,
      size:Math.random()*7+3, color:palette[Math.floor(Math.random()*palette.length)],
      life:120+Math.random()*50, rot:Math.random()*Math.PI*2, vr:(Math.random()*2-1)*0.22
    });
  }
}
function updateConfetti(){
  for(const c of confetti){ c.vy+=0.18; c.x+=c.vx; c.y+=c.vy; c.rot+=c.vr; c.life-=1; }
  confetti = confetti.filter(c=>c.life>0 && c.y<window.innerHeight+80);
}
function drawConfetti(){
  for(const c of confetti){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.fillStyle=c.color;
    ctx.fillRect(-c.size/2,-c.size/2,c.size,c.size); ctx.restore();
  }
}

// Ripples
function addRipple(x,y,color){ ripples.push({x,y,r:20,alpha:1,color}); }
function triggerRipples(x,y,color){ ripples.length=0; for(let i=0;i<8;i++) setTimeout(()=>addRipple(x,y,color), i*80); }
function updateRipples(){
  for(const r of ripples){ r.r+=7; r.alpha-=0.02; }
  ripples = ripples.filter(r=>r.alpha>0);
}
function drawRipples(){ for(const r of ripples) drawGlowRing(r.x,r.y,r.r,r.color,Math.max(0,r.alpha)); }

// Rays
function launchRays(x,y,color){
  rays.length=0; const count=28;
  for(let i=0;i<count;i++){ const ang=(i/count)*Math.PI*2;
    rays.push({x,y,ang,len:0,max:Math.hypot(window.innerWidth,window.innerHeight),color,alpha:1});
  }
}
function updateRays(){ for(const r of rays){ r.len+=36; r.alpha-=0.012; } rays = rays.filter(r=>r.alpha>0); }
function drawRays(){
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for(const r of rays){
    ctx.strokeStyle=rgba(r.color,Math.max(0,r.alpha)); ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(r.x,r.y);
    ctx.lineTo(r.x+Math.cos(r.ang)*r.len, r.y+Math.sin(r.ang)*r.len); ctx.stroke();
  }
  ctx.restore();
}

// Fireworks
function launchFireworks(x,y,base){
  sparks.length=0; const palette=[base,lighten(base,0.3),lighten(base,0.6)];
  for(let i=0;i<160;i++){ const ang=Math.random()*Math.PI*2; const spd=4+Math.random()*5;
    sparks.push({ x,y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, color:palette[Math.floor(Math.random()*palette.length)], life:95+Math.random()*30 });
  }
}
function updateFireworks(){ for(const s of sparks){ s.vy+=0.08; s.x+=s.vx; s.y+=s.vy; s.life-=1; } sparks = sparks.filter(s=>s.life>0); }
function drawFireworks(){
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for(const s of sparks){ ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(s.x,s.y,2.2,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}

// Spiral
function launchSpiral(x,y,color){
  spiral.length=0; const arms=3, points=160;
  for(let a=0;a<arms;a++){ for(let i=0;i<points;i++){ const t=i*0.12 + a*(Math.PI*2/arms); const r=i*3;
    spiral.push({ x:x+Math.cos(t)*r, y:y+Math.sin(t)*r, color, alpha:Math.max(0.15,1-i/points) });
  } }
}
function updateSpiral(){ for(const p of spiral) p.alpha-=0.01; spiral = spiral.filter(p=>p.alpha>0); }
function drawSpiral(){
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for(const p of spiral){ ctx.fillStyle=rgba(p.color,Math.max(0,p.alpha)); ctx.fillRect(p.x,p.y,3,3); }
  ctx.restore();
}

// Sparkles (twinkling stars)
function launchSparkles(x,y,color){
  twinkles.length=0; const count=80;
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2, dist = 40 + Math.random()*160;
    twinkles.push({ x: x + Math.cos(ang)*dist, y: y + Math.sin(ang)*dist, size: 2 + Math.random()*3, phase: Math.random()*Math.PI*2, color });
  }
}
function updateSparkles(){ for(const s of twinkles) s.phase += 0.15; }
function drawSparkles(){
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for(const s of twinkles){
    const a = (Math.sin(s.phase)+1)/2; // 0..1
    ctx.fillStyle = rgba(s.color, 0.35 + 0.65*a);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size*(0.8+0.6*a), 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// Bokeh (soft floating orbs)
function launchBokeh(color){
  orbs.length=0; const count=30;
  for(let i=0;i<count;i++){
    orbs.push({
      x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      r: 20 + Math.random()*40, vx: (Math.random()*2-1)*0.6, vy: (Math.random()*2-1)*0.6,
      color, alpha: 0.18 + Math.random()*0.25
    });
  }
}
function updateBokeh(){ for(const o of orbs){ o.x+=o.vx; o.y+=o.vy;
  if(o.x<-50||o.x>window.innerWidth+50) o.vx*=-1;
  if(o.y<-50||o.y>window.innerHeight+50) o.vy*=-1;
} }
function drawBokeh(){
  ctx.save();
  for(const o of orbs){
    ctx.fillStyle = rgba(o.color, o.alpha);
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// Countdown & Win
function startCountdown(){
  // Reset FX + takeover + shrink
  confetti.length = sparks.length = rays.length = spiral.length = 0;
  twinkles.length = orbs.length = 0; ripples.length = 0;
  winnerId = null; winnerGrowT = 0; winnerPos = {x:0,y:0}; winnerStartTime = 0;

  for (const [, t] of touches) t.shrink = 1;

  countdown = COUNTDOWN_START;
  countdownEl.style.display = "block";
  countdownEl.textContent = String(countdown);
  hint.style.display = "none";

  countdownTimer = setInterval(()=>{
    countdown--;
    if (countdown > 0) {
      countdownEl.textContent = String(countdown);
    } else {
      clearInterval(countdownTimer); countdownTimer = null;
      countdownEl.textContent = "";
      pickWinner();
    }
  }, 1000);
}

function pickWinner(){
  const ids = Array.from(touches.keys());
  if (ids.length === 0) {
    countdownEl.style.display = "block";
    countdownEl.textContent = "No Touch!";
    replayBtn.style.display = "block";
    return;
  }
  const id = ids[Math.floor(Math.random() * ids.length)];
  winnerId = id;

  // Shrink away non-winners
  for (const [tid, t] of touches) if (String(tid)!==String(winnerId)) t.shrink = 1;

  const w = touches.get(winnerId);
  if (w) {
    victoryColor = w.color;
    winnerPos = { x: w.x, y: w.y };
    winEffectType = WIN_EFFECTS[Math.floor(Math.random()*WIN_EFFECTS.length)];

    if (winEffectType==="confetti")      launchConfetti(w.x,w.y,w.color);
    else if (winEffectType==="ripples")  triggerRipples(w.x,w.y,w.color);
    else if (winEffectType==="rays")     launchRays(w.x,w.y,w.color);
    else if (winEffectType==="fireworks")launchFireworks(w.x,w.y,w.color);
    else if (winEffectType==="spiral")   launchSpiral(w.x,w.y,w.color);
    else if (winEffectType==="sparkles") launchSparkles(w.x,w.y,w.color);
    else if (winEffectType==="bokeh")    launchBokeh(w.color);

    // Start the wipe timing
    winnerGrowT = 0;
    winnerStartTime = performance.now();

    // --- Winner sound (musical, no noise) ---
    if (audioCtx) {
      const root = colorToRoot(w.color);
      if (winEffectType === "confetti" || winEffectType === "rays") {
        // Bright arcade-y pentatonic up-run with echo
        arpeggio({ rootFreq: root, semis:[0,2,4,7,12], tempo: 14, waveshape:"square", baseGain:0.08 });
      } else if (winEffectType === "fireworks" || winEffectType === "spiral") {
        // Triumphant triad with echo tails
        triad({ rootFreq: root, type:"triangle", gain:0.09, dur:0.36 });
      } else if (winEffectType === "ripples" || winEffectType === "bokeh") {
        // Soft bell-like arpeggio with gentle echo
        arpeggio({ rootFreq: root/2, semis:[0,3,7,10,12], tempo: 11, waveshape:"sine", baseGain:0.07 });
      } else {
        // Sparkly twinkle: quick high arpeggio
        arpeggio({ rootFreq: root*2, semis:[0,2,5,9,12], tempo: 16, waveshape:"sine", baseGain:0.07 });
      }
    }
  }

  replayBtn.style.display = "block";
}

function startRound(){
  replayBtn.style.display = "none";
  countdownEl.style.display = "none";
  hint.style.display = "block";
  pickRandomTheme();
  winnerId = null; winnerGrowT = 0; twinkles.length=orbs.length=0;
  if (touches.size > 0) startCountdown();
}

replayBtn.addEventListener("click", startRound);

// Splash → auto-start
window.addEventListener("load", () => {
  setTimeout(() => { splash.style.display = "none"; startRound(); }, 1000);
});

// Render loop
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const now = performance.now();
  const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.15; // smaller starting blobs

  // Draw blobs
  for (const [id, t] of touches.entries()) {
    const isWinner = (winnerId !== null && String(id)===String(winnerId));

    // Shrink losers after win; winner shrinks via wipe progress
    if (winnerId !== null && !isWinner) {
      t.shrink = Math.max(0, (t.shrink ?? 1) - 0.06);
    } else {
      t.shrink = Math.min(1, (t.shrink ?? 1) + 0.1);
    }

    // Radius: winners stop breathing and shrink based on wipe progress
    let r;
    if (isWinner) {
      const elapsed = winnerStartTime ? (now - winnerStartTime) / 1000 : 0;
      const tprog = Math.min(1, elapsed / winnerGrowDuration);
      const winnerScale = Math.max(0.18, 1 - tprog); // shrink as wipe progresses
      r = baseRadius * 0.95 * winnerScale * (t.shrink ?? 1);
    } else {
      const pulse = (Math.sin((now - t.born)/200)+1)*0.5;
      r = baseRadius * (0.9 + 0.08 * pulse) * (t.shrink ?? 1);
    }

    if (r > 0.5) {
      drawBlob(t.x, t.y, r, t.color, t.color);
      if (isWinner) drawGlowRing(t.x, t.y, r + 12, t.color, 0.9);
    }
  }

  // Winner takeover: easing-based radial fill from winner position
  if (winnerId !== null) {
    const elapsed = winnerStartTime ? (now - winnerStartTime) / 1000 : 0;
    const t = Math.min(1, elapsed / winnerGrowDuration); // 0..1
    const easeInCubic = (x) => x * x * x; // starts slow, accelerates

    const targetR = Math.hypot(window.innerWidth, window.innerHeight);
    const radius = targetR * easeInCubic(t);

    ctx.save();
    ctx.fillStyle = rgba(victoryColor, 0.88);
    ctx.beginPath();
    ctx.arc(winnerPos.x, winnerPos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (t >= 1) {
      ctx.fillStyle = rgba(victoryColor, 0.88);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Premium FX over the fill
  if (winnerId !== null) {
    if (winEffectType==="confetti")      { updateConfetti();   drawConfetti(); }
    else if (winEffectType==="ripples")  { updateRipples();    drawRipples();  }
    else if (winEffectType==="rays")     { updateRays();       drawRays();     }
    else if (winEffectType==="fireworks"){ updateFireworks();  drawFireworks();}
    else if (winEffectType==="spiral")   { updateSpiral();     drawSpiral();   }
    else if (winEffectType==="sparkles") { updateSparkles();   drawSparkles(); }
    else if (winEffectType==="bokeh")    { updateBokeh();      drawBokeh();    }
  }

  requestAnimationFrame(render);
}
render();
