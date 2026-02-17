(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeLogic = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  var DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function cloneSnake(snake) {
    return snake.map(function (segment) {
      return { x: segment.x, y: segment.y };
    });
  }

  function posKey(pos) {
    return pos.x + "," + pos.y;
  }

  function isOppositeDirection(current, next) {
    if (!DIRECTIONS[current] || !DIRECTIONS[next]) return false;
    return (
      DIRECTIONS[current].x + DIRECTIONS[next].x === 0 &&
      DIRECTIONS[current].y + DIRECTIONS[next].y === 0
    );
  }

  function randomInt(max, randomFn) {
    return Math.floor((randomFn || Math.random)() * max);
  }

  function placeFood(gridSize, snake, randomFn) {
    var occupied = new Set(snake.map(posKey));
    var freeCells = [];
    for (var y = 0; y < gridSize; y += 1) {
      for (var x = 0; x < gridSize; x += 1) {
        var candidate = { x: x, y: y };
        if (!occupied.has(posKey(candidate))) {
          freeCells.push(candidate);
        }
      }
    }

    if (freeCells.length === 0) return null;
    return freeCells[randomInt(freeCells.length, randomFn)];
  }

  function createInitialState(options) {
    var opts = options || {};
    var gridSize = opts.gridSize || 16;
    var startX = Math.floor(gridSize / 2);
    var startY = Math.floor(gridSize / 2);
    var snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    var direction = "right";
    var food = placeFood(gridSize, snake, opts.randomFn);

    return {
      gridSize: gridSize,
      snake: snake,
      direction: direction,
      nextDirection: direction,
      food: food,
      score: 0,
      gameOver: false,
      paused: false,
    };
  }

  function withDirection(state, nextDirection) {
    if (!DIRECTIONS[nextDirection]) return state;
    if (isOppositeDirection(state.direction, nextDirection)) return state;
    return Object.assign({}, state, { nextDirection: nextDirection });
  }

  function nextHeadPosition(head, direction) {
    var vector = DIRECTIONS[direction];
    return { x: head.x + vector.x, y: head.y + vector.y };
  }

  function outOfBounds(pos, gridSize) {
    return pos.x < 0 || pos.y < 0 || pos.x >= gridSize || pos.y >= gridSize;
  }

  function advance(state, randomFn) {
    if (state.gameOver || state.paused) return state;

    var direction = state.nextDirection;
    if (isOppositeDirection(state.direction, direction)) {
      direction = state.direction;
    }

    var snake = cloneSnake(state.snake);
    var head = snake[0];
    var nextHead = nextHeadPosition(head, direction);

    if (outOfBounds(nextHead, state.gridSize)) {
      return Object.assign({}, state, { direction: direction, gameOver: true });
    }

    var eatingFood =
      state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;
    var bodyToCheck = eatingFood ? snake : snake.slice(0, snake.length - 1);
    var bodySet = new Set(bodyToCheck.map(posKey));
    if (bodySet.has(posKey(nextHead))) {
      return Object.assign({}, state, { direction: direction, gameOver: true });
    }

    snake.unshift(nextHead);
    var score = state.score;
    var food = state.food;
    if (eatingFood) {
      score += 1;
      food = placeFood(state.gridSize, snake, randomFn);
    } else {
      snake.pop();
    }

    return Object.assign({}, state, {
      snake: snake,
      direction: direction,
      nextDirection: direction,
      food: food,
      score: score,
      gameOver: food === null,
    });
  }

  function togglePause(state) {
    if (state.gameOver) return state;
    return Object.assign({}, state, { paused: !state.paused });
  }

  return {
    DIRECTIONS: DIRECTIONS,
    createInitialState: createInitialState,
    placeFood: placeFood,
    withDirection: withDirection,
    advance: advance,
    togglePause: togglePause,
  };
});
