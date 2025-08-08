// ======= CONFIG =======
const COUNTDOWN_START = 3; // seconds

// ======= THEME DEFINITIONS =======
// Each theme has: name, colors, background, effect type, sound (Base64)
const themes = [
  {
    name: "Neon Nights",
    blobColor: "#0ff",
    glowColor: "#ff00aa",
    background: "black",
    effect: "confetti",
    sound: "data:audio/mp3;base64,..." // arcade coin or retro sound Base64 here
  },
  {
    name: "Arcade Gold",
    blobColor: "#FFD700",
    glowColor: "#8B00FF",
    background: "linear-gradient(45deg,#2e003e,#36013f)",
    effect: "confetti",
    sound: "data:audio/mp3;base64,..." // fanfare Base64 here
  },
  {
    name: "Ocean Wave",
    blobColor: "#00ced1",
    glowColor: "#1e90ff",
    background: "linear-gradient(45deg,#004e92,#000428)",
    effect: "ripple",
    sound: "data:audio/mp3;base64,..." // water splash Base64 here
  },
  {
    name: "Festival Pop",
    blobColor: "#ff1493",
    glowColor: "#ffff00",
    background: "linear-gradient(45deg,#ff0080,#ff8c00)",
    effect: "confetti",
    sound: "data:audio/mp3;base64,..." // crowd cheer Base64 here
  },
  {
    name: "Minimal Luxe",
    blobColor: "#ffffff",
    glowColor: "#FFD700",
    background: "white",
    effect: "ripple",
    sound: "data:audio/mp3;base64,..." // elegant ta-da Base64 here
  },
  {
    name: "Peruvian",
    blobColor: "#FFD700",
    glowColor: "#FF0000",
    background: "linear-gradient(45deg,#FF0000,#FFFFFF,#FF0000)",
    effect: "confetti",
    sound: "data:audio/mp3;base64,..." // charango+cajon Base64 here
  }
];

// ======= VARIABLES =======
let currentTheme;
let touches = {};
let countdown = COUNTDOWN_START;
let countdownInterval;
let winnerId = null;

// ======= ELEMENTS =======
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const countdownEl = document.getElementById('countdown');
const replayBtn = document.getElementById('replayBtn');
const splash = document.getElementById('splash');

// ======= CANVAS SETUP =======
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ======= THEME HANDLING =======
function pickRandomTheme() {
  currentTheme = themes[Math.floor(Math.random() * themes.length)];
  document.body.style.background = currentTheme.background;
}

// ======= TOUCH EVENTS =======
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    touches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    if (touches[touch.identifier]) {
      touches[touch.identifier].x = touch.clientX;
      touches[touch.identifier].y = touch.clientY;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    delete touches[touch.identifier];
  }
}, { passive: false });

// ======= DRAW LOOP =======
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let id in touches) {
    let t = touches[id];
    ctx.beginPath();
    ctx.arc(t.x, t.y, 50, 0, Math.PI * 2);
    ctx.fillStyle = currentTheme.blobColor;
    ctx.shadowBlur = 20;
    ctx.shadowColor = currentTheme.glowColor;
    ctx.fill();
  }
  requestAnimationFrame(draw);
}

// ======= COUNTDOWN & WINNER =======
function startCountdown() {
  countdown = COUNTDOWN_START;
  countdownEl.textContent = countdown;
  countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownEl.textContent = countdown;
    } else {
      clearInterval(countdownInterval);
      pickWinner();
    }
  }, 1000);
}

function pickWinner() {
  const ids = Object.keys(touches);
  if (ids.length === 0) {
    countdownEl.textContent = "No Touch!";
    replayBtn.style.display = 'block';
    return;
  }
  winnerId = ids[Math.floor(Math.random() * ids.length)];
  playThemeSound();
  countdownEl.textContent = "Winner!";
  replayBtn.style.display = 'block';
}

function playThemeSound() {
  const audio = new Audio(currentTheme.sound);
  audio.play();
}

// ======= GAME START =======
function startGame() {
  replayBtn.style.display = 'none';
  pickRandomTheme();
  startCountdown();
}

replayBtn.addEventListener('click', startGame);

// ======= SPLASH BEHAVIOR =======
window.addEventListener('load', () => {
  setTimeout(() => {
    splash.style.display = 'none';
    startGame();
  }, 1000);
});

// ======= START DRAW LOOP =======
draw();
