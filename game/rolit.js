(() => {
  // -----------------------------
  // Config (match your pygame)
  // -----------------------------
  const BOARD_N = 8;
  const CELL = 80;
  const MARGIN = 40;
  const WIDTH = BOARD_N * CELL + MARGIN * 2;
  const HEIGHT = WIDTH;
  const FPS = 60;

  const EMPTY = 0;
  const RED = 1, YELLOW = 2, GREEN = 3, BLUE = 4;

  const ALL_COLORS = new Set([RED, YELLOW, GREEN, BLUE]);
  const COLOR_ORDER = [RED, YELLOW, GREEN, BLUE];
  const COLOR_NAME = { [RED]:"Red", [YELLOW]:"Yellow", [GREEN]:"Green", [BLUE]:"Blue" };
  const STONE_RGB = {
    [RED]:   [220, 20, 60],
    [YELLOW]:[255, 215, 0],
    [GREEN]: [34, 139, 34],
    [BLUE]:  [30, 144, 255],
  };

  const BG_COLOR = [240,240,240];
  const GRID_COLOR = [90,90,90];
  const HINT_COLOR = [148,0,211];        // violet (legal with flips)
  const HINT_ANY_COLOR = [160,160,160];  // gray (anywhere/no-flip)
  const LASTMOVE_COLOR = [255,215,0];

  const DIRS = [
    [-1,-1], [-1,0], [-1,1],
    [ 0,-1],         [ 0,1],
    [ 1,-1], [ 1,0], [ 1,1]
  ];

  // -----------------------------
  // Canvas setup
  // -----------------------------
  const canvas = document.getElementById("game");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";

  function rgb(arr){ return `rgb(${arr[0]},${arr[1]},${arr[2]})`; }

  // -----------------------------
  // Helpers
  // -----------------------------
  function toScreen(r, c){
    return [MARGIN + c * CELL, MARGIN + r * CELL];
  }

  function fromMouse(mx, my){
    if (mx < MARGIN || my < MARGIN) return null;
    const c = Math.floor((mx - MARGIN) / CELL);
    const r = Math.floor((my - MARGIN) / CELL);
    if (0 <= r && r < BOARD_N && 0 <= c && c < BOARD_N) return [r, c];
    return null;
  }

  function inside(r, c){
    return 0 <= r && r < BOARD_N && 0 <= c && c < BOARD_N;
  }

  function initBoard(){
    const board = Array.from({length:BOARD_N}, () => Array(BOARD_N).fill(EMPTY));
    const mid = BOARD_N / 2;
    board[mid-1][mid-1] = RED;
    board[mid-1][mid]   = YELLOW;
    board[mid][mid-1]   = BLUE;
    board[mid][mid]     = GREEN;
    return board;
  }

  function anywhereMoves(board){
    // dict: key "r,c" -> []
    const moves = new Map();
    for (let r=0;r<BOARD_N;r++){
      for (let c=0;c<BOARD_N;c++){
        if (board[r][c] === EMPTY) moves.set(`${r},${c}`, []);
      }
    }
    return moves;
  }

  // -----------------------------
  // UI Button (simple)
  // -----------------------------
  class Button {
    constructor(x, y, w, h, label, baseColor, textColor=[0,0,0], toggle=false, onColor=null){
      this.x=x; this.y=y; this.w=w; this.h=h;
      this.label=label;
      this.baseColor=baseColor;
      this.onColor=onColor ?? baseColor;
      this.textColor=textColor;
      this.toggle=toggle;
      this.isOn=false;
      this.enabled=true;
    }
    contains(mx,my){
      return mx>=this.x && mx<=this.x+this.w && my>=this.y && my<=this.y+this.h;
    }
    draw(ctx, fontPx=26, round=8){
      let color = (this.toggle && this.isOn) ? this.onColor : this.baseColor;
      if (!this.enabled) color = color.map(v => Math.floor(v*0.6));

      // rounded rect
      ctx.fillStyle = rgb(color);
      roundRect(ctx, this.x, this.y, this.w, this.h, round, true, false);
      ctx.strokeStyle = "rgb(30,30,30)";
      ctx.lineWidth = 2;
      roundRect(ctx, this.x, this.y, this.w, this.h, round, false, true);

      ctx.fillStyle = rgb(this.textColor);
      ctx.font = `${fontPx}px Arial`;
      const tw = ctx.measureText(this.label).width;
      const tx = this.x + (this.w - tw)/2;
      const ty = this.y + (this.h - fontPx)/2 - 2;
      ctx.fillText(this.label, tx, ty);
    }
    click(){
      if (!this.enabled) return false;
      if (this.toggle) this.isOn = !this.isOn;
      return true;
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // -----------------------------
  // Rolit rules
  // -----------------------------
  function findFlips(board, r, c, player){
    if (!inside(r,c) || board[r][c] !== EMPTY) return [];

    // opponents = all colors except player (even if not active)
    const flipsTotal = [];
    for (const [dr,dc] of DIRS){
      let rr = r+dr, cc = c+dc;
      const line = [];
      if (!inside(rr,cc)) continue;
      const v0 = board[rr][cc];
      if (v0 === EMPTY || v0 === player) continue; // must start with opponent

      // consume opponents
      while (inside(rr,cc)){
        const v = board[rr][cc];
        if (v === EMPTY) { line.length = 0; break; }
        if (v === player) break;
        // opponent
        line.push([rr,cc]);
        rr += dr; cc += dc;
      }
      if (inside(rr,cc) && board[rr][cc] === player && line.length){
        for (const p of line) flipsTotal.push(p);
      }
    }
    return flipsTotal;
  }

  function legalMoves(board, player, anywhereDrop){
    const moves = new Map(); // key "r,c" -> flips[]
    for (let r=0;r<BOARD_N;r++){
      for (let c=0;c<BOARD_N;c++){
        const flips = findFlips(board, r, c, player);
        if (flips.length) moves.set(`${r},${c}`, flips);
      }
    }
    if (anywhereDrop){
      for (let r=0;r<BOARD_N;r++){
        for (let c=0;c<BOARD_N;c++){
          if (board[r][c] === EMPTY){
            const k = `${r},${c}`;
            if (!moves.has(k)) moves.set(k, []);
          }
        }
      }
    }
    return moves;
  }

  function applyMove(board, r, c, player, flips){
    board[r][c] = player;
    for (const [rr,cc] of flips){
      board[rr][cc] = player;
    }
  }

  function boardFull(board){
    for (let r=0;r<BOARD_N;r++){
      for (let c=0;c<BOARD_N;c++){
        if (board[r][c] === EMPTY) return false;
      }
    }
    return true;
  }

  function scoresByColor(board){
    const counts = {[RED]:0,[YELLOW]:0,[GREEN]:0,[BLUE]:0};
    for (let r=0;r<BOARD_N;r++){
      for (let c=0;c<BOARD_N;c++){
        const v = board[r][c];
        if (v in counts) counts[v] += 1;
      }
    }
    return counts;
  }

  function nextActivePlayer(cur, activePlayers){
    const idx = COLOR_ORDER.indexOf(cur);
    for (let k=1;k<=4;k++){
      const nxt = COLOR_ORDER[(idx+k)%4];
      if (activePlayers.has(nxt)) return nxt;
    }
    return cur;
  }

  // -----------------------------
  // States: MENU / GAME
  // -----------------------------
  const STATE_MENU = "menu";
  const STATE_GAME = "game";
  let state = STATE_MENU;

  // Menu buttons
  const font = { normal: 28, small: 22, big: 40 };

  const btn2 = new Button(60, 80, 70, 40, "2", [220,220,220], [0,0,0], true);
  const btn3 = new Button(140, 80, 70, 40, "3", [220,220,220], [0,0,0], true);
  const btn4 = new Button(220, 80, 70, 40, "4", [220,220,220], [0,0,0], true);
  const countButtons = [btn2, btn3, btn4];

  const btnR = new Button(120, 180, 90, 60, "R", STONE_RGB[RED], [255,255,255], true, STONE_RGB[RED]);
  const btnY = new Button(230, 180, 90, 60, "Y", STONE_RGB[YELLOW], [0,0,0], true, STONE_RGB[YELLOW]);
  const btnG = new Button(340, 180, 90, 60, "G", STONE_RGB[GREEN], [255,255,255], true, STONE_RGB[GREEN]);
  const btnB = new Button(450, 180, 90, 60, "B", STONE_RGB[BLUE], [255,255,255], true, STONE_RGB[BLUE]);
  const colorButtons = [
    [RED, btnR], [YELLOW, btnY], [GREEN, btnG], [BLUE, btnB]
  ];

  const btnAny = new Button(120, 270, 300, 44, "Anywhere drop: OFF", [210,210,210], [0,0,0], true);
  const btnStart = new Button(480, 80, 140, 50, "Start", [0,170,90], [255,255,255], false);

  // Defaults: 2 players (R,Y)
  btn2.isOn = true;
  btnR.isOn = true;
  btnY.isOn = true;

  function currentSelectedColors(){
    const s = new Set();
    for (const [col, b] of colorButtons){
      if (b.isOn) s.add(col);
    }
    return s;
  }
  function currentPlayersCount(){
    if (btn2.isOn) return 2;
    if (btn3.isOn) return 3;
    if (btn4.isOn) return 4;
    return null;
  }
  function syncCountExclusive(clicked){
    for (const b of countButtons) b.isOn = (b === clicked);
  }

  // Game variables
  let board = initBoard();
  let activePlayers = new Set([RED, YELLOW]);
  let anywhereDrop = false;
  let current = RED;
  let hints = new Map();
  let msg = "";
  let lastMove = null; // [r,c]
  let gameOver = false;

  function startGameFromMenu(){
    activePlayers = currentSelectedColors();
    anywhereDrop = btnAny.isOn;
    board = initBoard();
    current = COLOR_ORDER.find(p => activePlayers.has(p)) ?? RED;
    hints = legalMoves(board, current, anywhereDrop);
    msg = "";
    if (hints.size === 0){
      hints = anywhereMoves(board);
      msg = "No legal flips: you may place anywhere.";
    }
    lastMove = null;
    gameOver = false;
    state = STATE_GAME;
  }

  function restartAndBackToMenu(){
    state = STATE_MENU;
    msg = "";
    gameOver = false;
  }

  // -----------------------------
  // Drawing
  // -----------------------------
  function drawMenu(){
    ctx.fillStyle = "rgb(245,248,255)";
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    ctx.fillStyle = "rgb(20,20,40)";
    ctx.font = `${font.big}px Arial`;
    ctx.fillText("Rolit Setup", 60, 25);

    ctx.fillStyle = "rgb(30,30,30)";
    ctx.font = `${font.small+4}px Arial`;
    ctx.fillText("Players:", 60, 56);

    for (const b of countButtons) b.draw(ctx, 26);

    ctx.fillText("Select colors (toggle):", 120, 156);
    for (const [, b] of colorButtons) b.draw(ctx, 40);

    btnAny.draw(ctx, 24);
    ctx.fillStyle = "rgb(100,100,120)";
    ctx.font = `${font.small}px Arial`;
    ctx.fillText("ESC: Quit", 60, 330);

    ctx.fillStyle = "rgb(40,120,40)";
    ctx.font = `${font.small}px Arial`;
    ctx.fillText("Start when count = selected", 430, 56);

    // Start enabled condition
    const pc = currentPlayersCount();
    const sel = currentSelectedColors();
    btnStart.enabled = (pc !== null && sel.size === pc);
    btnStart.draw(ctx, 26);

    const selNames = COLOR_ORDER.filter(c => sel.has(c)).map(c => COLOR_NAME[c]).join(", ") || "(none)";
    ctx.fillStyle = "rgb(30,30,30)";
    ctx.font = `${font.small+2}px Arial`;
    ctx.fillText(`Selected: ${selNames}`, 120, 235);
    ctx.fillText(`Count: ${pc ?? "-"} | Selected: ${sel.size}`, 120, 255);
  }

  function drawGame(){
    ctx.fillStyle = rgb(BG_COLOR);
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    // grid & stones
    for (let r=0;r<BOARD_N;r++){
      for (let c=0;c<BOARD_N;c++){
        const [x,y] = toScreen(r,c);
        ctx.strokeStyle = rgb(GRID_COLOR);
        ctx.lineWidth = 1;
        ctx.strokeRect(x,y,CELL,CELL);

        const v = board[r][c];
        if (v !== EMPTY){
          const cx = x + CELL/2, cy = y + CELL/2;
          const radius = CELL/2 - 8;
          const col = STONE_RGB[v] ?? [0,0,0];
          ctx.fillStyle = rgb(col);
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = "rgb(0,0,0)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // last move highlight
    if (lastMove){
      const [r,c] = lastMove;
      const [x,y] = toScreen(r,c);
      ctx.strokeStyle = rgb(LASTMOVE_COLOR);
      ctx.lineWidth = 3;
      ctx.strokeRect(x+3, y+3, CELL-6, CELL-6);
    }

    // hints: violet for flips, gray for no-flip
    for (const [k, flips] of hints.entries()){
      const [r,c] = k.split(",").map(Number);
      const [x,y] = toScreen(r,c);
      const cx = x + CELL/2, cy = y + CELL/2;

      if (flips.length){
        ctx.fillStyle = rgb(HINT_COLOR);
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillStyle = rgb(HINT_ANY_COLOR);
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // HUD
    const counts = scoresByColor(board);
    const scoreText = COLOR_ORDER.filter(col => activePlayers.has(col))
      .map(col => `${COLOR_NAME[col]} ${counts[col]}`)
      .join(" | ");

    ctx.fillStyle = "rgb(10,10,10)";
    ctx.font = `${font.normal}px Arial`;
    ctx.fillText(`Turn: ${COLOR_NAME[current]}   Scores: ${scoreText}`, MARGIN, 8);

    ctx.fillStyle = "rgb(40,40,40)";
    ctx.font = `${font.small}px Arial`;
    ctx.fillText("Click to place.  R: Restart (menu)   ESC: Quit", MARGIN, 34);

    ctx.fillStyle = "rgb(80,80,80)";
    ctx.fillText(`Anywhere-drop option: ${anywhereDrop ? "ON" : "OFF"}`, MARGIN, 56);

    if (msg){
      ctx.fillStyle = "rgb(180,30,30)";
      ctx.font = `${font.normal}px Arial`;
      ctx.fillText(msg, MARGIN, HEIGHT - 40);
    }
  }

  // -----------------------------
  // Input
  // -----------------------------
  function getMouse(e){
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const {x:mx, y:my} = getMouse(e);

    if (state === STATE_MENU){
      // player count (exclusive)
      if (btn2.contains(mx,my)) { btn2.click(); syncCountExclusive(btn2); }
      else if (btn3.contains(mx,my)) { btn3.click(); syncCountExclusive(btn3); }
      else if (btn4.contains(mx,my)) {
        btn4.click(); syncCountExclusive(btn4);
        // 4 players -> auto ON all colors
        if (btn4.isOn){
          for (const [,b] of colorButtons) b.isOn = true;
        }
      }

      // color toggles
      for (const [,b] of colorButtons){
        if (b.contains(mx,my)) b.click();
      }

      // anywhere toggle
      if (btnAny.contains(mx,my)){
        btnAny.click();
        btnAny.label = btnAny.isOn ? "Anywhere drop: ON" : "Anywhere drop: OFF";
      }

      // start
      if (btnStart.contains(mx,my) && btnStart.enabled){
        startGameFromMenu();
      }
      return;
    }

    if (state === STATE_GAME){
      if (gameOver) return;

      const rc = fromMouse(mx,my);
      if (!rc) return;
      const [r,c] = rc;
      const key = `${r},${c}`;
      if (hints.has(key)){
        const flips = hints.get(key);
        applyMove(board, r, c, current, flips);
        lastMove = [r,c];

        // next player
        current = nextActivePlayer(current, activePlayers);

        // recompute hints
        hints = legalMoves(board, current, anywhereDrop);
        msg = "";
        if (hints.size === 0){
          hints = anywhereMoves(board);
          if (hints.size) msg = "No legal flips: you may place anywhere.";
        }

        // end when full
        if (boardFull(board)){
          const counts = scoresByColor(board);
          const activeCounts = {};
          for (const col of activePlayers) activeCounts[col] = counts[col];
          let best = -1;
          for (const col of Object.keys(activeCounts)){
            best = Math.max(best, activeCounts[col]);
          }
          const winners = Object.keys(activeCounts)
            .map(x => parseInt(x,10))
            .filter(col => activeCounts[col] === best)
            .map(col => COLOR_NAME[col]);

          msg = (winners.length === 1)
            ? `Game Over! Winner: ${winners[0]} (score ${best})`
            : `Game Over! Joint winners: ${winners.join(", ")}`;
          gameOver = true;
        }
      } else {
        msg = "Illegal move.";
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      // browsers won't allow window close reliably; just show a note
      // but we keep it simple: go back to menu (or do nothing if you prefer)
      if (state === STATE_GAME) restartAndBackToMenu();
      return;
    }

    if (state === STATE_GAME){
      if (e.key === "r" || e.key === "R"){
        // Restart & re-config (match pygame behavior)
        restartAndBackToMenu();
      }
    } else if (state === STATE_MENU){
      // in menu, ESC already handled above as back-to-menu no-op
    }
  });

  // -----------------------------
  // Main loop
  // -----------------------------
  let lastFrame = 0;
  function tick(t){
    const dt = t - lastFrame;
    if (dt >= 1000 / FPS){
      lastFrame = t;
      if (state === STATE_MENU) drawMenu();
      else drawGame();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
