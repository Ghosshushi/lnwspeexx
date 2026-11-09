# Speexx & Cambridge Turbo Bot — Ultra-Compact Zero-Token Skill

## 1. IRONCLAD RULES
- **Silent 1-Line Output**: Print MAX 1 status line per turn (e.g. `[Unit 32 Ex 1] 100/100 -> Next` or `[Cambridge U1 Ex2] 100% -> Next`) then invoke tools immediately. ZERO explanations!
- **STRICT DB & FILE BLOCK**: NEVER create stray `.js` files in the folder, and NEVER read/open/grep `answers_db.json`, `speexx_profile/`, `__pycache__/`, or `*.mp3`. Query/save ONLY via `http://localhost:8765` (<50ms RAM Cache).
- **Auto Platform Detection (`location.hostname`)**:
  * **Platform A — `speexx.com` (`location.hostname.includes('speexx')`)**:
    - Load `http://localhost:8765/helper.js` and call `await SpeexxHelper.autoSolveFast(answers, { autoNext: true })` — NEVER write custom DOM/DragDrop/Audio JS.
    - **Normal Mode (`isTest === false`)**: Max speed! Auto-fills inputs (`input.value.trim() !== ""`), Drag&Drop (`===` + `PointerEvent`/`DragEvent`), and **Smart Correction Loop** (locks green slots, rotates untried options into red/yellow slots until `100/100`).
    - **Test Mode (`isTest === true` — Level/Final Test, no `Correction`)**: Transcribe ALL audio via `collectAudio()` + `batch_transcribe`, double-check grammar 2x, and confirm `SpeexxHelper.verify().ok === true` before submitting!
    - **Video / Speaking / Tabs / 72-Packet Sweep**: `speedRunVideo()` (16x), `solvePronunciation()`, `getTabStatus().allGreen === true` before `X`, and `scanAllPackets()` until `all72Complete === true` (72/72).
  * **Platform B — `cambridge` (`location.hostname.includes('cambridge')`)**:
    - Load `http://localhost:8765/helper.js` and use `window.CambridgeHelper`:
      - `CambridgeHelper.getActiveDoc()`: Finds the active exercise Document (main `document` or nested `iframe.contentDocument`).
      - `CambridgeHelper.extractActivity()`: Extracts `pageKey`, questions, `inputs`, `selects`, `radioGroups`, `checkboxes`, `dropzones`, `options`, and `.mp3` `audioUrls`.
      - `await CambridgeHelper.fillAndCheck(answers)`: Fills answers, dispatches `input`/`change`/`click` events, clicks `Check`/`Submit`, and auto-saves 100% answers to port 8765.
      - `await CambridgeHelper.fixWrongAnswers(newAnswers)`: Clicks `Try again`, locks green (correct) slots, and fixes only wrong slots until 100%.

## 2. PORT 8765 RAM CACHE API (PowerShell — Shared by Speexx & Cambridge)
```powershell
irm http://localhost:8765 -Method Post -ContentType 'application/json; charset=utf-8' -Body (@{action='get_page';page_key=$k}|ConvertTo-Json -Compress)
irm http://localhost:8765 -Method Post -ContentType 'application/json; charset=utf-8' -Body (@{action='save_page';page_key=$k;answers=$ans}|ConvertTo-Json -Compress)
irm http://localhost:8765 -Method Post -ContentType 'application/json; charset=utf-8' -Body (@{action='batch_transcribe';urls=$urls}|ConvertTo-Json -Compress)
```

## 3. ULTRA-FAST BROWSER LOOP (Auto-Detects Speexx vs Cambridge in 1 Call)
1. **Bootstrap + Continuous Auto-Batch Loop (1 call solves up to 25 exercises/videos/speaking tabs in a row!)**:
   ```javascript
   (async()=>{ if(!window.SpeexxHelper||!window.CambridgeHelper) (0,eval)(await (await fetch('http://localhost:8765/helper.js')).text()); return location.hostname.includes('cambridge') ? await CambridgeHelper.autoSolve(null, { autoNext: true }) : await SpeexxHelper.autoLoop(null); })()
   ```
2. **On `cacheMiss: true` (Only happens on uncached Text-Input exercises)**:
   - **Speexx**: Read `inspect` (note: `inspect.transcripts` already includes Whisper audio transcriptions automatically!), solve `answers`, then call `await SpeexxHelper.autoLoop(answers)` to submit, save to port 8765, and continue auto-looping the rest of the unit!
   - **On `pausedForTest: true` or `blockedTest`**: Stop and notify the user before touching any Level Test / Assessment.
   - **Cambridge**: Read `inspect` from `CambridgeHelper.extractActivity()`, transcribe `audioUrls` via `batch_transcribe` if needed, solve `answers`, then call `await CambridgeHelper.autoSolve(answers, { autoNext: true })`.
