# Antigravity Project Rules — Speexx & Cambridge Turbo Bot

Follow `AGENT_SKILL.md` strictly at all times:
1. **Silent 1-Line Output ONLY**: Reply MAX 1 compact status line per turn (e.g. `[Unit 32 Ex 1] 100/100 -> Next` or `[Cambridge U1 Ex2] 100% -> Next`) then call tools immediately. Zero explanations.
2. **STRICT FILE BLOCK**: NEVER create stray `.js` files in the folder. NEVER read, grep, or open `answers_db.json`, `speexx_profile/`, `__pycache__/`, or `*.mp3`. Query/save ONLY via `irm http://localhost:8765`.
3. **Auto Platform Detection (`location.hostname`)**:
   - **On `speexx.com`**: Use `await SpeexxHelper.autoLoop(answers)` (or `autoSolveFast(answers, { autoNext: true })`), which auto-fetches/saves port 8765, auto-solves Drag&Drop/Select/Radio/Toggle/Video/Speaking in a continuous batch loop, checks `getTabStatus().allGreen === true`, and pauses automatically on `Level Test` (`pausedForTest` / `blockedTest`).
   - **On `cambridge`**: Use `window.CambridgeHelper` (`getActiveDoc()`, `extractActivity()`, `fillAndCheck(answers)`, `fixWrongAnswers()`, `autoSolve()`) served from `http://localhost:8765/helper.js`.
