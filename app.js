<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Tío Pepe’s: Game Night!</title>
  <link rel="preload" href="./images/splash.png" as="image" />
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>

  <!-- Splash (full-screen image) -->
  <div id="splash">
    <img src="images/splash.png" alt="Tío Pepe’s Game Night splash" />
  </div>

  <!-- Picker UI -->
  <canvas id="gameCanvas"></canvas>
  <div id="countdown"></div>
  <button id="replayBtn" class="hidden">Replay</button>
  <div id="hint">Place your fingers and hold…</div>

  <script src="./app.js" defer></script>
  <script>
    // Optional: service worker (safe to keep if you already had one)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  </script>
</body>
</html>
