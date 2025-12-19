(() => {
  // -------------------- Config --------------------
  const GRID_N = 7;
  const CELL = 80;
  const MARGIN = 40;
  const PANEL_W = 400;

  const WIDTH = MARGIN*2 + GRID_N*CELL + PANEL_W;
  const HEIGHT = MARGIN*2 + GRID_N*CELL;

  const EMPTY = 0;
  const P1 = 1; // Red
  const P2 = 2; // Blue
  const MAX_PIECES_PER_PLAYER = 24;

  const DIR8 = [
    [-1,-1], [-1,0], [-1,1],
    [ 0,-1],         [ 0,1],
    [ 1,-1], [ 1,0], [ 1,1]
  ];

  // Colors (RGB -> CSS)
  const C = {
    BG: "rgb(25,27,34)",
    GRID: "rgb(60,64,72)",
    WHITE: "rgb(235,235,235)",
    RED: "rgb(220,60,60)",
    BLUE: "rgb(60,120,220)",
    GREEN: "rgb(60,200,120)",
    VIOLET: "rgb(170,120,220)",
    YELLOW: "rgb(240,200,60)",
    GREY: "rgb(180,180,180)",
  };

  // -------------------- Canvas setup --------------------
  const canvas = document.getElementById("game");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  // Text
  const fontMain = "26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontSmall = "20px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // -------------------- Utils --------------------
  function inside(r,c){ return (0<=r && r<GRID_N && 0<=c && c<GRID_N); }

  function neighbors8(r,c){
    const out = [];
    for(const [dr,dc] of DIR8){
      const rr=r+dr, cc=c+dc;
      if(inside(rr,cc)) out.push([rr,cc]);
    }
    return out;
  }

  function rcFromMouse(x,y){
    const left = MARGIN, top = MARGIN;
    if(!(left <= x && x < left + GRID_N*CELL && top <= y && y < top + GRID_N*CELL)) return null;
    const c = Math.floor((x-left)/CELL);
    const r = Math.floor((y-top)/CELL);
    return [r,c];
  }

  function boardFull(gs){
    for(let r=0;r<GRID_N;r++){
      for(let c=0;c<GRID_N;c++){
        if(gs.board[r][c] === EMPTY) return false;
      }
    }
    return true;
  }

  function checkAndSetDraw(gs){
    if(gs.piecesLeft[P1]===0 && gs.piecesLeft[P2]===0){
      gs.gameOver=true; gs.winner=0; return true;
    }
    if(boardFull(gs)){
      gs.gameOver=true; gs.winner=0; return true;
    }
    return false;
  }

  // -------------------- Rules --------------------
  function hasFourInARow(board, r, c, pid){
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for(const [dr,dc] of dirs){
      let cnt=1;
      // forward
      let rr=r+dr, cc=c+dc;
      while(inside(rr,cc) && board[rr][cc]===pid){ cnt++; rr+=dr; cc+=dc; }
      // backward
      rr=r-dr; cc=c-dc;
      while(inside(rr,cc) && board[rr][cc]===pid){ cnt++; rr-=dr; cc-=dc; }
      if(cnt>=4) return true;
    }
    return false;
  }

  function computeValidMoves(gs, pid){
    const opp = gs.opponent(pid);
    const empties = [];
    for(let r=0;r<GRID_N;r++) for(let c=0;c<GRID_N;c++) if(gs.board[r][c]===EMPTY) empties.push([r,c]);

    if(gs.lastMove === null){
      return [new Set(empties.map(rc=>rc.join(","))), "free_opening"];
    }

    const baseAnchor = gs.lastMove;
    const baseMoves = new Set();
    for(const [rr,cc] of neighbors8(baseAnchor[0], baseAnchor[1])){
      if(gs.board[rr][cc]===EMPTY) baseMoves.add(`${rr},${cc}`);
    }

    let selectedMoves = new Set();
    if(gs.selectedAnchor !== null){
      const [ar,ac] = gs.selectedAnchor;
      if(inside(ar,ac) && gs.board[ar][ac]===opp){
        for(const [rr,cc] of neighbors8(ar,ac)){
          if(gs.board[rr][cc]===EMPTY) selectedMoves.add(`${rr},${cc}`);
        }
      }else{
        gs.selectedAnchor = null;
      }
    }

    if(baseMoves.size>0 || selectedMoves.size>0){
      return [ (selectedMoves.size>0 ? selectedMoves : baseMoves), "anchor_ok" ];
    }

    const anyAnchorMoves = new Set();
    for(let r=0;r<GRID_N;r++){
      for(let c=0;c<GRID_N;c++){
        if(gs.board[r][c]===opp){
          for(const [rr,cc] of neighbors8(r,c)){
            if(gs.board[rr][cc]===EMPTY) anyAnchorMoves.add(`${rr},${cc}`);
          }
        }
      }
    }
    if(anyAnchorMoves.size>0) return [anyAnchorMoves, "any_anchor"];

    if(gs.emergencyAnywhere){
      const allEmpty = new Set(empties.map(rc=>rc.join(",")));
      return [allEmpty, "emergency_anywhere"];
    }
    return [new Set(), "no_moves_any_anchor_all_blocked"];
  }

  // -------------------- GameState --------------------
  class GameState{
    constructor(){
      this.board = Array.from({length:GRID_N}, ()=>Array(GRID_N).fill(EMPTY));
      this.current = P1;
      this.turn = 0;
      this.lastMove = null;
      this.piecesLeft = { [P1]: MAX_PIECES_PER_PLAYER, [P2]: MAX_PIECES_PER_PLAYER };
      this.gameOver = false;
      this.winner = null; // 0 draw, 1/2 winner
      this.emergencyAnywhere = true;
      this.selectedAnchor = null;
      this.passStreak = 0;
      this.offerEmergency = false;
      this.offerReason = "";
    }
    reset(){ Object.assign(this, new GameState()); }
    opponent(pid){ return pid===P1 ? P2 : P1; }

    place(r,c){
      if(this.gameOver || this.offerEmergency) return false;
      if(!inside(r,c) || this.board[r][c]!==EMPTY) return false;
      if(this.piecesLeft[this.current] <= 0) return false;

      const [valids, _reason] = computeValidMoves(this, this.current);
      if(!valids.has(`${r},${c}`)) return false;

      this.board[r][c] = this.current;
      this.piecesLeft[this.current] -= 1;
      this.lastMove = [r,c];
      this.turn += 1;

      if(hasFourInARow(this.board, r, c, this.current)){
        this.gameOver=true; this.winner=this.current; return true;
      }

      this.passStreak = 0;

      if(checkAndSetDraw(this)) return true;

      this.selectedAnchor = null;
      this.current = this.opponent(this.current);

      this.handlePassIfNeeded();
      return true;
    }

    handlePassIfNeeded(){
      if(this.gameOver) return;

      let guard=0;
      while(!this.gameOver && !this.offerEmergency && guard<8){
        guard++;

        if(checkAndSetDraw(this)) return;

        if(this.piecesLeft[this.current] <= 0){
          if(this.passStreak===1 && !this.emergencyAnywhere){
            this.offerEmergency=true; this.offerReason="two_pass_draw_via_zero_piece"; return;
          }
          this.passStreak++;
          if(this.passStreak>=2){ this.gameOver=true; this.winner=0; return; }
          this.current = this.opponent(this.current);
          continue;
        }

        const [valids, reason] = computeValidMoves(this, this.current);
        if(valids.size===0 && reason==="no_moves_any_anchor_all_blocked" && !this.emergencyAnywhere){
          if(this.passStreak===1){
            this.offerEmergency=true; this.offerReason="two_pass_draw_via_blocked"; return;
          }
          this.passStreak++;
          if(this.passStreak>=2){ this.gameOver=true; this.winner=0; return; }
          this.current = this.opponent(this.current);
          continue;
        }
        return;
      }

      if(!this.gameOver && boardFull(this)){
        this.gameOver=true; this.winner=0;
      }
    }
  }

  const gs = new GameState();

  // -------------------- Render --------------------
  function draw(){
    // background
    ctx.fillStyle = C.BG;
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    const left = MARGIN, top = MARGIN;

    // grid
    ctx.strokeStyle = C.GRID;
    ctx.lineWidth = 2;
    for(let i=0;i<=GRID_N;i++){
      const y = top + i*CELL;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + GRID_N*CELL, y); ctx.stroke();
      const x = left + i*CELL;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + GRID_N*CELL); ctx.stroke();
    }

    // stones
    for(let r=0;r<GRID_N;r++){
      for(let c=0;c<GRID_N;c++){
        const pid = gs.board[r][c];
        if(pid!==EMPTY){
          const color = (pid===P1 ? C.RED : C.BLUE);
          const cx = left + c*CELL + CELL/2;
          const cy = top + r*CELL + CELL/2;
          const w = CELL-16, h = CELL-16;
          const x = cx - w/2, y = cy - h/2;

          roundRect(ctx, x, y, w, h, 10, color, C.WHITE);
        }
      }
    }

    // valid dots (same rules as python)
    if(!gs.gameOver && !gs.offerEmergency && gs.piecesLeft[gs.current] > 0){
      const [valids, _reason] = computeValidMoves(gs, gs.current);

      // selected anchor highlight
      if(gs.selectedAnchor){
        const [ar,ac] = gs.selectedAnchor;
        const ax = left + ac*CELL + CELL/2;
        const ay = top + ar*CELL + CELL/2;
        circle(ax, ay, 10, C.VIOLET, C.WHITE);
      }

      for(const key of valids){
        const [r,c] = key.split(",").map(Number);
        const cx = left + c*CELL + CELL/2;
        const cy = top + r*CELL + CELL/2;
        const dot = (gs.selectedAnchor ? C.VIOLET : C.GREEN);
        circle(cx, cy, 8, dot, C.WHITE);
      }
    }

    // panel text (영문으로 바꾸고 싶으면 여기만 바꾸면 됨)
    const panelX = left + GRID_N*CELL + 20;
    ctx.fillStyle = C.WHITE;
    ctx.font = fontMain;
    ctx.fillText("4Mation (7x7 · 4-in-a-row)", panelX, top+24);

    ctx.font = fontMain;
    ctx.fillStyle = (gs.current===P1 ? C.RED : C.BLUE);
    ctx.fillText(`Turn: ${gs.current===P1 ? "Red (R)" : "Blue (B)"}`, panelX, top+64);

    ctx.font = fontSmall;
    ctx.fillStyle = C.WHITE;
    ctx.fillText(`Red pieces left: ${gs.piecesLeft[P1]}`, panelX, top+104);
    ctx.fillText(`Blue pieces left: ${gs.piecesLeft[P2]}`, panelX, top+129);

    ctx.fillStyle = gs.emergencyAnywhere ? C.YELLOW : C.GREY;
    ctx.fillText(`[E] Emergency anywhere: ${gs.emergencyAnywhere ? "ON" : "OFF"}`, panelX, top+169);

    ctx.fillStyle = C.WHITE;
    ctx.fillText("If blocked: click an opponent stone", panelX, top+209);
    ctx.fillText("then place near it.", panelX, top+234);

    ctx.fillText("[Mouse] place / click opp stone = anchor", panelX, top+274);
    ctx.fillText("[R] reset, [E] toggle, [Esc] quit", panelX, top+299);
    ctx.fillText("[Enter] accept draw (during offer)", panelX, top+324);

    // status
    const ymsg = top+360;
    ctx.font = fontMain;
    if(gs.gameOver){
      if(gs.winner===0){
        ctx.fillStyle = C.WHITE; ctx.fillText("Draw!", panelX, ymsg);
      }else{
        ctx.fillStyle = (gs.winner===P1?C.RED:C.BLUE);
        ctx.fillText(gs.winner===P1 ? "Red wins!" : "Blue wins!", panelX, ymsg);
      }
    }

    // offer overlay
    if(gs.offerEmergency && !gs.gameOver){
      drawOverlay();
    }
  }

  function roundRect(ctx, x, y, w, h, r, fillStyle, strokeStyle){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function circle(x,y,rad,fill,stroke){
    ctx.beginPath();
    ctx.arc(x,y,rad,0,Math.PI*2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawOverlay(){
    // dark layer
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    // box
    const boxW=700, boxH=170;
    const x=(WIDTH-boxW)/2, y=(HEIGHT-boxH)/2;
    roundRect(ctx, x, y, boxW, boxH, 14, "rgb(40,44,52)", "rgb(220,220,220)");

    ctx.font = fontMain;
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText("Two consecutive passes will end the game as a draw.", x+40, y+48);

    ctx.font = fontSmall;
    ctx.fillText("Press [E] to turn Emergency Anywhere ON and continue.", x+40, y+92);
    ctx.fillStyle = "rgb(200,200,200)";
    ctx.fillText("Press [Enter] to accept a draw.", x+40, y+122);
  }

  // -------------------- Input --------------------
  canvas.addEventListener("mousedown", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    if(gs.gameOver || gs.offerEmergency) return;

    const rc = rcFromMouse(x,y);
    if(!rc) return;
    const [r,c] = rc;

    // click opponent stone = select anchor
    if(gs.board[r][c] === gs.opponent(gs.current)){
      gs.selectedAnchor = [r,c];
      return;
    }
    // else try place
    gs.place(r,c);
  });

  window.addEventListener("keydown", (ev) => {
    const k = ev.key;

    if(k === "Escape"){ /* optional: navigate back? */ return; }

    if(k === "r" || k === "R"){
      gs.reset();
      return;
    }

    // offer mode keys
    if(gs.offerEmergency){
      if(k === "e" || k === "E"){
        gs.emergencyAnywhere = true;
        gs.offerEmergency = false;
        gs.offerReason = "";
        gs.handlePassIfNeeded();
      }else if(k === "Enter"){
        gs.gameOver = true;
        gs.winner = 0;
        gs.offerEmergency = false;
        gs.offerReason = "";
      }
      return;
    }

    if(k === "e" || k === "E"){
      gs.emergencyAnywhere = !gs.emergencyAnywhere;
      gs.handlePassIfNeeded();
    }
  });

  // -------------------- Loop --------------------
  function loop(){
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();
