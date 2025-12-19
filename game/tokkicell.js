(() => {
  // ================== Canvas / Layout ==================
  const WIDTH = 1250, HEIGHT = 720;
  const CARD_W = 80, CARD_H = 120;
  const BG = "#007800";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";

  // ================== Deal code (MSVC-style RNG) ==================
  const SUITS_CDHS = ["C","D","H","S"];
  const RANKS_CDHS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  function u32(x){ return x >>> 0; }

  function msvcRandStep(state){
    const next = u32((Math.imul(state, 214013) + 2531011) >>> 0);
    const r = (next >>> 16) & 0x7FFF;
    return [next, r];
  }

  function tokkiDeal(gamenumber, way="vertical"){
    if (way === "vertical") return tokkiDealVertical(gamenumber);
    if (way === "horizontal") return tokkiDealHorizontal(gamenumber);
    throw new Error(`Unknown tokkiDeal way: ${way}`);
  }

  function tokkiShuffle52(gamenumber){
    let state = u32(gamenumber);
    const deck = Array.from({length:52}, (_,i)=>i);
    let wLeft = 52;
    const shuffled = [];
    for (let i=0;i<52;i++){
      let r; [state, r] = msvcRandStep(state);
      const j = r % wLeft;
      shuffled.push(deck[j]);
      wLeft -= 1;
      deck[j] = deck[wLeft];
    }
    return shuffled;
  }

  function tokkiDealVertical(gamenumber){
    // casc[2..9] get 3..10 cards (sum 52)
    const shuffled = tokkiShuffle52(gamenumber);
    const sizes = [0,0,3,4,5,6,7,8,9,10];
    const casc = Array.from({length:10}, ()=>[]);
    let idx = 0;
    for (let ci=0;ci<10;ci++){
      const need = sizes[ci];
      if (need > 0){
        casc[ci] = shuffled.slice(idx, idx+need);
        idx += need;
      }
    }
    return casc;
  }

  function tokkiDealHorizontal(gamenumber){
    // sizes: 8,8,8,7,6,5,4,3,2,1
    // python version: casc[10-sizes[ci]+di].append(shuffled[idx])
    const shuffled = tokkiShuffle52(gamenumber);
    const sizes = [8,8,8,7,6,5,4,3,2,1];
    const casc = Array.from({length:10}, ()=>[]);
    let idx = 0;
    for (let ci=0;ci<10;ci++){
      for (let di=0;di<sizes[ci];di++){
        const target = 10 - sizes[ci] + di;
        casc[target].push(shuffled[idx]);
        idx += 1;
      }
    }
    return casc;
  }

  // ================== Easter deals ==================
  const BLANK = "__";
  const EASTER_DEALS = {
    1: [
      [BLANK],
      [BLANK, BLANK],
      ['KS','QS','JS'],
      ['10S','9S','8S','7S'],
      ['KH','QH','JH','10H','9H'],
      ['8H','7H','KD','QD','JD','10D'],
      ['9D','8D','7D','KC','QC','JC','10C'],
      ['9C','8C','7C','6S','5S','4S','3S','2S'],
      ['AS','6H','5H','4H','3H','2H','AH','6D','5D'],
      ['4D','3D','2D','AD','6C','5C','4C','3C','2C','AC'],
    ],
  };

  // ================== Card model ==================
  const GLYPH_BY_CDHS = { S:"♠", H:"♥", D:"♦", C:"♣" };
  const COLOR_BY_GLYPH = { "♠":"#000", "♣":"#000", "♥":"#c00", "♦":"#c00" };
  const RANK_TO_VAL = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13};

  function isRed(g){ return g === "♥" || g === "♦"; }

  class Card {
    constructor(suitGlyph, rankStr, isJoker=false){
      this.suit = suitGlyph; // null for Joker
      this.rank = rankStr;   // "J" for Joker
      this.isJoker = isJoker;
      this.rect = {x:0,y:0,w:CARD_W,h:CARD_H};
    }
    color(){
      if (this.isJoker) return "#222";
      return COLOR_BY_GLYPH[this.suit];
    }
    val(){
      if (this.isJoker) return -1;
      return RANK_TO_VAL[this.rank];
    }
    draw(ctx){
      const {x,y,w,h} = this.rect;
      if (this.isJoker){
        ctx.fillStyle = "#d2d2d2";
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.strokeRect(x,y,w,h);
        ctx.fillStyle = "#333";
        ctx.font = "20px Arial";
        ctx.fillText("?", x+8, y+6);
        ctx.font = "16px Arial";
        ctx.fillText("JOKER", x+8, y+34);
        return;
      }

      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(x,y,w,h);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x,y,w,h);
      ctx.fillStyle = this.color();
      ctx.font = "20px Arial";
      ctx.fillText(`${this.rank}${this.suit}`, x+6, y+6);
    }
  }

  function jokerCard(){
    return new Card(null, "J", true);
  }

  function parseCardStr(s){
    if (s === "__") return jokerCard();
    const suit = GLYPH_BY_CDHS[s.slice(-1)];
    const rank = s.slice(0,-1);
    return new Card(suit, rank, false);
  }

  function cardFromId(id){
    const suit = SUITS_CDHS[id % 4];
    const rank = RANKS_CDHS[(id / 4) | 0];
    return parseCardStr(`${rank}${suit}`);
  }

  // ================== Geometry helpers ==================
  function rectContains(r, x, y){
    return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
  }
  function foundationRect(i){ return {x:680 + i*110, y:50, w:CARD_W, h:CARD_H}; }
  function cascadeRect(i){ return {x:40 + i*115, y:210, w:CARD_W, h:HEIGHT-230}; }

  // ================== Game ==================
  class TokkiCellGame {
    constructor(dealMode="msvc", dealNumber=1, easterId=1){
      this.dealMode = dealMode;
      this.dealNumber = dealNumber;
      this.easterId = easterId;
      this.dealWay = "horizontal"; // match your default
      this.reset();
    }

    reset(){
      this.foundations = [[],[],[],[]];
      this.cascades = Array.from({length:10}, ()=>[]);

      if (this.dealMode === "easter"){
        const board = EASTER_DEALS[this.easterId];
        this.cascades = board.map(col => col.map(parseCardStr));
      } else {
        const cols = tokkiDeal(this.dealNumber, this.dealWay);
        this.cascades = cols.map(col => col.map(cardFromId));
      }

      // place jokers only in MSVC mode (same as python)
      if (this.dealMode !== "easter"){
        this.cascades[0].push(jokerCard());
        this.cascades[1].push(jokerCard());
        this.cascades[1].push(jokerCard());
      }

      // drag
      this.dragCards = [];
      this.dragFrom = null; // {type:"cascade", i, start}
      this.dragOffset = {x:0,y:0};

      // typing / toast
      this.typing = "";
      this.message = "";
      this.msgTimer = 0;

      // double click
      this.lastClickTime = 0;
      this.lastClickPos = {x:0,y:0};
      this.doubleClickMs = 300;
    }

    toast(text, frames=150){
      this.message = text;
      this.msgTimer = frames;
    }

    // ---------- rules ----------
    canToFoundation(card, fidx){
      if (card.isJoker) return false;
      const pile = this.foundations[fidx];
      if (!pile.length) return card.val() === 1;
      const top = pile[pile.length-1];
      return (!top.isJoker) && card.suit === top.suit && card.val() === top.val()+1;
    }

    canToCascade(card, cidx){
      const pile = this.cascades[cidx];
      if (!pile.length) return true;
      const top = pile[pile.length-1];

      // Joker adjacency always allowed
      if (card.isJoker || top.isJoker) return true;

      if (isRed(card.suit) === isRed(top.suit)) return false;
      return card.val() === top.val()-1;
    }

    movableLimit(){
      // no freecells; only empty-cascade multiplier
      const emptyCas = this.cascades.filter(p => p.length === 0).length;
      return 1 * (2 ** emptyCas);
    }

    isValidRun(cards){
      for (let i=0;i<cards.length-1;i++){
        const a = cards[i], b = cards[i+1];
        if (a.isJoker || b.isJoker) continue;
        if (a.val() !== b.val()+1) return false;
        if (isRed(a.suit) === isRed(b.suit)) return false;
      }
      return true;
    }

    minFoundationRankByColor(wantRed){
      const ranks = [];
      for (const f of this.foundations){
        if (f.length){
          const top = f[f.length-1];
          // jokers can't be in foundation in this ruleset
          if (isRed(top.suit) === wantRed) ranks.push(top.val());
        }
      }
      return ranks.length ? Math.min(...ranks) : 0;
    }

    safeToAutoFoundation(card, fidx){
      if (card.isJoker) return false;
      if (!this.canToFoundation(card, fidx)) return false;
      const oppMin = this.minFoundationRankByColor(!isRed(card.suit));
      return oppMin >= card.val() - 1;
    }

    // ---------- auto move ----------
    tryAutoMoveOnce(safeOnly=true){
      for (let ci=0;ci<10;ci++){
        const pile = this.cascades[ci];
        if (!pile.length) continue;
        const c = pile[pile.length-1];
        if (c.isJoker) continue;
        for (let f=0;f<4;f++){
          const ok = safeOnly ? this.safeToAutoFoundation(c,f) : this.canToFoundation(c,f);
          if (ok){
            pile.pop();
            this.foundations[f].push(c);
            return true;
          }
        }
      }
      return false;
    }

    autoMoveAll(safeOnly=true){
      while (this.tryAutoMoveOnce(safeOnly)) {}
    }

    // ---------- locate top card ----------
    locateTopCardAt(mx, my){
      for (let i=0;i<10;i++){
        const pile = this.cascades[i];
        if (!pile.length) continue;
        const c = pile[pile.length-1];
        if (rectContains(c.rect, mx, my)) return ["cascade", i];
      }
      return null;
    }

    // ---------- pick ----------
    pick(mx, my){
      if (this.dragCards.length) return;

      for (let i=0;i<10;i++){
        const pile = this.cascades[i];
        for (let j=pile.length-1;j>=0;j--){
          const c = pile[j];
          if (rectContains(c.rect, mx, my)){
            let run = pile.slice(j);
            if (!this.isValidRun(run)){
              run = [pile[pile.length-1]];
              j = pile.length-1;
            }
            if (run.length > this.movableLimit()){
              run = [pile[pile.length-1]];
              j = pile.length-1;
            }
            this.dragCards = run;
            this.dragFrom = {type:"cascade", i, start:j};
            this.dragOffset = {x: mx - c.rect.x, y: my - c.rect.y};
            return;
          }
        }
      }
    }

    // ---------- drop / commit ----------
    drop(mx, my, forceUnsafe=false){
      if (!this.dragCards.length) return;
      const cards = this.dragCards;
      const first = cards[0];

      // foundation (single non-joker)
      if (cards.length === 1 && !first.isJoker){
        for (let i=0;i<4;i++){
          const r = foundationRect(i);
          if (rectContains(r, mx, my) && this.canToFoundation(first, i)){
            this.commit({type:"foundation", i});
            this.autoMoveAll(true);
            return;
          }
        }
      }

      // cascade
      for (let i=0;i<10;i++){
        const r = cascadeRect(i);
        if (rectContains(r, mx, my)){
          if (this.isValidRun(cards) && cards.length <= this.movableLimit() && this.canToCascade(first, i)){
            this.commit({type:"cascade", i});
            this.autoMoveAll(true);
            return;
          }
        }
      }

      this.cancelDrag();
    }

    removeFromSource(){
      const src = this.dragFrom;
      if (!src) return;
      if (src.type === "cascade"){
        this.cascades[src.i] = this.cascades[src.i].slice(0, src.start);
      }
    }

    commit(target){
      const cards = this.dragCards;
      this.removeFromSource();

      if (target.type === "foundation"){
        this.foundations[target.i].push(cards[0]);
      } else if (target.type === "cascade"){
        this.cascades[target.i].push(...cards);
      }

      this.dragCards = [];
      this.dragFrom = null;
    }

    cancelDrag(){
      this.dragCards = [];
      this.dragFrom = null;
    }

    // ---------- double click ----------
    handleClick(mx, my, forceUnsafe=false){
      const now = performance.now();
      const dx = mx - this.lastClickPos.x;
      const dy = my - this.lastClickPos.y;
      const isDouble = (now - this.lastClickTime) <= this.doubleClickMs && (dx*dx + dy*dy) <= (12*12);

      this.lastClickTime = now;
      this.lastClickPos = {x:mx,y:my};

      if (isDouble){
        const loc = this.locateTopCardAt(mx, my);
        if (!loc) return;
        const idx = loc[1];
        const pile = this.cascades[idx];
        if (!pile.length) return;
        const c = pile[pile.length-1];
        if (c.isJoker) return;

        for (let f=0;f<4;f++){
          const ok = forceUnsafe ? this.canToFoundation(c,f) : this.safeToAutoFoundation(c,f);
          if (ok){
            pile.pop();
            this.foundations[f].push(c);
            this.autoMoveAll(true);
            return;
          }
        }
        return;
      }

      this.pick(mx, my);
    }

    // ---------- win ----------
    won(){
      const total = this.foundations.reduce((a,f)=>a+f.length,0);
      return total === 52 && this.foundations.every(f => f.length === 13);
    }

    // ---------- render ----------
    draw(ctx, mouse){
      ctx.fillStyle = BG;
      ctx.fillRect(0,0,WIDTH,HEIGHT);

      // foundations
      for (let i=0;i<4;i++){
        const r = foundationRect(i);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.strokeRect(r.x,r.y,r.w,r.h);
        const pile = this.foundations[i];
        if (pile.length){
          const top = pile[pile.length-1];
          top.rect.x = r.x; top.rect.y = r.y;
          top.draw(ctx);
        }
      }

      // cascades (10)
      for (let i=0;i<10;i++){
        const pile = this.cascades[i];
        const x = 40 + i*115;
        const y0 = 210;
        if (!pile.length){
          ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
          ctx.strokeRect(x, y0, CARD_W, CARD_H);
        }
        for (let j=0;j<pile.length;j++){
          const c = pile[j];
          c.rect.x = x;
          c.rect.y = y0 + j*25;
          c.draw(ctx);
        }
      }

      // drag
      if (this.dragCards.length && mouse){
        const mx = mouse.x, my = mouse.y;
        const ox = this.dragOffset.x, oy = this.dragOffset.y;
        for (let k=0;k<this.dragCards.length;k++){
          const c = this.dragCards[k];
          c.rect.x = mx - ox;
          c.rect.y = my - oy + k*25;
          c.draw(ctx);
        }
      }

      // footer text
      let modeTxt = `Deal: ${this.dealMode.toUpperCase()} `;
      modeTxt += (this.dealMode === "msvc") ? `#${this.dealNumber}` : `(Easter ${this.easterId})`;
      const limitTxt = `Move limit: ${this.movableLimit()}`;
      const typingTxt = `Type deal #: ${this.typing ? this.typing : "(none)"}`;

      const help1 = "LMB drag/drop | Double-click: auto to Foundation | Shift: force (unsafe) | Enter: deal #";
      const help2 = "E: Easter | M: MSVC mode | R: reset | Esc: clear typing | Backspace: delete digit | A: auto sweep";

      ctx.fillStyle = "#fff";
      ctx.font = "18px Arial";
      ctx.fillText(`${modeTxt} | ${limitTxt}`, 20, HEIGHT-90);
      ctx.fillText(typingTxt, 20, HEIGHT-70);
      ctx.fillText(help1, 20, HEIGHT-45);
      ctx.fillText(help2, 20, HEIGHT-25);

      // toast
      if (this.msgTimer > 0 && this.message){
        this.msgTimer -= 1;
        ctx.fillStyle = "#ff0";
        ctx.font = "18px Arial";
        ctx.fillText(this.message, 20, 10);
      }

      // win
      if (this.won()){
        ctx.fillStyle = "#ff0";
        ctx.font = "42px Arial";
        const text = "YOU WIN!";
        const w = ctx.measureText(text).width;
        ctx.fillText(text, (WIDTH - w)/2, HEIGHT/2 - 25);
      }
    }
  }

  // ================== Input wiring ==================
  let game = new TokkiCellGame("msvc", 1, 1);
  let mouse = {x:0,y:0};

  function getMousePos(e){
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  canvas.addEventListener("mousemove", (e) => {
    mouse = getMousePos(e);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const p = getMousePos(e);
    game.handleClick(p.x, p.y, !!e.shiftKey);
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    if (!game.dragCards.length) return;
    const p = getMousePos(e);
    game.drop(p.x, p.y, !!e.shiftKey);
  });

  window.addEventListener("keydown", (e) => {
    // typing deal #
    if (e.key >= "0" && e.key <= "9"){
      game.typing += e.key;
      return;
    }
    if (e.key === "Backspace"){
      game.typing = game.typing.slice(0,-1);
      return;
    }
    if (e.key === "Escape"){
      game.typing = "";
      return;
    }

    if (e.key === "Enter"){
      if (game.typing){
        const n = parseInt(game.typing, 10);
        if (!Number.isNaN(n)){
          game.dealMode = "msvc";
          game.dealNumber = n;
          game.reset();
          game.toast(`Dealt TokkiCell MSVC deal #${n}`);
        } else {
          game.toast("Invalid number");
        }
        game.typing = "";
      } else {
        game.toast("No deal number typed");
      }
      return;
    }

    if (e.key === "r" || e.key === "R"){
      const mode = game.dealMode, dn = game.dealNumber, ei = game.easterId;
      game = new TokkiCellGame(mode, dn, ei);
      game.toast("Reset");
      return;
    }

    if (e.key === "e" || e.key === "E"){
      if (game.dealMode !== "easter") game.dealMode = "easter";
      game.easterId += 1;
      if (game.easterId > 1) game.easterId = 1;
      game.reset();
      game.toast(`Easter deal ${game.easterId}`);
      return;
    }

    if (e.key === "m" || e.key === "M"){
      game.dealMode = "msvc";
      if (!Number.isInteger(game.dealNumber)) game.dealNumber = 1;
      game.reset();
      game.toast(`MSVC deal #${game.dealNumber}`);
      return;
    }

    if (e.key === "a" || e.key === "A"){
      // Shift+A => unsafe sweep, else safe sweep
      game.autoMoveAll(!e.shiftKey);
      game.toast(e.shiftKey ? "Auto-move (UNSAFE)" : "Auto-move (safe)");
      return;
    }
  });

  // ================== Main loop ==================
  function tick(){
    game.draw(ctx, mouse);
    requestAnimationFrame(tick);
  }
  tick();
})();
