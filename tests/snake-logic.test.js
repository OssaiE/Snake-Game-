const assert = require("assert");
const SnakeLogic = require("../snake-logic");

function fixedRandom(values) {
  let i = 0;
  return () => {
    const value = values[i % values.length];
    i += 1;
    return value;
  };
}

function testMovement() {
  let state = SnakeLogic.createInitialState({ gridSize: 8 });
  const head = state.snake[0];
  state = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(state.snake[0].x, head.x + 1, "snake should move right by default");
  assert.strictEqual(state.snake[0].y, head.y, "snake should keep same y on right move");
}

function testDirectionChange() {
  let state = SnakeLogic.createInitialState({ gridSize: 8 });
  state = SnakeLogic.withDirection(state, "up");
  state = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(state.snake[0].y, Math.floor(8 / 2) - 1, "snake should move up after input");
}

function testWallCollision() {
  let state = {
    gridSize: 4,
    snake: [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    direction: "right",
    nextDirection: "right",
    food: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
    paused: false,
  };
  state = SnakeLogic.advance(state);
  assert.strictEqual(state.gameOver, true, "crossing boundary should end game");
}

function testSelfCollision() {
  let state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    direction: "up",
    nextDirection: "left",
    food: { x: 5, y: 5 },
    score: 0,
    gameOver: false,
    paused: false,
  };
  state = SnakeLogic.advance(state);
  assert.strictEqual(state.gameOver, true, "moving into own body should end game");
}

function testGrowthAndScore() {
  let state = {
    gridSize: 6,
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
    direction: "right",
    nextDirection: "right",
    food: { x: 3, y: 2 },
    score: 0,
    gameOver: false,
    paused: false,
  };
  const next = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(next.score, 1, "score should increase after eating");
  assert.strictEqual(next.snake.length, 4, "snake should grow by one");
}

function testFoodPlacementAvoidsSnake() {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const food = SnakeLogic.placeFood(3, snake, fixedRandom([0]));
  assert.ok(food, "food should be placed when free cells exist");
  assert.notDeepStrictEqual(food, { x: 0, y: 0 });
  assert.notDeepStrictEqual(food, { x: 1, y: 0 });
  assert.notDeepStrictEqual(food, { x: 2, y: 0 });
}

function run() {
  testMovement();
  testDirectionChange();
  testWallCollision();
  testSelfCollision();
  testGrowthAndScore();
  testFoodPlacementAvoidsSnake();
  console.log("snake-logic tests passed");
}

run();
