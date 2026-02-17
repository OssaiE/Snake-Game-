(function () {
  "use strict";

  var BASE_TICK_MS = 170;
  var MIN_TICK_MS = 60;
  var gameRoot = document.getElementById("game");
  var scoreEl = document.getElementById("score");
  var highScoreEl = document.getElementById("high-score");
  var statusEl = document.getElementById("status");
  var startMenuModalEl = document.getElementById("start-menu-modal");
  var startGameBtn = document.getElementById("start-game-btn");
  var countdownModalEl = document.getElementById("countdown-modal");
  var countdownLabelEl = document.getElementById("countdown-label");
  var countdownValueEl = document.getElementById("countdown-value");
  var highScoreModalEl = document.getElementById("high-score-modal");
  var highScoreModalTextEl = document.getElementById("high-score-modal-text");
  var highScoreNameInput = document.getElementById("high-score-name");
  var avatarOptionsEl = document.getElementById("avatar-options");
  var saveHighScoreBtn = document.getElementById("save-high-score-btn");
  var musicBtn = document.getElementById("music-btn");
  var bgMusicEl = document.getElementById("bg-music");
  var leaderboardListEl = document.getElementById("leaderboard-list");
  var restartBtn = document.getElementById("restart-btn");
  var pauseBtn = document.getElementById("pause-btn");
  var controls = document.querySelectorAll("[data-direction]");

  var state = SnakeLogic.createInitialState({ gridSize: 16 });
  var tickId = null;
  var countdownId = null;
  var currentTickMs = BASE_TICK_MS;
  var audioCtx = null;
  var hasPlayedLoseSound = false;
  var hasRecordedScore = false;
  var inMenu = true;
  var countdownSeconds = 0;
  var highScore = 0;
  var pendingHighScore = null;
  var hasActivatedMusic = true;
  var autoplayRetryId = null;
  var musicEnabled = true;
  var selectedAvatar = "🐍";
  var MENU_MUSIC_VOLUME = 0.12;
  var GAME_MUSIC_VOLUME = 0.07;
  var POP_SFX_GAIN = 0.32;
  var LOSE_SFX_GAIN = 0.28;
  var COUNTDOWN_SFX_GAIN = 0.26;
  var AVATARS = ["🐍", "🐸", "🐯", "🐼", "🦊", "🐙"];
  var PLAYER_PROFILE_KEY = "snake_player_profile_v1";
  var LEADERBOARD_KEY = "snake_leaderboard_v1";
  var MUSIC_ENABLED_KEY = "snake_music_enabled_v1";
  var leaderboard = loadLeaderboard();
  var playerProfile = loadPlayerProfile();
  musicEnabled = loadMusicEnabled();
  highScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
  selectedAvatar = playerProfile.avatar;

  function buildGrid() {
    gameRoot.style.gridTemplateColumns = "repeat(" + state.gridSize + ", 1fr)";
    gameRoot.style.gridTemplateRows = "repeat(" + state.gridSize + ", 1fr)";
    gameRoot.innerHTML = "";

    for (var y = 0; y < state.gridSize; y += 1) {
      for (var x = 0; x < state.gridSize; x += 1) {
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        gameRoot.appendChild(cell);
      }
    }
  }

  function clearCellClasses() {
    var allCells = gameRoot.querySelectorAll(".cell");
    allCells.forEach(function (cell) {
      cell.classList.remove(
        "snake",
        "head",
        "food",
        "food-small",
        "food-medium",
        "food-large",
        "obstacle"
      );
      cell.style.removeProperty("--food-color");
      cell.style.removeProperty("--food-scale");
    });
  }

  function markCell(x, y, className) {
    var selector = '.cell[data-x="' + x + '"][data-y="' + y + '"]';
    var cell = gameRoot.querySelector(selector);
    if (cell) cell.classList.add(className);
  }

  function render() {
    clearCellClasses();

    state.snake.forEach(function (segment, index) {
      markCell(segment.x, segment.y, "snake");
      if (index === 0) markCell(segment.x, segment.y, "head");
    });

    if (state.food) {
      markCell(state.food.x, state.food.y, "food");
      markCell(state.food.x, state.food.y, "food-" + state.food.type);
      var foodCell = gameRoot.querySelector(
        '.cell[data-x="' + state.food.x + '"][data-y="' + state.food.y + '"]'
      );
      if (foodCell) {
        foodCell.style.setProperty("--food-color", state.food.color);
        foodCell.style.setProperty("--food-scale", String(state.food.scale));
      }
    }
    (state.obstacles || []).forEach(function (obstacle) {
      markCell(obstacle.x, obstacle.y, "obstacle");
    });

    scoreEl.textContent = String(state.score);
    if (highScoreEl) highScoreEl.textContent = String(Math.max(highScore, state.score));
    if (inMenu) {
      statusEl.textContent = "Menu - press Start Game";
    } else if (isHighScoreModalOpen()) {
      statusEl.textContent = "New high score. Save your name and avatar.";
    } else if (countdownSeconds > 0) {
      statusEl.textContent = "Get ready";
    } else if (state.gameOver && state.food === null) {
      statusEl.textContent = "You win. Restart to play again.";
    } else if (state.gameOver) {
      statusEl.textContent = "Game over. Press Restart.";
    } else if (state.paused) {
      statusEl.textContent = "Paused";
    } else {
      statusEl.textContent = "Running";
    }
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (musicBtn) musicBtn.textContent = "Music: " + (musicEnabled ? "On" : "Off");
    renderStartMenuModal();
    renderCountdownModal();
    syncBackgroundMusic();
  }

  function tick() {
    var previousScore = state.score;
    var wasGameOver = state.gameOver;
    state = SnakeLogic.advance(state);
    refreshSpeedFromScore();
    if (state.score > previousScore) playPop();
    if (!wasGameOver && state.gameOver && state.food !== null) playLoseJingle();
    if (!wasGameOver && state.gameOver) handleGameOver();
    render();
    if (state.gameOver && tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function startLoop() {
    if (countdownId) {
      clearInterval(countdownId);
      countdownId = null;
    }
    if (tickId) clearInterval(tickId);
    tickId = setInterval(tick, currentTickMs);
  }

  function startCountdown() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
    if (countdownId) clearInterval(countdownId);
    countdownSeconds = 3;
    playCountdownCue(countdownSeconds);
    render();
    countdownId = setInterval(function () {
      countdownSeconds -= 1;
      if (countdownSeconds <= 0) {
        countdownSeconds = 0;
        clearInterval(countdownId);
        countdownId = null;
        render();
        startLoop();
        return;
      }
      playCountdownCue(countdownSeconds);
      render();
    }, 1000);
  }

  function restart() {
    closeHighScoreModal();
    inMenu = false;
    state = SnakeLogic.createInitialState({ gridSize: 16 });
    currentTickMs = getTickMsForScore(state.score);
    hasPlayedLoseSound = false;
    hasRecordedScore = false;
    buildGrid();
    render();
    startCountdown();
  }

  function handleDirection(nextDirection) {
    if (isInputLocked() || state.gameOver) return;
    state = SnakeLogic.withDirection(state, nextDirection);
    render();
  }

  function startFromMenu() {
    inMenu = false;
    restart();
  }

  function isInputLocked() {
    return inMenu || countdownSeconds > 0 || isHighScoreModalOpen();
  }

  function getTickMsForScore(score) {
    var stepDown = Math.floor(score / 2) * 4;
    return Math.max(MIN_TICK_MS, BASE_TICK_MS - stepDown);
  }

  function refreshSpeedFromScore() {
    var nextTickMs = getTickMsForScore(state.score);
    if (nextTickMs === currentTickMs) return;
    currentTickMs = nextTickMs;
    if (tickId) {
      clearInterval(tickId);
      tickId = setInterval(tick, currentTickMs);
    }
  }

  function renderStartMenuModal() {
    if (!startMenuModalEl) return;
    if (inMenu) {
      startMenuModalEl.classList.remove("hidden");
    } else {
      startMenuModalEl.classList.add("hidden");
    }
  }

  function loadMusicEnabled() {
    try {
      var stored = window.localStorage.getItem(MUSIC_ENABLED_KEY);
      if (stored === null) return true;
      return stored === "1";
    } catch (_err) {
      return true;
    }
  }

  function saveMusicEnabled(value) {
    try {
      window.localStorage.setItem(MUSIC_ENABLED_KEY, value ? "1" : "0");
    } catch (_err) {
      // Ignore storage failures.
    }
  }

  function loadPlayerProfile() {
    try {
      var stored = window.localStorage.getItem(PLAYER_PROFILE_KEY);
      if (!stored) return { name: "Player", avatar: AVATARS[0] };
      var parsed = JSON.parse(stored);
      var name = normalizePlayerName(parsed && parsed.name);
      var avatar = AVATARS.indexOf(parsed && parsed.avatar) >= 0 ? parsed.avatar : AVATARS[0];
      return { name: name, avatar: avatar };
    } catch (_err) {
      return { name: "Player", avatar: AVATARS[0] };
    }
  }

  function savePlayerProfile(profile) {
    try {
      window.localStorage.setItem(
        PLAYER_PROFILE_KEY,
        JSON.stringify({
          name: normalizePlayerName(profile.name),
          avatar: AVATARS.indexOf(profile.avatar) >= 0 ? profile.avatar : AVATARS[0],
        })
      );
    } catch (_err) {
      // Ignore storage failures.
    }
  }

  function loadLeaderboard() {
    try {
      var stored = window.localStorage.getItem(LEADERBOARD_KEY);
      if (!stored) return [];
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (entry) {
          return entry && typeof entry.name === "string" && Number.isFinite(entry.score);
        })
        .map(function (entry) {
          return {
            name: normalizePlayerName(entry.name),
            score: entry.score,
            avatar: AVATARS.indexOf(entry.avatar) >= 0 ? entry.avatar : AVATARS[0],
            date: entry.date || new Date(0).toISOString(),
          };
        })
        .slice(0, 10);
    } catch (_err) {
      return [];
    }
  }

  function saveLeaderboard() {
    try {
      window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard.slice(0, 10)));
    } catch (_err) {
      // Ignore storage failures.
    }
  }

  function renderLeaderboard() {
    if (!leaderboardListEl) return;
    leaderboardListEl.innerHTML = "";
    if (leaderboard.length === 0) {
      var empty = document.createElement("li");
      empty.textContent = "No scores yet";
      leaderboardListEl.appendChild(empty);
      return;
    }
    leaderboard.slice(0, 10).forEach(function (entry) {
      var item = document.createElement("li");
      item.textContent = entry.avatar + " " + entry.name + " - " + entry.score;
      leaderboardListEl.appendChild(item);
    });
  }

  function normalizePlayerName(value) {
    var cleaned = (value || "").trim().slice(0, 16);
    return cleaned || "Player";
  }

  function upsertScore(name, score, avatar) {
    leaderboard.push({
      name: name,
      score: score,
      avatar: avatar,
      date: new Date().toISOString(),
    });
    leaderboard.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.date < b.date ? 1 : -1;
    });
    leaderboard = leaderboard.slice(0, 10);
    highScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
    saveLeaderboard();
    renderLeaderboard();
  }

  function handleGameOver() {
    if (hasRecordedScore) return;
    hasRecordedScore = true;
    if (state.score <= highScore) return;
    openHighScoreModal(state.score);
  }

  function renderCountdownModal() {
    if (!countdownModalEl || !countdownValueEl || !countdownLabelEl) return;
    if (countdownSeconds > 0) {
      countdownModalEl.classList.remove("hidden");
      countdownValueEl.textContent = String(countdownSeconds);
      if (countdownSeconds === 3) countdownLabelEl.textContent = "Ready";
      if (countdownSeconds === 2) countdownLabelEl.textContent = "Set";
      if (countdownSeconds === 1) countdownLabelEl.textContent = "Go";
    } else {
      countdownModalEl.classList.add("hidden");
    }
  }

  function isHighScoreModalOpen() {
    return !!highScoreModalEl && !highScoreModalEl.classList.contains("hidden");
  }

  function setSelectedAvatar(avatar) {
    selectedAvatar = AVATARS.indexOf(avatar) >= 0 ? avatar : AVATARS[0];
    if (!avatarOptionsEl) return;
    avatarOptionsEl.querySelectorAll("button").forEach(function (button) {
      if (button.dataset.avatar === selectedAvatar) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }
    });
  }

  function openHighScoreModal(score) {
    pendingHighScore = score;
    if (!highScoreModalEl) {
      upsertScore(playerProfile.name, score, playerProfile.avatar);
      if (highScoreEl) highScoreEl.textContent = String(highScore);
      pendingHighScore = null;
      return;
    }
    if (highScoreModalTextEl) {
      highScoreModalTextEl.textContent = "Score " + score + " beats the current high score.";
    }
    if (highScoreNameInput) highScoreNameInput.value = playerProfile.name;
    setSelectedAvatar(playerProfile.avatar);
    highScoreModalEl.classList.remove("hidden");
    if (highScoreNameInput) highScoreNameInput.focus();
  }

  function closeHighScoreModal() {
    pendingHighScore = null;
    if (!highScoreModalEl) return;
    highScoreModalEl.classList.add("hidden");
  }

  function savePendingHighScore() {
    if (pendingHighScore === null) return;
    var name = normalizePlayerName(highScoreNameInput ? highScoreNameInput.value : "");
    var avatar = selectedAvatar;
    playerProfile = { name: name, avatar: avatar };
    savePlayerProfile(playerProfile);
    upsertScore(name, pendingHighScore, avatar);
    if (highScoreEl) highScoreEl.textContent = String(highScore);
    closeHighScoreModal();
  }

  function markUserInteraction() {
    hasActivatedMusic = true;
    syncBackgroundMusic();
  }

  function shouldPlayBackgroundMusic() {
    return !!bgMusicEl && musicEnabled && hasActivatedMusic;
  }

  function targetMusicVolume() {
    return inMenu ? MENU_MUSIC_VOLUME : GAME_MUSIC_VOLUME;
  }

  function syncBackgroundMusic() {
    if (!bgMusicEl) return;
    bgMusicEl.volume = targetMusicVolume();
    if (shouldPlayBackgroundMusic()) {
      var playPromise = bgMusicEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          startAutoplayRetry();
        });
      }
      return;
    }
    if (!bgMusicEl.paused) bgMusicEl.pause();
  }

  function stopAutoplayRetry() {
    if (autoplayRetryId) {
      clearInterval(autoplayRetryId);
      autoplayRetryId = null;
    }
  }

  function startAutoplayRetry() {
    if (!bgMusicEl || autoplayRetryId) return;
    autoplayRetryId = setInterval(function () {
      if (!shouldPlayBackgroundMusic()) {
        stopAutoplayRetry();
        return;
      }
      var playPromise = bgMusicEl.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(function () {
          stopAutoplayRetry();
        }).catch(function () {});
      }
    }, 1000);
  }

  function setupGlobalAudioUnlock() {
    function unlock() {
      markUserInteraction();
      stopAutoplayRetry();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    }
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock);
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    saveMusicEnabled(musicEnabled);
    render();
  }

  function setupProfileModal() {
    if (!avatarOptionsEl) return;
    avatarOptionsEl.innerHTML = "";
    AVATARS.forEach(function (avatar) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "avatar-btn";
      button.dataset.avatar = avatar;
      button.textContent = avatar;
      button.addEventListener("click", function () {
        setSelectedAvatar(avatar);
      });
      avatarOptionsEl.appendChild(button);
    });
    setSelectedAvatar(playerProfile.avatar);

    if (saveHighScoreBtn) {
      saveHighScoreBtn.addEventListener("click", function () {
        markUserInteraction();
        savePendingHighScore();
      });
    }
    if (highScoreNameInput) {
      highScoreNameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          markUserInteraction();
          savePendingHighScore();
        }
      });
    }
  }

  function setupMusicControls() {
    if (!musicBtn) return;
    musicBtn.addEventListener("click", function () {
      markUserInteraction();
      toggleMusic();
    });
  }

  function primeAudio() {
    if (audioCtx) return;
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    } catch (_err) {
      audioCtx = null;
    }
  }

  function playPop() {
    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(POP_SFX_GAIN, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function playLoseJingle() {
    if (hasPlayedLoseSound) return;
    hasPlayedLoseSound = true;
    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var now = audioCtx.currentTime;
    var notes = [523.25, 392.0, 311.13, 261.63];
    for (var i = 0; i < notes.length; i += 1) {
      var start = now + i * 0.11;
      var end = start + 0.1;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(notes[i], start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(LOSE_SFX_GAIN, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(end);
    }
  }

  function playCountdownCue(count) {
    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var frequency = 440;
    if (count === 3) frequency = 523.25;
    if (count === 2) frequency = 659.25;
    if (count === 1) frequency = 783.99;

    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(COUNTDOWN_SFX_GAIN, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    if ("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function") {
      var word = count === 3 ? "Ready" : count === 2 ? "Set" : "Go";
      var utterance = new window.SpeechSynthesisUtterance(word);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  function handleKeydown(event) {
    markUserInteraction();
    primeAudio();
    var key = event.key.toLowerCase();
    if (inMenu && key === "enter") {
      event.preventDefault();
      startFromMenu();
      return;
    }
    if (isInputLocked() && key !== "r") return;
    if (key === "arrowup" || key === "w") handleDirection("up");
    if (key === "arrowdown" || key === "s") handleDirection("down");
    if (key === "arrowleft" || key === "a") handleDirection("left");
    if (key === "arrowright" || key === "d") handleDirection("right");
    if (key === "p" || key === " ") {
      event.preventDefault();
      if (isInputLocked()) return;
      state = SnakeLogic.togglePause(state);
      render();
    }
    if (key === "r") restart();
  }

  controls.forEach(function (button) {
    button.addEventListener("click", function () {
      markUserInteraction();
      primeAudio();
      if (isInputLocked()) return;
      handleDirection(button.dataset.direction);
    });
  });

  pauseBtn.addEventListener("click", function () {
    markUserInteraction();
    primeAudio();
    if (isInputLocked()) return;
    state = SnakeLogic.togglePause(state);
    render();
  });

  if (startGameBtn) {
    startGameBtn.addEventListener("click", function () {
      markUserInteraction();
      startFromMenu();
    });
  }

  restartBtn.addEventListener("click", function () {
    markUserInteraction();
    restart();
  });
  document.addEventListener("keydown", handleKeydown);

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      gridSize: state.gridSize,
      snake: state.snake,
      direction: state.direction,
      food: state.food,
      obstacles: state.obstacles || [],
      score: state.score,
      highScore: Math.max(highScore, state.score),
      leaderboardTop: leaderboard.slice(0, 5),
      playerName: playerProfile.name,
      playerAvatar: playerProfile.avatar,
      inMenu: inMenu,
      musicEnabled: musicEnabled,
      musicVolume: targetMusicVolume(),
      tickMs: currentTickMs,
      countdownSeconds: countdownSeconds,
      awaitingHighScoreSave: pendingHighScore !== null,
      gameOver: state.gameOver,
      paused: state.paused,
    });
  };

  window.advanceTime = function (ms) {
    if (isInputLocked()) return;
    var steps = Math.max(1, Math.round(ms / currentTickMs));
    for (var i = 0; i < steps; i += 1) {
      var previousScore = state.score;
      var wasGameOver = state.gameOver;
      state = SnakeLogic.advance(state);
      if (state.score > previousScore) playPop();
      if (!wasGameOver && state.gameOver && state.food !== null) playLoseJingle();
      if (!wasGameOver && state.gameOver) handleGameOver();
      if (state.gameOver) break;
    }
    render();
  };

  setupProfileModal();
  setupMusicControls();
  setupGlobalAudioUnlock();
  renderLeaderboard();
  buildGrid();
  render();
  syncBackgroundMusic();
  startAutoplayRetry();
})();
