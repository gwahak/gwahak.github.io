(() => {
  // -------------------- Config --------------------
  const GRID_N = 11;
  const CELL = 48;
  const MARGIN = 48;
  const PANEL_W = 260;
  const WIDTH = MARGIN * 2 + GRID_N * CELL + PANEL_W;
  const HEIGHT = MARGIN * 2 + GRID_N * CELL;
  const FPS = 60;

  // Player IDs: 1..6, Quasar: 7, Empty: 0
  const PLAYER_FILL = {
    1: [245, 245, 245],   // White
    2: [220, 40, 40],     // Red
    3: [40, 100, 220],    // Blue
    4: [245, 140, 20],    // Orange
    5: [240, 200, 0],     // Yellow/Gold
    6: [30, 160, 80],     // Green
    7: [180, 180, 180],   // Quasar
  };
  const PLAYER_TEXT = {
    1: [20, 20, 20],
    2: [250, 250, 250],
    3: [250, 250, 250],
    4: [20, 20, 20],
    5: [20, 20, 20],
    6: [250, 250, 250],
    7: [20, 20, 20],
  };
  const PLAYER_NAME = {
    1: "White",
    2: "Red",
    3: "Blue",
    4: "Orange",
    5: "Yellow",
    6: "Green",
    7: "Quasar",
  };

  // Matches original: [0,6,6,4,3,2,2] for 0..6 players (we use 2..6)
  const QUASARS_BY_PLAYERS = [0, 6, 6, 4, 3, 2, 2];

  const BG = [250, 252, 255];
  const GRID = [40, 40, 40];
  const LBL = [60, 60, 60];
  const PANEL_BG = [245, 247, 250];
  const WIN_CLR = [10, 120, 40];
  const ERR_CLR = [160, 30, 30];

  // -------------------- Canvas --------------------
  const canvas = document.getElementById("game");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  // Prevent context menu on right click
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // -------------------- Helpers --------------------
  const rgb = (arr) => `rgb(${arr[0]},${arr[1]},${arr[2]})`;

  function gridRect(i, j) {
    const x = MARGIN + i * CELL;
    const y = MARGIN + j * CELL;
    return { x, y, w: CELL, h: CELL };
  }

  function cellCenter(i, j) {
    const r = gridRect(i, j);
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  }

  function colrowFromPos(x, y) {
    const gx0 = MARGIN, gy0 = MARGIN;
    const gx1 = MARGIN + GRID_N * CELL, gy1 = MARGIN + GRID_N * CELL;
    if (!(gx0 <= x && x < gx1 && gy0 <= y && y < gy1)) return null;
    const i = Math.floor((x - MARGIN) / CELL);
    const j = Math.floor((y - MARGIN) / CELL);
    return { i, j };
  }

  function drawGrid() {
    // grid lines
    ctx.strokeStyle = rgb(GRID);
    ctx.lineWidth = 1;
    for (let k = 0; k <= GRID_N; k++) {
      // vertical
      const x = MARGIN + k * CELL;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN);
      ctx.lineTo(x, MARGIN + GRID_N * CELL);
      ctx.stroke();
      // horizontal
      const y = MARGIN + k * CELL;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(MARGIN + GRID_N * CELL, y);
      ctx.stroke();
    }

    // axis labels A..K and 1..11
    ctx.fillStyle = rgb(LBL);
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    for (let i = 0; i < GRID_N; i++) {
      const ch = String.fromCharCode("A".charCodeAt(0) + i);
      const tx = MARGIN + i * CELL + CELL / 2;
      const ty = MARGIN - 20;
      drawTextCentered(ch, tx, ty);
    }
    for (let j = 0; j < GRID_N; j++) {
      const t = String(j + 1);
      const tx = MARGIN - 22;
      const ty = MARGIN + j * CELL + CELL / 2 + 6;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(t, tx, ty);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  function drawTextCentered(text, x, y) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawStone(i, j, label, ownerId) {
    const { cx, cy } = cellCenter(i, j);
    const radius = CELL / 2 - 6;

    // fill
    ctx.fillStyle = rgb(PLAYER_FILL[ownerId]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // outline
    ctx.strokeStyle = "rgb(20,20,20)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // label
    ctx.fillStyle = rgb(PLAYER_TEXT[ownerId]);
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    drawTextCentered(label, cx, cy);
  }

  function count4gon(pan, n) {
    // Count axis-aligned (original logic) squares whose 4 vertices are 'n'
    let count = 0;
    for (let gg = 1; gg <= 10; gg++) {
      for (let hh = 0; hh < gg; hh++) {
        for (let ii = 0; ii < 11 - gg; ii++) {
          for (let jj = 0; jj < 11 - gg; jj++) {
            // same indexing structure as python version
            try {
              if (
                pan[ii][jj + hh] === n &&
                pan[ii + hh][jj + gg] === n &&
                pan[ii + gg - hh][jj] === n &&
                pan[ii + gg][jj + gg - hh] === n
              ) {
                count += 1;
              }
            } catch {
              // bounds safety (should not happen)
            }
          }
        }
      }
    }
    return count;
  }

  function initBoard() {
    // pan[x][y] (x: column, y: row)
    const pan = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(0));
    // Four corners are Quasar(7)
    pan[0][0] = 7;
    pan[GRID_N - 1][0] = 7;
    pan[0][GRID_N - 1] = 7;
    pan[GRID_N - 1][GRID_N - 1] = 7;
    return pan;
  }

  function wrapText(text, maxW, font) {
    ctx.font = font;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = (cur ? cur + " " : "") + w;
      if (ctx.measureText(test).width <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // -------------------- State --------------------
  let pan = initBoard();
  let usedquasars = Array(8).fill(0); // 1..6
  let moveNo = 0;
  let placedMoves = 4; // four corners already
  let players = null;
  let pid = 1;

  const state = {
    mode: "menu", // 'menu' | 'playing' | 'gameover'
    message: "",
    msgIsError: false,
    winner: null,
    menuButtons: [],
    hover: null,
    quasarMode: false,
    quasarButton: null,
    restartButton: null,
    newGameButton: null,
  };

  // Track move labels (number or 'Q') per cell
  // key: "i,j" -> { label, owner }
  const moveLabels = new Map();

  function keyIJ(i, j) { return `${i},${j}`; }

  // Seed corner labels
  for (const [i, j] of [[0,0],[GRID_N-1,0],[0,GRID_N-1],[GRID_N-1,GRID_N-1]]) {
    moveLabels.set(keyIJ(i, j), { label: "Q", owner: 7 });
  }

  function resetGameForPlayers(p) {
    pan = initBoard();
    usedquasars = Array(8).fill(0);
    moveNo = 0;
    placedMoves = 4;
    players = p;
    pid = 1;
    state.mode = "playing";
    state.message = `Starting QUOD for ${players} players.`;
    state.msgIsError = false;
    state.winner = null;

    moveLabels.clear();
    for (const [i, j] of [[0,0],[GRID_N-1,0],[0,GRID_N-1],[GRID_N-1,GRID_N-1]]) {
      moveLabels.set(keyIJ(i, j), { label: "Q", owner: 7 });
    }
  }
  function goToMenu() {
  // 게임 데이터를 초기화하고 메뉴로
  pan = initBoard();
  usedquasars = Array(8).fill(0);
  moveNo = 0;
  placedMoves = 4;
  players = null;
  pid = 1;

  state.mode = "menu";
  state.message = "";
  state.msgIsError = false;
  state.winner = null;
  state.hover = null;
  state.quasarMode = false;

  moveLabels.clear();
  for (const [i, j] of [[0,0],[GRID_N-1,0],[0,GRID_N-1],[GRID_N-1,GRID_N-1]]) {
    moveLabels.set(keyIJ(i, j), { label: "Q", owner: 7 });
  }
}
  // -------------------- Panel / Menu --------------------
  function drawPanel() {
    const panelX = MARGIN + GRID_N * CELL;
    ctx.fillStyle = rgb(PANEL_BG);
    ctx.fillRect(panelX, 0, PANEL_W, HEIGHT);

    const x0 = panelX + 16;
    let y = MARGIN;

    ctx.fillStyle = "rgb(30,30,30)";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("QUOD Multiplayer", x0, y);
    y += 32;

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgb(50,50,60)";

    if (state.mode === "menu") {
      ctx.fillText("Select number of players:", x0, y); y += 22;
      ctx.fillText("2 to 6 players are supported.", x0, y); y += 18;
      y += 10;

      state.menuButtons = [];
      for (let p = 2; p <= 6; p++) {
        const btn = { x: x0, y, w: 140, h: 36, p };
        // button
        ctx.fillStyle = "rgb(230,234,240)";
        roundRect(btn.x, btn.y, btn.w, btn.h, 10, true, false);
        ctx.strokeStyle = "rgb(180,185,195)";
        roundRect(btn.x, btn.y, btn.w, btn.h, 10, false, true);

        ctx.fillStyle = "rgb(30,30,40)";
        ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawTextCentered(`${p} Players`, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);

        state.menuButtons.push(btn);
        y += 48;
      }
      return;
    }

    // playing / gameover
    const qcap = QUASARS_BY_PLAYERS[players];
    const used = usedquasars[pid];

    const lines = [
      `Players: ${players}`,
      `Turn: ${PLAYER_NAME[pid]}`,
      `Quasars: ${used}/${qcap} used`,
      "",
      "Controls:",
      "- Left click: place stone",
      "- Right click: place Quasar",
      "",
      "Quasar does NOT consume the turn.",
    ];

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgb(50,50,60)";
    for (const line of lines) {
      ctx.fillText(line, x0, y);
      y += 22;
    }
// --- Quasar toggle button (mobile-friendly) ---
const btnX = x0;
const btnY = y + 6;
const btnW = 210;
const btnH = 36;

state.quasarButton = { x: btnX, y: btnY, w: btnW, h: btnH };

ctx.fillStyle = state.quasarMode ? "rgb(255,235,200)" : "rgb(230,234,240)";
roundRect(btnX, btnY, btnW, btnH, 10, true, false);
ctx.strokeStyle = state.quasarMode ? "rgb(180,120,60)" : "rgb(180,185,195)";
roundRect(btnX, btnY, btnW, btnH, 10, false, true);

ctx.fillStyle = "rgb(30,30,40)";
ctx.font = "bold 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
drawTextCentered(
  `Quasar Mode: ${state.quasarMode ? "ON" : "OFF"}`,
  btnX + btnW / 2,
  btnY + btnH / 2 + 1
);

// hint
ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
ctx.fillStyle = "rgb(90,90,100)";
ctx.fillText("Tap board to place Quasar when ON.", x0, btnY + btnH + 18);

// --- Row of two buttons: Restart / New Game ---
const rowY = btnY + btnH + 34;
const gap = 10;
const smallW = Math.floor((btnW - gap) / 2);
const smallH = 32;

const rBtn = { x: x0, y: rowY, w: smallW, h: smallH };
const nBtn = { x: x0 + smallW + gap, y: rowY, w: smallW, h: smallH };

state.restartButton = rBtn;
state.newGameButton = nBtn;

// Restart button
ctx.fillStyle = "rgb(230,234,240)";
roundRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, 10, true, false);
ctx.strokeStyle = "rgb(180,185,195)";
roundRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, 10, false, true);
ctx.fillStyle = "rgb(30,30,40)";
ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
drawTextCentered("Restart", rBtn.x + rBtn.w/2, rBtn.y + rBtn.h/2 + 1);

// New Game button
ctx.fillStyle = "rgb(230,234,240)";
roundRect(nBtn.x, nBtn.y, nBtn.w, nBtn.h, 10, true, false);
ctx.strokeStyle = "rgb(180,185,195)";
roundRect(nBtn.x, nBtn.y, nBtn.w, nBtn.h, 10, false, true);
ctx.fillStyle = "rgb(30,30,40)";
ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
drawTextCentered("New Game", nBtn.x + nBtn.w/2, nBtn.y + nBtn.h/2 + 1);

// 메시지 시작점을 밀어주기
y = rowY + smallH + 16;


    // Quasar status list
    drawQuasarStatus(x0, y);
    // Gameover block
    if (state.mode === "gameover") {
      y += 10;
      ctx.fillStyle = rgb(WIN_CLR);
      ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Game Over", x0+120, y);
      y += 28;

      ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      if (state.winner) {
        ctx.fillStyle = "rgb(20,100,30)";
        ctx.fillText(`Winner: ${PLAYER_NAME[state.winner]}`, x0+120, y);
      } else {
        ctx.fillStyle = "rgb(80,80,80)";
        ctx.fillText("No winner.", x0, y);
      }
    }

  }

  function drawQuasarStatus(x0, y0) {
    if (players == null) return;
    const qcap = QUASARS_BY_PLAYERS[players];
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgb(40,40,40)";
    ctx.fillText("Quasars left:", x0, y0);

    let y = y0 + 22;
    for (let p = 1; p <= players; p++) {
      const remain = qcap - usedquasars[p];
      // small colored dot
      const dotX = x0 + 8, dotY = y + 8;
      ctx.fillStyle = rgb(PLAYER_FILL[p]);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fill();
      if (p === 1) {
        ctx.strokeStyle = "rgb(20,20,20)";
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgb(50,50,60)";
      ctx.fillText(`${PLAYER_NAME[p]}: ${remain}/${qcap}`, x0 + 20, y + 2);
      y += 22;
    }
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // -------------------- Input --------------------
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Menu click
  if (state.mode === "menu" && e.button === 0) {
    for (const btn of state.menuButtons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        resetGameForPlayers(btn.p);
        return;
      }
    }
    return;
  }

  // Ignore clicks when not playing
  if (state.mode !== "playing") return;

  // Click panel button? (Quasar toggle)
  if (state.quasarButton && e.button === 0) {
    const b = state.quasarButton;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      state.quasarMode = !state.quasarMode;
      state.message = state.quasarMode ? "Quasar mode ON." : "Quasar mode OFF.";
      state.msgIsError = false;
      return;
    }
  }
// Restart (same player count)
if (state.restartButton && e.button === 0) {
  const b = state.restartButton;
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    if (players != null) resetGameForPlayers(players);
    return;
  }
}

// New Game (back to menu)
if (state.newGameButton && e.button === 0) {
  const b = state.newGameButton;
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    goToMenu();
    return;
  }
}


  // Board click
  const cell = colrowFromPos(x, y);
  if (!cell) return;
  const { i, j } = cell;

  // Occupied?
  if (pan[i][j] !== 0) {
    state.message = "That cell is already occupied.";
    state.msgIsError = true;
    return;
  }

  // Determine move type
  const wantQuasar = (e.button === 2) || state.quasarMode;

  if (wantQuasar) {
    // Quasar placement
    const limit = QUASARS_BY_PLAYERS[players];
    if (usedquasars[pid] >= limit) {
      state.message = "You have already used all your quasars.";
      state.msgIsError = true;
      return;
    }
    pan[i][j] = 7;
    usedquasars[pid] += 1;
    moveLabels.set(keyIJ(i, j), { label: "Q", owner: 7 });
    placedMoves += 1;

    state.message = "Quasar placed. Your turn continues.";
    state.msgIsError = false;

    // Safety: auto turn off after placing
    state.quasarMode = false;
    return;
  }

  // Normal stone placement
  pan[i][j] = pid;
  moveNo += 1;
  moveLabels.set(keyIJ(i, j), { label: String(moveNo), owner: pid });
  placedMoves += 1;

  // Win check
  if (count4gon(pan, pid) >= 1) {
    state.mode = "gameover";
    state.winner = pid;
    state.message = `${PLAYER_NAME[pid]} has formed a square and wins!`;
    state.msgIsError = false;
    return;
  }

  // Advance turn
  pid = (pid % players) + 1;
  state.message = "";
  state.msgIsError = false;

  // Board full
  if (placedMoves >= GRID_N * GRID_N) {
    state.mode = "gameover";
    state.winner = null;
    state.message = "Board is full. Game over.";
    state.msgIsError = false;
    return;
  }
});

  // -------------------- Render Loop --------------------
  function render() {
    // background
    ctx.fillStyle = rgb(BG);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // grid & labels
    drawGrid();

    // hover highlight
    if (state.mode === "playing" && state.hover) {
      const { i, j } = state.hover;
      if (0 <= i && i < GRID_N && 0 <= j && j < GRID_N) {
        const r = gridRect(i, j);
        ctx.strokeStyle = "rgb(210,225,250)";
        ctx.lineWidth = 3;
        roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8, false, true);
        ctx.lineWidth = 1;
      }
    }

    // stones
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const v = pan[i][j];
        if (v !== 0) {
          const key = keyIJ(i, j);
          const info = moveLabels.get(key);
          if (info) {
            drawStone(i, j, info.label, info.owner);
          } else {
            // fallback
            drawStone(i, j, v === 7 ? "Q" : "", v);
          }
        }
      }
    }

    // corner frames
    ctx.strokeStyle = "rgb(80,80,80)";
    for (const [i, j] of [[0,0],[GRID_N-1,0],[0,GRID_N-1],[GRID_N-1,GRID_N-1]]) {
      const r = gridRect(i, j);
      roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8, false, true);
    }

    // panel
    drawPanel();

    requestAnimationFrame(render);
  }

  // Start in menu
  render();
})();
