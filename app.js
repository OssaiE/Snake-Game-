(function () {
  "use strict";

  var CELL_SIZE = 24;
  var TICK_MS = 120;
  var gameRoot = document.getElementById("game");
  var scoreEl = document.getElementById("score");
  var statusEl = document.getElementById("status");
  var restartBtn = document.getElementById("restart-btn");
  var pauseBtn = document.getElementById("pause-btn");
  var controls = document.querySelectorAll("[data-direction]");

  var state = SnakeLogic.createInitialState({ gridSize: 16 });
  var tickId = null;

  function buildGrid() {
    gameRoot.style.gridTemplateColumns = "repeat(" + state.gridSize + ", " + CELL_SIZE + "px)";
    gameRoot.style.gridTemplateRows = "repeat(" + state.gridSize + ", " + CELL_SIZE + "px)";
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
      cell.classList.remove("snake", "head", "food");
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
    }

    scoreEl.textContent = String(state.score);
    if (state.gameOver && state.food === null) {
      statusEl.textContent = "You win. Restart to play again.";
    } else if (state.gameOver) {
      statusEl.textContent = "Game over. Press Restart.";
    } else if (state.paused) {
      statusEl.textContent = "Paused";
    } else {
      statusEl.textContent = "Running";
    }
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  }

  function tick() {
    state = SnakeLogic.advance(state);
    render();
    if (state.gameOver && tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function startLoop() {
    if (tickId) clearInterval(tickId);
    tickId = setInterval(tick, TICK_MS);
  }

  function restart() {
    state = SnakeLogic.createInitialState({ gridSize: 16 });
    buildGrid();
    render();
    startLoop();
  }

  function handleDirection(nextDirection) {
    state = SnakeLogic.withDirection(state, nextDirection);
    render();
  }

  function handleKeydown(event) {
    var key = event.key.toLowerCase();
    if (key === "arrowup" || key === "w") handleDirection("up");
    if (key === "arrowdown" || key === "s") handleDirection("down");
    if (key === "arrowleft" || key === "a") handleDirection("left");
    if (key === "arrowright" || key === "d") handleDirection("right");
    if (key === "p" || key === " ") {
      event.preventDefault();
      state = SnakeLogic.togglePause(state);
      render();
    }
    if (key === "r") restart();
  }

  controls.forEach(function (button) {
    button.addEventListener("click", function () {
      handleDirection(button.dataset.direction);
    });
  });

  pauseBtn.addEventListener("click", function () {
    state = SnakeLogic.togglePause(state);
    render();
  });

  restartBtn.addEventListener("click", restart);
  document.addEventListener("keydown", handleKeydown);

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      gridSize: state.gridSize,
      snake: state.snake,
      direction: state.direction,
      food: state.food,
      score: state.score,
      gameOver: state.gameOver,
      paused: state.paused,
    });
  };

  window.advanceTime = function (ms) {
    var steps = Math.max(1, Math.round(ms / TICK_MS));
    for (var i = 0; i < steps; i += 1) {
      state = SnakeLogic.advance(state);
      if (state.gameOver) break;
    }
    render();
  };

  buildGrid();
  render();
  startLoop();
})();
