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
    food: { x: 0, y: 0, type: "large", scale: 0.78, color: "#c62828", points: 1 },
    obstacles: [],
    score: 0,
    nextObstacleScore: 12,
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
    food: { x: 5, y: 5, type: "large", scale: 0.78, color: "#c62828", points: 1 },
    obstacles: [],
    score: 0,
    nextObstacleScore: 12,
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
    food: { x: 3, y: 2, type: "small", scale: 0.45, color: "#fbc02d", points: 3 },
    obstacles: [],
    score: 0,
    nextObstacleScore: 12,
    gameOver: false,
    paused: false,
  };
  const next = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(next.score, 3, "score should increase by food point value");
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
  assert.notStrictEqual(food.x + "," + food.y, "0,0");
  assert.notStrictEqual(food.x + "," + food.y, "1,0");
  assert.notStrictEqual(food.x + "," + food.y, "2,0");
  assert.ok(typeof food.points === "number" && food.points > 0, "food should include points");
  assert.ok(typeof food.scale === "number" && food.scale > 0, "food should include scale");
  assert.ok(typeof food.color === "string" && food.color.length > 0, "food should include color");
}

function testObstacleSpawnsAtTwelvePoints() {
  let state = {
    gridSize: 8,
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
    direction: "right",
    nextDirection: "right",
    food: { x: 3, y: 2, type: "large", scale: 0.78, color: "#c62828", points: 1 },
    obstacles: [],
    score: 11,
    nextObstacleScore: 12,
    gameOver: false,
    paused: false,
  };
  const next = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(next.score, 12, "score should reach 12");
  assert.strictEqual(
    next.obstacles.length,
    SnakeLogic.OBSTACLES_PER_MILESTONE,
    "multiple obstacles should spawn at 12 points"
  );
  assert.strictEqual(next.nextObstacleScore, 24, "next obstacle threshold should move to 24");
}

function testEatingObstacleShrinksSnake() {
  let state = {
    gridSize: 8,
    snake: [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
    direction: "right",
    nextDirection: "right",
    food: { x: 7, y: 7, type: "large", scale: 0.78, color: "#c62828", points: 1 },
    obstacles: [{ x: 4, y: 2 }],
    score: 10,
    nextObstacleScore: 12,
    gameOver: false,
    paused: false,
  };
  const next = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(next.score, 10, "obstacle should not change score");
  assert.strictEqual(next.snake.length, 3, "eating obstacle should shrink snake by one segment");
  assert.strictEqual(next.obstacles.length, 0, "eaten obstacle should be removed");
}

function testFoodCountScalesWithSnakeLength() {
  let state = {
    gridSize: 10,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ],
    direction: "right",
    nextDirection: "right",
    food: { x: 3, y: 2, type: "large", scale: 0.78, color: "#c62828", points: 1 },
    foods: [
      { x: 3, y: 2, type: "large", scale: 0.78, color: "#c62828", points: 1 },
      { x: 7, y: 7, type: "medium", scale: 0.62, color: "#ef6c00", points: 2 },
    ],
    obstacles: [],
    score: 0,
    nextObstacleScore: 12,
    gameOver: false,
    paused: false,
  };
  const next = SnakeLogic.advance(state, fixedRandom([0]));
  assert.strictEqual(next.foods.length >= 2, true, "longer snake should keep multiple foods");
}

function run() {
  testMovement();
  testDirectionChange();
  testWallCollision();
  testSelfCollision();
  testGrowthAndScore();
  testFoodPlacementAvoidsSnake();
  testObstacleSpawnsAtTwelvePoints();
  testEatingObstacleShrinksSnake();
  testFoodCountScalesWithSnakeLength();
  console.log("snake-logic tests passed");
}

run();
