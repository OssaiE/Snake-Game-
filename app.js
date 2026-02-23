(function () {
  "use strict";

  var BASE_TICK_MS = 220;
  var MIN_TICK_MS = 60;
  var GRID_SIZE = 22;
  var gameRoot = document.getElementById("game");
  var scoreEl = document.getElementById("score");
  var highScoreEl = document.getElementById("high-score");
  var gameOverOverlayEl = document.getElementById("game-over-overlay");
  var gameOverTitleEl = document.getElementById("game-over-title");
  var gameOverTextEl = document.getElementById("game-over-text");
  var gameOverRestartBtn = document.getElementById("game-over-restart-btn");
  var pauseOverlayEl = document.getElementById("pause-overlay");
  var startMenuModalEl = document.getElementById("start-menu-modal");
  var startGameBtn = document.getElementById("start-game-btn");
  var countdownModalEl = document.getElementById("countdown-modal");
  var countdownLabelEl = document.getElementById("countdown-label");
  var countdownValueEl = document.getElementById("countdown-value");
  var highScoreModalEl = document.getElementById("high-score-modal");
  var highScoreModalTitleEl = document.getElementById("high-score-modal-title");
  var highScoreModalTextEl = document.getElementById("high-score-modal-text");
  var highScoreNameInput = document.getElementById("high-score-name");
  var confettiLayerEl = document.getElementById("confetti-layer");
  var avatarOptionsEl = document.getElementById("avatar-options");
  var cancelHighScoreBtn = document.getElementById("cancel-high-score-btn");
  var saveHighScoreBtn = document.getElementById("save-high-score-btn");
  var musicBtn = document.getElementById("music-btn");
  var musicIconEl = document.getElementById("music-icon");
  var musicLabelEl = document.getElementById("music-label");
  var bgMusicEl = document.getElementById("bg-music");
  var leaderboardListEl = document.getElementById("leaderboard-list");
  var restartBtn = document.getElementById("restart-btn");
  var pauseBtn = document.getElementById("pause-btn");
  var pauseIconEl = document.getElementById("pause-icon");
  var pauseLabelEl = document.getElementById("pause-label");
  var controls = document.querySelectorAll("[data-direction]");
  var collapseToggles = document.querySelectorAll(".collapse-toggle[data-collapse-target]");
  var mobileMediaQuery = window.matchMedia("(max-width: 900px)");

  var state = SnakeLogic.createInitialState({ gridSize: GRID_SIZE });
  var tickId = null;
  var countdownId = null;
  var currentTickMs = BASE_TICK_MS;
  var audioCtx = null;
  var hasPlayedLoseSound = false;
  var hasRecordedScore = false;
  var gameOverCommentary = "Try again.";
  var inMenu = true;
  var countdownSeconds = 0;
  var highScore = 0;
  var pendingHighScore = null;
  var pendingIsNewHighScore = false;
  var hasActivatedMusic = true;
  var autoplayRetryId = null;
  var musicEnabled = true;
  var selectedAvatar = "🐍";
  var displayedScore = 0;
  var displayedHighScore = 0;
  var scoreTarget = 0;
  var highScoreTarget = 0;
  var scoreRafId = null;
  var highScoreRafId = null;
  var countdownVoice = null;
  var countdownVoiceLoaded = false;
  var MENU_MUSIC_VOLUME = 0.12;
  var GAME_MUSIC_VOLUME = 0.07;
  var POP_SFX_GAIN = 0.32;
  var LOSE_SFX_GAIN = 0.28;
  var OBSTACLE_HIT_SFX_GAIN = 0.3;
  var COUNTDOWN_SFX_GAIN = 0.26;
  var SHARP_SFX_GAIN = 0.36;
  var CLICK_SFX_GAIN = 0.22;
  var obstaclePulseTimeoutId = null;
  var SCORE_MILESTONE_STEP = 12;
  var AVATARS = ["🐍", "🐸", "🐯", "🐼", "🦊", "🐙"];
  var LOSE_COMMENTARY = [
    "Ha ha, try again next time.",
    "That turn was rough. Reset and run it back.",
    "Close, but the wall won that duel.",
    "You got clipped. Next run will be cleaner.",
    "Not today. Try another route and dominate.",
    "Shake it off and go again.",
  ];
  var WIN_COMMENTARY = [
    "Perfect clear. That was sharp.",
    "Huge win. You controlled the whole board.",
    "Champion run. Try to beat your own score now.",
  ];
  var PLAYER_PROFILE_KEY = "snake_player_profile_v1";
  var LEADERBOARD_KEY = "snake_leaderboard_v4";
  var MAX_LEADERBOARD_ENTRIES = 500;
  var MUSIC_ENABLED_KEY = "snake_music_enabled_v1";
  var REMOTE_LEADERBOARD_URL =
    typeof window.SNAKE_SHARED_LEADERBOARD_URL === "string"
      ? window.SNAKE_SHARED_LEADERBOARD_URL.trim()
      : "";
  var remoteLeaderboardSyncBusy = false;
  var leaderboard = loadLeaderboard();
  var playerProfile = loadPlayerProfile();
  musicEnabled = loadMusicEnabled();
  highScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
  displayedHighScore = highScore;
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

    // Keep compatibility with older state snapshots that still use a single `food` field.
    var foods = Array.isArray(state.foods)
      ? state.foods
      : state.food
      ? [state.food]
      : [];
    foods.forEach(function (food) {
      markCell(food.x, food.y, "food");
      markCell(food.x, food.y, "food-" + food.type);
      var foodCell = gameRoot.querySelector(
        '.cell[data-x="' + food.x + '"][data-y="' + food.y + '"]'
      );
      if (foodCell) {
        foodCell.style.setProperty("--food-color", food.color);
        foodCell.style.setProperty("--food-scale", String(food.scale));
      }
    });
    (state.obstacles || []).forEach(function (obstacle) {
      markCell(obstacle.x, obstacle.y, "obstacle");
    });

    updateScoreDisplays(state.score, Math.max(highScore, state.score));
    if (pauseLabelEl) pauseLabelEl.textContent = state.paused ? "Play" : "Pause";
    if (pauseIconEl) {
      pauseIconEl.src = state.paused ? "./assets/icons/play.svg" : "./assets/icons/pause.svg";
    }
    if (musicLabelEl) musicLabelEl.textContent = musicEnabled ? "Music On" : "Music Off";
    if (musicIconEl) {
      musicIconEl.src = musicEnabled
        ? "./assets/icons/volume-max.svg"
        : "./assets/icons/volume-max-1.svg";
    }
    renderStartMenuModal();
    renderCountdownModal();
    renderPauseOverlay();
    renderGameOverOverlay();
    syncBackgroundMusic();
  }

  function addScorePop(el) {
    if (!el) return;
    el.classList.remove("score-pop");
    void el.offsetWidth;
    el.classList.add("score-pop");
  }

  function animateNumber(from, to, durationMs, onFrame, onDone) {
    if (from === to) {
      onFrame(to);
      onDone();
      return null;
    }
    var startTime = performance.now();
    var delta = to - from;
    function frame(now) {
      var progress = Math.min(1, (now - startTime) / durationMs);
      // Cubic ease-out keeps score changes snappy without jumping.
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(from + delta * eased);
      onFrame(value);
      if (progress < 1) {
        return requestAnimationFrame(frame);
      }
      onFrame(to);
      onDone();
      return null;
    }
    return requestAnimationFrame(frame);
  }

  function updateScoreDisplays(nextScore, nextHighScore) {
    if (!scoreEl) return;

    if (scoreTarget !== nextScore) {
      scoreTarget = nextScore;
      if (scoreRafId) cancelAnimationFrame(scoreRafId);
      addScorePop(scoreEl);
      scoreRafId = animateNumber(
        displayedScore,
        nextScore,
        220,
        function (value) {
          displayedScore = value;
          scoreEl.textContent = String(value);
        },
        function () {
          scoreRafId = null;
        }
      );
    } else {
      scoreEl.textContent = String(displayedScore);
    }

    if (!highScoreEl) return;
    if (highScoreTarget !== nextHighScore) {
      highScoreTarget = nextHighScore;
      if (highScoreRafId) cancelAnimationFrame(highScoreRafId);
      addScorePop(highScoreEl);
      highScoreRafId = animateNumber(
        displayedHighScore,
        nextHighScore,
        260,
        function (value) {
          displayedHighScore = value;
          highScoreEl.textContent = String(value);
        },
        function () {
          highScoreRafId = null;
        }
      );
    } else {
      highScoreEl.textContent = String(displayedHighScore);
    }
  }

  function setTextImmediate(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function tick() {
    var previousState = state;
    var previousScore = state.score;
    var wasGameOver = state.gameOver;
    state = SnakeLogic.advance(state);
    refreshSpeedFromScore();
    if (state.score > previousScore) playPop();
    if (didHitObstacle(previousState, state)) {
      playObstacleHitSadSfx();
      triggerObstacleHitPulse();
    }
    playSharpMilestoneCue(previousScore, state.score);
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
    state = SnakeLogic.createInitialState({ gridSize: GRID_SIZE });
    currentTickMs = getTickMsForScore(state.score);
    hasPlayedLoseSound = false;
    hasRecordedScore = false;
    gameOverCommentary = "Try again.";
    buildGrid();
    render();
    startCountdown();
  }

  function handleDirection(nextDirection) {
    if (isInputLocked() || state.gameOver) return;
    state = SnakeLogic.withDirection(state, nextDirection);
    render();
  }

  function togglePausePlay() {
    if (inMenu || countdownSeconds > 0 || isHighScoreModalOpen() || state.gameOver) return;
    state = SnakeLogic.togglePause(state);
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

  function renderGameOverOverlay() {
    if (!gameOverOverlayEl || isHighScoreModalOpen() || inMenu || countdownSeconds > 0) {
      if (gameOverOverlayEl) gameOverOverlayEl.classList.add("hidden");
      return;
    }
    if (!state.gameOver) {
      gameOverOverlayEl.classList.add("hidden");
      return;
    }
    if (gameOverTitleEl) {
      gameOverTitleEl.textContent = state.food === null ? "You Win" : "Game Over";
    }
    if (gameOverTextEl) {
      setTextImmediate(gameOverTextEl, gameOverCommentary);
    }
    gameOverOverlayEl.classList.remove("hidden");
  }

  function renderPauseOverlay() {
    if (!pauseOverlayEl || inMenu || countdownSeconds > 0 || isHighScoreModalOpen() || state.gameOver) {
      if (pauseOverlayEl) pauseOverlayEl.classList.add("hidden");
      return;
    }
    if (state.paused) {
      pauseOverlayEl.classList.remove("hidden");
    } else {
      pauseOverlayEl.classList.add("hidden");
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
      return sanitizeLeaderboardEntries(parsed);
    } catch (_err) {
      return [];
    }
  }

  function sanitizeLeaderboardEntries(entries) {
    if (!Array.isArray(entries)) return [];
    var normalized = entries
      .filter(function (entry) {
        return entry && typeof entry.name === "string" && Number.isFinite(entry.score);
      })
      .map(function (entry) {
        return {
          name: normalizePlayerName(entry.name),
          score: Number(entry.score),
          avatar: AVATARS.indexOf(entry.avatar) >= 0 ? entry.avatar : AVATARS[0],
          date: entry.date || new Date(0).toISOString(),
        };
      });

    // Deduplicate exact same record that can appear after remote/local merge retries.
    var byKey = new Map();
    normalized.forEach(function (entry) {
      var key =
        entry.name + "|" + entry.avatar + "|" + String(entry.score) + "|" + String(entry.date);
      var previous = byKey.get(key);
      if (!previous || previous.date < entry.date) {
        byKey.set(key, entry);
      }
    });

    return Array.from(byKey.values())
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.date < b.date ? 1 : -1;
      })
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  }

  function mergeLeaderboards(baseEntries, extraEntries) {
    return sanitizeLeaderboardEntries((baseEntries || []).concat(extraEntries || []));
  }

  function applyLeaderboard(nextEntries) {
    leaderboard = sanitizeLeaderboardEntries(nextEntries);
    highScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
    saveLeaderboard();
    renderLeaderboard();
    updateScoreDisplays(state.score, Math.max(highScore, state.score));
  }

  function isRemoteLeaderboardEnabled() {
    return /^https?:\/\//i.test(REMOTE_LEADERBOARD_URL);
  }

  function parseRemoteLeaderboardPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload.leaderboard)) return payload.leaderboard;
    if (Array.isArray(payload.entries)) return payload.entries;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function loadRemoteLeaderboard() {
    if (!isRemoteLeaderboardEnabled()) return Promise.resolve([]);
    return fetch(REMOTE_LEADERBOARD_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Remote leaderboard fetch failed");
        return response.json();
      })
      .then(function (payload) {
        return sanitizeLeaderboardEntries(parseRemoteLeaderboardPayload(payload));
      })
      .catch(function () {
        return [];
      });
  }

  function saveRemoteLeaderboard(entries) {
    if (!isRemoteLeaderboardEnabled()) return Promise.resolve();
    return fetch(REMOTE_LEADERBOARD_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboard: sanitizeLeaderboardEntries(entries) }),
    }).then(function (response) {
      if (!response.ok) throw new Error("Remote leaderboard write failed");
    });
  }

  function syncLeaderboardFromRemote() {
    if (!isRemoteLeaderboardEnabled() || remoteLeaderboardSyncBusy) return;
    remoteLeaderboardSyncBusy = true;
    loadRemoteLeaderboard()
      .then(function (remoteEntries) {
        // Remote is the source of truth for shared leaderboard view.
        applyLeaderboard(remoteEntries || []);
      })
      .finally(function () {
        remoteLeaderboardSyncBusy = false;
      });
  }

  function syncLeaderboardToRemote() {
    if (!isRemoteLeaderboardEnabled() || remoteLeaderboardSyncBusy) return;
    remoteLeaderboardSyncBusy = true;
    loadRemoteLeaderboard()
      .then(function (remoteEntries) {
        var mergedEntries = mergeLeaderboards(leaderboard, remoteEntries);
        applyLeaderboard(mergedEntries);
        return saveRemoteLeaderboard(mergedEntries);
      })
      .catch(function () {
        // Remote sync is best-effort; keep local leaderboard working.
      })
      .finally(function () {
        remoteLeaderboardSyncBusy = false;
      });
  }

  function saveLeaderboard() {
    try {
      window.localStorage.setItem(
        LEADERBOARD_KEY,
        JSON.stringify(leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES))
      );
    } catch (_err) {
      // Ignore storage failures.
    }
  }

  function renderLeaderboard() {
    if (!leaderboardListEl) return;
    leaderboardListEl.innerHTML = "";
    if (leaderboard.length === 0) {
      var empty = document.createElement("li");
      empty.className = "leaderboard-row";
      var emptyBadge = document.createElement("span");
      emptyBadge.className = "leaderboard-badge";
      emptyBadge.textContent = "-";
      var emptyText = document.createElement("span");
      emptyText.className = "leaderboard-text";
      emptyText.textContent = "No scores yet";
      empty.appendChild(emptyBadge);
      empty.appendChild(emptyText);
      leaderboardListEl.appendChild(empty);
      return;
    }
    leaderboard.slice(0, 10).forEach(function (entry) {
      var item = document.createElement("li");
      item.className = "leaderboard-row";
      var badge = document.createElement("span");
      badge.className = "leaderboard-badge";
      badge.textContent = String(entry.score);
      var text = document.createElement("span");
      text.className = "leaderboard-text";
      text.textContent = entry.avatar + " " + entry.name;
      item.appendChild(badge);
      item.appendChild(text);
      leaderboardListEl.appendChild(item);
    });
  }

  function normalizePlayerName(value) {
    var cleaned = (value || "").trim().slice(0, 16);
    return cleaned || "Anonymous";
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
    leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
    highScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
    saveLeaderboard();
    renderLeaderboard();
    syncLeaderboardToRemote();
  }

  function isTypingInInputField() {
    var active = document.activeElement;
    if (!active) return false;
    var tag = (active.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return !!active.isContentEditable;
  }

  function handleGameOver() {
    if (hasRecordedScore) return;
    hasRecordedScore = true;
    if (state.food === null) {
      gameOverCommentary = WIN_COMMENTARY[Math.floor(Math.random() * WIN_COMMENTARY.length)];
      return;
    }
    gameOverCommentary = LOSE_COMMENTARY[Math.floor(Math.random() * LOSE_COMMENTARY.length)];
    if (state.score <= 0) return;
    var visibleTopTen = leaderboard.slice(0, 10);
    if (visibleTopTen.length >= 10) {
      var leastTopScore = visibleTopTen[visibleTopTen.length - 1].score;
      if (state.score <= leastTopScore) return;
    }
    var isNewHighScore = state.score > highScore;
    openHighScoreModal(state.score, isNewHighScore);
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

  function openHighScoreModal(score, isNewHighScore) {
    pendingHighScore = score;
    pendingIsNewHighScore = !!isNewHighScore;
    if (!highScoreModalEl) {
      upsertScore(playerProfile.name, score, playerProfile.avatar);
      if (highScoreEl) highScoreEl.textContent = String(highScore);
      pendingHighScore = null;
      pendingIsNewHighScore = false;
      return;
    }
    if (highScoreModalTitleEl) {
      highScoreModalTitleEl.textContent = isNewHighScore ? "Save New High Score" : "Save Score";
    }
    if (saveHighScoreBtn) {
      saveHighScoreBtn.textContent = isNewHighScore ? "Save New High Score" : "Save Score";
    }
    if (highScoreModalTextEl) {
      var modalText = "Score " + score + ". Save this run to the leaderboard?";
      setTextImmediate(highScoreModalTextEl, modalText);
    }
    if (highScoreNameInput) highScoreNameInput.value = playerProfile.name;
    setSelectedAvatar(playerProfile.avatar);
    highScoreModalEl.classList.remove("hidden");
    if (highScoreNameInput) highScoreNameInput.focus();
    if (isNewHighScore) triggerConfettiBurst();
  }

  function triggerConfettiBurst() {
    if (!confettiLayerEl) return;
    confettiLayerEl.innerHTML = "";
    var colors = ["#f44336", "#ef5350", "#ff7043", "#29b6f6", "#66bb6a", "#ffee58"];
    var count = 120;
    for (var i = 0; i < count; i += 1) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.25 + "s";
      piece.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
      piece.style.transform = "rotate(" + Math.round(Math.random() * 360) + "deg)";
      confettiLayerEl.appendChild(piece);
    }
    setTimeout(function () {
      if (confettiLayerEl) confettiLayerEl.innerHTML = "";
    }, 2600);
  }

  function closeHighScoreModal() {
    pendingHighScore = null;
    pendingIsNewHighScore = false;
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
    restart();
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
    if (cancelHighScoreBtn) {
      cancelHighScoreBtn.addEventListener("click", function () {
        markUserInteraction();
        closeHighScoreModal();
        restart();
      });
    }
    if (highScoreNameInput) {
      highScoreNameInput.addEventListener("input", function () {
        highScoreNameInput.classList.remove("name-pop");
        void highScoreNameInput.offsetWidth;
        highScoreNameInput.classList.add("name-pop");
      });
      highScoreNameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          markUserInteraction();
          savePendingHighScore();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeHighScoreModal();
          restart();
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

  function didHitObstacle(previousState, nextState) {
    var prevObstacles = (previousState && previousState.obstacles) || [];
    var nextObstacles = (nextState && nextState.obstacles) || [];
    return nextObstacles.length < prevObstacles.length;
  }

  function triggerObstacleHitPulse() {
    if (!gameRoot) return;
    gameRoot.classList.remove("obstacle-hit-pulse");
    void gameRoot.offsetWidth;
    gameRoot.classList.add("obstacle-hit-pulse");
    if (obstaclePulseTimeoutId) clearTimeout(obstaclePulseTimeoutId);
    obstaclePulseTimeoutId = setTimeout(function () {
      gameRoot.classList.remove("obstacle-hit-pulse");
      obstaclePulseTimeoutId = null;
    }, 340);
  }

  function playObstacleHitSadSfx() {
    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var now = audioCtx.currentTime;
    var notes = [392.0, 329.63, 261.63];
    for (var i = 0; i < notes.length; i += 1) {
      var start = now + i * 0.08;
      var end = start + 0.12;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(notes[i], start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(OBSTACLE_HIT_SFX_GAIN, start + 0.01);
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
    if (count === 2) frequency = 587.33;
    if (count === 1) frequency = 659.25;

    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(COUNTDOWN_SFX_GAIN * 0.68, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    if ("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function") {
      var word = count === 3 ? "Ready" : count === 2 ? "Set" : "Go";
      var utterance = new window.SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 0.98;
      utterance.volume = 0.92;
      var preferredVoice = getPreferredCountdownVoice();
      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  function scoreVoice(voice) {
    var name = (voice && voice.name ? voice.name : "").toLowerCase();
    var score = 0;
    if (voice && voice.localService) score += 3;
    if (name.indexOf("samantha") >= 0) score += 6;
    if (name.indexOf("siri") >= 0) score += 6;
    if (name.indexOf("google us english") >= 0) score += 5;
    if (name.indexOf("alex") >= 0) score += 4;
    if (name.indexOf("victoria") >= 0) score += 3;
    if (name.indexOf("enhanced") >= 0) score += 2;
    if (name.indexOf("compact") >= 0) score -= 3;
    return score;
  }

  function getPreferredCountdownVoice() {
    if (!("speechSynthesis" in window)) return null;
    if (countdownVoiceLoaded) return countdownVoice;
    countdownVoiceLoaded = true;

    var voices = window.speechSynthesis.getVoices() || [];
    var englishVoices = voices.filter(function (voice) {
      var lang = (voice.lang || "").toLowerCase();
      return lang.indexOf("en") === 0;
    });
    if (englishVoices.length === 0) return null;

    englishVoices.sort(function (a, b) {
      return scoreVoice(b) - scoreVoice(a);
    });
    countdownVoice = englishVoices[0] || null;
    return countdownVoice;
  }

  function setupSpeechVoices() {
    if (!("speechSynthesis" in window)) return;
    getPreferredCountdownVoice();
    window.speechSynthesis.onvoiceschanged = function () {
      countdownVoiceLoaded = false;
      getPreferredCountdownVoice();
    };
  }

  function playSharpMilestoneCue(previousScore, nextScore) {
    if (nextScore <= previousScore) return;
    var previousMilestone = Math.floor(previousScore / SCORE_MILESTONE_STEP);
    var nextMilestone = Math.floor(nextScore / SCORE_MILESTONE_STEP);
    if (nextMilestone <= previousMilestone) return;

    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.07);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(SHARP_SFX_GAIN, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function playClickSfx() {
    primeAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }

    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.035);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(CLICK_SFX_GAIN, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  function setupButtonClickSfx() {
    // Delegated handler covers both static and dynamically-created buttons.
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest("button")) return;
      playClickSfx();
    });
  }

  function setupSwipeControls() {
    if (!gameRoot) return;
    var startX = 0;
    var startY = 0;
    var tracking = false;
    var SWIPE_MIN_DISTANCE = 18;

    gameRoot.addEventListener(
      "touchstart",
      function (event) {
        if (!event.touches || event.touches.length === 0) return;
        var touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      },
      { passive: true }
    );

    gameRoot.addEventListener(
      "touchend",
      function (event) {
        if (!tracking || !event.changedTouches || event.changedTouches.length === 0) return;
        tracking = false;

        var touch = event.changedTouches[0];
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        var absX = Math.abs(dx);
        var absY = Math.abs(dy);
        if (Math.max(absX, absY) < SWIPE_MIN_DISTANCE) return;

        var direction = null;
        if (absX > absY) {
          direction = dx > 0 ? "right" : "left";
        } else {
          direction = dy > 0 ? "down" : "up";
        }

        markUserInteraction();
        primeAudio();
        handleDirection(direction);
      },
      { passive: true }
    );
  }

  function updateCollapseButton(button, isCollapsed) {
    if (!button) return;
    button.textContent = isCollapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
  }

  function setupMobileCollapsibles() {
    if (!collapseToggles || collapseToggles.length === 0) return;

    function syncCollapsibleMode() {
      var isMobile = mobileMediaQuery.matches;
      collapseToggles.forEach(function (button) {
        var section = button.closest(".collapsible");
        if (!section) return;
        if (!isMobile) {
          section.classList.remove("is-collapsed");
          updateCollapseButton(button, false);
          return;
        }
        updateCollapseButton(button, section.classList.contains("is-collapsed"));
      });
    }

    collapseToggles.forEach(function (button) {
      button.addEventListener("click", function () {
        if (!mobileMediaQuery.matches) return;
        var section = button.closest(".collapsible");
        if (!section) return;
        var isCollapsed = section.classList.toggle("is-collapsed");
        updateCollapseButton(button, isCollapsed);
      });
    });

    syncCollapsibleMode();
    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", syncCollapsibleMode);
    } else if (typeof mobileMediaQuery.addListener === "function") {
      mobileMediaQuery.addListener(syncCollapsibleMode);
    }
  }

  function handleKeydown(event) {
    if (isTypingInInputField()) return;
    markUserInteraction();
    primeAudio();
    var key = event.key.toLowerCase();
    if (key.indexOf("arrow") === 0 || key === " ") {
      event.preventDefault();
    }
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
      togglePausePlay();
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
    togglePausePlay();
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
  if (gameOverRestartBtn) {
    gameOverRestartBtn.addEventListener("click", function () {
      markUserInteraction();
      restart();
    });
  }
  document.addEventListener("keydown", handleKeydown);

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      gridSize: state.gridSize,
      snake: state.snake,
      direction: state.direction,
      foods: Array.isArray(state.foods) ? state.foods : state.food ? [state.food] : [],
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
      var previousState = state;
      var previousScore = state.score;
      var wasGameOver = state.gameOver;
      state = SnakeLogic.advance(state);
      if (state.score > previousScore) playPop();
      if (didHitObstacle(previousState, state)) {
        playObstacleHitSadSfx();
        triggerObstacleHitPulse();
      }
      playSharpMilestoneCue(previousScore, state.score);
      if (!wasGameOver && state.gameOver && state.food !== null) playLoseJingle();
      if (!wasGameOver && state.gameOver) handleGameOver();
      if (state.gameOver) break;
    }
    render();
  };

  setupProfileModal();
  setupMusicControls();
  setupSpeechVoices();
  setupGlobalAudioUnlock();
  setupSwipeControls();
  setupMobileCollapsibles();
  setupButtonClickSfx();
  renderLeaderboard();
  buildGrid();
  updateScoreDisplays(state.score, Math.max(highScore, state.score));
  render();
  syncLeaderboardFromRemote();
  if (isRemoteLeaderboardEnabled()) {
    setInterval(syncLeaderboardFromRemote, 15000);
  }
  syncBackgroundMusic();
  startAutoplayRetry();
})();
