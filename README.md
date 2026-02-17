# Snake Game

Classic Snake implemented with dependency-free HTML/CSS/JS.

## Run

From the repo root, run:

```bash
./run.sh
```

This opens the game in your browser automatically.
It uses `http://localhost:8000/index.html` when local ports are available, and falls back to opening `index.html` directly when the run sandbox blocks local ports.

## Test

Run core logic tests:

```bash
node tests/snake-logic.test.js
```
