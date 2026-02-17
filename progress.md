Original prompt: Build a classic Snake game in this repo.

2026-02-17
- Repository is empty (no framework/tooling present), so implementing dependency-free static HTML/CSS/JS.
- Plan: isolate deterministic game logic, wire minimal UI loop, add keyboard + on-screen controls, add Node test script.
- Added `snake-logic.js` with deterministic pure functions for state creation, movement, food placement, collision checks, pause toggle.
- Added minimal UI (`index.html`, `styles.css`, `app.js`) with score, status, restart, pause, keyboard (arrows/WASD), and on-screen controls.
- Added deterministic hooks: `window.render_game_to_text()` and `window.advanceTime(ms)` for automated stepping/inspection.
- Added `tests/snake-logic.test.js` for movement, direction input, wall/self collisions, growth+score, and safe food placement.
- Ran `node tests/snake-logic.test.js` successfully (all tests passed).
- Playwright skill client could not run in this environment due ESM execution mismatch (`Cannot use import statement outside a module`).
- TODO: If browser automation is required, run the Playwright client in an ESM-configured Node environment.
- Added food variants with different visual sizes/colors and weighted spawn rates.
- Scoring now uses per-food points (small/yellow=3, medium/orange=2, large/red=1).
- Added WebAudio pop sound when food is eaten (triggered after first user interaction due browser audio policies).
- Updated logic tests to cover food metadata and point-based scoring.
- Added a game-over jingle (Mario-style retro descending tones) triggered once when losing.
- Added obstacle system: each 30 score milestone spawns a gray obstacle on the snake's forward path.
- Eating an obstacle now shrinks snake length by one segment and removes that obstacle.
- Updated tests to validate milestone spawning and obstacle consumption behavior.
- Updated obstacle milestones to spawn multiple gray obstacles (3 per 30-point threshold).
- Added persistent high score using `localStorage` and surfaced it in the top HUD.
- Added player-name-based score saving and persistent leaderboard (`snake_leaderboard_v1`).
- Added 3-second countdown before gameplay starts (initial load and each restart).
- Changed score recording to save only when the player sets a new high score (not every game over).
- Replaced text countdown with a full-screen movie-style modal countdown overlay.
- Removed always-visible name input; new high-score name/avatar is collected in a modal only when a record is set.
- Leaderboard entries now include avatar + name.
- Added ready/set/go audio cues during countdown (tone + voice).
