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
  var OBSTACLE_SCORE_STEP = 12;
  var BASE_SNAKE_LENGTH = 3;
  var FOOD_LENGTH_STEP = 6;
  var MAX_FOOD_COUNT = 4;

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

  function getFoodsFromState(state) {
    if (Array.isArray(state.foods)) {
      return state.foods.filter(Boolean);
    }
    return state.food ? [state.food] : [];
  }

  function getTargetFoodCount(snakeLength) {
    // Longer snakes get extra simultaneous food targets (capped for board readability).
    var extraFoods = Math.floor(Math.max(0, snakeLength - BASE_SNAKE_LENGTH) / FOOD_LENGTH_STEP);
    return Math.min(MAX_FOOD_COUNT, 1 + extraFoods);
  }

  function fillFoods(gridSize, snake, obstacles, foods, targetCount, randomFn) {
    var nextFoods = (foods || []).map(function (food) {
      return Object.assign({}, food);
    });

    while (nextFoods.length < targetCount) {
      var occupied = new Set(snake.map(posKey));
      (obstacles || []).forEach(function (obstacle) {
        occupied.add(posKey(obstacle));
      });
      nextFoods.forEach(function (food) {
        occupied.add(posKey(food));
      });

      var freeCells = [];
      for (var y = 0; y < gridSize; y += 1) {
        for (var x = 0; x < gridSize; x += 1) {
          var candidate = { x: x, y: y };
          if (!occupied.has(posKey(candidate))) freeCells.push(candidate);
        }
      }

      if (freeCells.length === 0) break;
      var position = freeCells[randomInt(freeCells.length, randomFn)];
      nextFoods.push(makeFood(position, randomFn));
    }

    return nextFoods;
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
    var foods = fillFoods(gridSize, snake, obstacles, [], 1, opts.randomFn);
    var food = foods.length > 0 ? foods[0] : null;

    return {
      gridSize: gridSize,
      snake: snake,
      direction: direction,
      nextDirection: direction,
      foods: foods,
      food: food,
      obstacles: obstacles,
      score: 0,
      nextObstacleScore: OBSTACLE_SCORE_STEP,
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
    getFoodsFromState(state).forEach(function (food) {
      occupied.add(posKey(food));
    });
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
    getFoodsFromState(state).forEach(function (food) {
      occupied.add(posKey(food));
    });
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
    var foods = getFoodsFromState(state).map(function (food) {
      return Object.assign({}, food);
    });
    var nextObstacleScore = state.nextObstacleScore || OBSTACLE_SCORE_STEP;
    var head = snake[0];
    var nextHead = nextHeadPosition(head, direction);

    if (outOfBounds(nextHead, state.gridSize)) {
      return Object.assign({}, state, { direction: direction, gameOver: true });
    }

    var eatenFoodIndex = foods.findIndex(function (food) {
      return nextHead.x === food.x && nextHead.y === food.y;
    });
    var eatingFood = eatenFoodIndex >= 0;
    var obstacleIndex = obstacles.findIndex(function (obstacle) {
      return obstacle.x === nextHead.x && obstacle.y === nextHead.y;
    });
    var eatingObstacle = obstacleIndex >= 0;
    var bodyToCheck = eatingFood ? snake : snake.slice(0, snake.length - 1);
    var bodySet = new Set(bodyToCheck.map(posKey));
    var selfBiteIndex = -1;
    if (bodySet.has(posKey(nextHead))) {
      selfBiteIndex = bodyToCheck.findIndex(function (segment) {
        return segment.x === nextHead.x && segment.y === nextHead.y;
      });
    }

    snake.unshift(nextHead);
    var score = state.score;
    var eatenFood = null;
    if (eatingFood) {
      eatenFood = foods.splice(eatenFoodIndex, 1)[0];
      score += eatenFood.points;
    } else {
      snake.pop();
    }

    if (eatingObstacle) {
      obstacles.splice(obstacleIndex, 1);
      if (snake.length > 2) snake.pop();
    }

    if (selfBiteIndex >= 0) {
      var keepLength = Math.max(2, selfBiteIndex + 1);
      snake = snake.slice(0, keepLength);
    }

    var targetFoodCount = getTargetFoodCount(snake.length);
    if (foods.length > targetFoodCount) {
      foods = foods.slice(0, targetFoodCount);
    }
    foods = fillFoods(
      state.gridSize,
      snake,
      obstacles,
      foods,
      targetFoodCount,
      randomFn
    );
    var food = foods.length > 0 ? foods[0] : null;

    while (score >= nextObstacleScore) {
      for (var spawnCount = 0; spawnCount < OBSTACLES_PER_MILESTONE; spawnCount += 1) {
        var spawnedObstacle = placeObstacle(
          { gridSize: state.gridSize, food: food, foods: foods, obstacles: obstacles },
          snake,
          direction,
          randomFn
        );
        if (!spawnedObstacle) break;
        obstacles.push(spawnedObstacle);
      }
      nextObstacleScore += OBSTACLE_SCORE_STEP;
    }

    return Object.assign({}, state, {
      snake: snake,
      direction: direction,
      nextDirection: direction,
      foods: foods,
      food: food,
      obstacles: obstacles,
      score: score,
      nextObstacleScore: nextObstacleScore,
      gameOver: foods.length === 0,
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
    OBSTACLE_SCORE_STEP: OBSTACLE_SCORE_STEP,
    getTargetFoodCount: getTargetFoodCount,
    createInitialState: createInitialState,
    placeFood: placeFood,
    withDirection: withDirection,
    advance: advance,
    togglePause: togglePause,
  };
});
