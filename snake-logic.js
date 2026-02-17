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

  var FOOD_TYPES = [
    { id: "small", scale: 0.45, color: "#fbc02d", points: 3, weight: 20 },
    { id: "medium", scale: 0.62, color: "#ef6c00", points: 2, weight: 35 },
    { id: "large", scale: 0.78, color: "#c62828", points: 1, weight: 45 },
  ];
  var OBSTACLES_PER_MILESTONE = 3;

  function cloneSnake(snake) {
    return snake.map(function (segment) {
      return { x: segment.x, y: segment.y };
    });
  }

  function posKey(pos) {
    return pos.x + "," + pos.y;
  }

  function cloneObstacles(obstacles) {
    return (obstacles || []).map(function (obstacle) {
      return { x: obstacle.x, y: obstacle.y };
    });
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

  function randomChoiceByWeight(items, randomFn) {
    var totalWeight = items.reduce(function (sum, item) {
      return sum + item.weight;
    }, 0);
    var target = (randomFn || Math.random)() * totalWeight;
    var cumulative = 0;

    for (var i = 0; i < items.length; i += 1) {
      cumulative += items[i].weight;
      if (target <= cumulative) return items[i];
    }
    return items[items.length - 1];
  }

  function makeFood(position, randomFn) {
    var foodType = randomChoiceByWeight(FOOD_TYPES, randomFn);
    return {
      x: position.x,
      y: position.y,
      type: foodType.id,
      scale: foodType.scale,
      color: foodType.color,
      points: foodType.points,
    };
  }

  function placeFood(gridSize, snake, obstaclesOrRandom, randomFnMaybe) {
    var randomFn = randomFnMaybe;
    var obstacles = [];
    if (typeof obstaclesOrRandom === "function") {
      randomFn = obstaclesOrRandom;
    } else {
      obstacles = obstaclesOrRandom || [];
    }

    var occupied = new Set(snake.map(posKey));
    obstacles.forEach(function (obstacle) {
      occupied.add(posKey(obstacle));
    });
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
    var position = freeCells[randomInt(freeCells.length, randomFn)];
    return makeFood(position, randomFn);
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
    var obstacles = [];
    var food = placeFood(gridSize, snake, obstacles, opts.randomFn);

    return {
      gridSize: gridSize,
      snake: snake,
      direction: direction,
      nextDirection: direction,
      food: food,
      obstacles: obstacles,
      score: 0,
      nextObstacleScore: 30,
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

  function findPathObstaclePosition(state, snake, direction) {
    var vector = DIRECTIONS[direction];
    var head = snake[0];
    var occupied = new Set(snake.map(posKey));
    if (state.food) occupied.add(posKey(state.food));
    (state.obstacles || []).forEach(function (obstacle) {
      occupied.add(posKey(obstacle));
    });

    for (var step = 1; step < state.gridSize; step += 1) {
      var candidate = {
        x: head.x + vector.x * step,
        y: head.y + vector.y * step,
      };
      if (outOfBounds(candidate, state.gridSize)) break;
      if (!occupied.has(posKey(candidate))) return candidate;
    }

    return null;
  }

  function placeObstacleFallback(state, snake, randomFn) {
    var occupied = new Set(snake.map(posKey));
    if (state.food) occupied.add(posKey(state.food));
    (state.obstacles || []).forEach(function (obstacle) {
      occupied.add(posKey(obstacle));
    });

    var freeCells = [];
    for (var y = 0; y < state.gridSize; y += 1) {
      for (var x = 0; x < state.gridSize; x += 1) {
        var cell = { x: x, y: y };
        if (!occupied.has(posKey(cell))) freeCells.push(cell);
      }
    }
    if (freeCells.length === 0) return null;
    return freeCells[randomInt(freeCells.length, randomFn)];
  }

  function placeObstacle(state, snake, direction, randomFn) {
    return (
      findPathObstaclePosition(state, snake, direction) ||
      placeObstacleFallback(state, snake, randomFn)
    );
  }

  function advance(state, randomFn) {
    if (state.gameOver || state.paused) return state;

    var direction = state.nextDirection;
    if (isOppositeDirection(state.direction, direction)) {
      direction = state.direction;
    }

    var snake = cloneSnake(state.snake);
    var obstacles = cloneObstacles(state.obstacles);
    var nextObstacleScore = state.nextObstacleScore || 30;
    var head = snake[0];
    var nextHead = nextHeadPosition(head, direction);

    if (outOfBounds(nextHead, state.gridSize)) {
      return Object.assign({}, state, { direction: direction, gameOver: true });
    }

    var eatingFood =
      state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;
    var obstacleIndex = obstacles.findIndex(function (obstacle) {
      return obstacle.x === nextHead.x && obstacle.y === nextHead.y;
    });
    var eatingObstacle = obstacleIndex >= 0;
    var bodyToCheck = eatingFood ? snake : snake.slice(0, snake.length - 1);
    var bodySet = new Set(bodyToCheck.map(posKey));
    if (bodySet.has(posKey(nextHead))) {
      return Object.assign({}, state, { direction: direction, gameOver: true });
    }

    snake.unshift(nextHead);
    var score = state.score;
    var food = state.food;
    if (eatingFood) {
      score += state.food.points;
      food = placeFood(state.gridSize, snake, obstacles, randomFn);
    } else {
      snake.pop();
    }

    if (eatingObstacle) {
      obstacles.splice(obstacleIndex, 1);
      if (snake.length > 2) snake.pop();
    }

    while (score >= nextObstacleScore) {
      for (var spawnCount = 0; spawnCount < OBSTACLES_PER_MILESTONE; spawnCount += 1) {
        var spawnedObstacle = placeObstacle(
          { gridSize: state.gridSize, food: food, obstacles: obstacles },
          snake,
          direction,
          randomFn
        );
        if (!spawnedObstacle) break;
        obstacles.push(spawnedObstacle);
      }
      nextObstacleScore += 30;
    }

    return Object.assign({}, state, {
      snake: snake,
      direction: direction,
      nextDirection: direction,
      food: food,
      obstacles: obstacles,
      score: score,
      nextObstacleScore: nextObstacleScore,
      gameOver: food === null,
    });
  }

  function togglePause(state) {
    if (state.gameOver) return state;
    return Object.assign({}, state, { paused: !state.paused });
  }

  return {
    DIRECTIONS: DIRECTIONS,
    FOOD_TYPES: FOOD_TYPES,
    OBSTACLES_PER_MILESTONE: OBSTACLES_PER_MILESTONE,
    createInitialState: createInitialState,
    placeFood: placeFood,
    withDirection: withDirection,
    advance: advance,
    togglePause: togglePause,
  };
});
