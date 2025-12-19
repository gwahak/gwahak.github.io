(() => {
  // ================== Canvas / Style ==================
  const WIDTH = 1000, HEIGHT = 700;
  const CARD_W = 80, CARD_H = 120;
  const BG = "#007800";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";

  // ================== Deal code (MSVC RNG) ==================
  const SUITS_CDHS = ["C","D","H","S"];
  const RANKS_CDHS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  function u32(x){ return x >>> 0; }

  function msvcRandStep(state) {
    // state = (state * 214013 + 2531011) & 0xFFFFFFFF
    // r = (state >> 16) & 0x7FFF
    const next = u32((Math.imul(state, 214013) + 2531011) >>> 0);
    const r = (next >>> 16) & 0x7FFF;
    return [next, r];
  }

  function freecellDeal(gamenumber) {
    let state = u32(gamenumber);
    const deck = Array.from({length:52}, (_,i)=>i);
    let wLeft = 52;
    const cols = Array.from({length:8}, ()=>[]);
    for (let i=0;i<52;i++){
      let r; [state, r] = msvcRandStep(state);
      const j = r % wLeft;
      cols[i % 8].push(deck[j]);
      wLeft -= 1;
      deck[j] = deck[wLeft];
    }
    return cols;
  }

  // ================== Easter deals (given) ==================
  const EASTER_DEALS = {
    1: [
      ['AC','3C','5C','7C','9C','JC','KC'],
      ['AD','3D','5D','7D','9D','JD','KD'],
      ['AH','3H','5H','7H','9H','JH','KH'],
      ['AS','3S','5S','7S','9S','JS','KS'],
      ['QC','10C','8C','6C','4C','2C'],
      ['QD','10D','8D','6D','4D','2D'],
      ['QH','10H','8H','6H','4H','2H'],
      ['QS','10S','8S','6S','4S','2S'],
    ],
    2: [
      ['AS','KS','QS','JS','10S','9S','8S'],
      ['AH','KH','QH','JH','10H','9H','8H'],
      ['AD','KD','QD','JD','10D','9D','8D'],
      ['AC','KC','QC','JC','10C','9C','8C'],
      ['7S','6S','5S','4S','3S','2S'],
      ['7H','6H','5H','4H','3H','2H'],
      ['7D','6D','5D','4D','3D','2D'],
      ['7C','6C','5C','4C','3C','2C'],
    ],
    3: [
      ['KS','QS','JS','10S','9S','8S','7S'],
      ['KH','QH','JH','10H','9H','8H','7H'],
      ['KD','QD','JD','10D','9D','8D','7D'],
      ['KC','QC','JC','10C','9C','8C','7C'],
      ['6S','5S','4S','3S','2S','AS'],
      ['6H','5H','4H','3H','2H','AH'],
      ['6D','5D','4D','3D','2D','AD'],
      ['6C','5C','4C','3C','2C','AC'],
    ],
    4: [
      ['KS','KH','KD','KC','QS','QH','QD'],
      ['QC','JS','JH','JD','JC','10S','10H'],
      ['10D','10C','9S','9H','9D','9C','8S'],
      ['8H','8D','8C','7S','7H','7D','7C'],
      ['6S','6H','6D','6C','5S','5H'],
      ['5D','5C','4S','4H','4D','4C'],
      ['3S','3H','3D','3C','2S','2H'],
      ['2D','2C','AS','AH','AD','AC'],
    ],
    5: [
      ['AH','3D','KD','JC','6C','JD','KC'],
      ['AS','3H','6H','5D','2C','7D','8D'],
      ['4H','QS','5S','5C','10H','8H','2S'],
      ['AC','QC','4D','8C','QH','9C'],
      ['2D','8S','9H','9D','6D','2H','3S'],
      ['6S','7H','JH','10D','10C','QD'],
      ['10S','AD','9S','KH','4S','4C'],
      ['JS','KS','3C','7C','7S','5H'],
    ],
    6: [
      ['AH','3D','KD','JC','6C','JD','KC'],
      ['AS','3H','6H','5D','2C','7D'],
      ['4H','QS','5S','5C','10H','8H','2S'],
      ['AC','QC','4D','8C','QH','9C','3S'],
      ['2D','8S','9H','9D','6D','2H'],
      ['6S','7H','JH','10D','10C','QD'],
      ['10S','AD','9S','KH','4S','4C'],
      ['JS','KS','3C','7C','7S','5H','8D'],
    ],
  };

  // ================== Card model ==================
  const GLYPH_BY_CDHS = { S:"♠", H:"♥", D:"♦", C:"♣" };
  const COLOR_BY_GLYPH = { "♠":"#000", "♣":"#000", "♥":"#c00", "♦":"#c00" };
  const RANK_TO_VAL = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13};

  function isRed(g){ return g === "♥" || g === "♦"; }

  class Card {
    constructor(suitGlyph, rankStr){
      this.suit = suitGlyph;
      this.rank = rankStr;
      this.rect = {x:0,y:0,w:CARD_W,h:CARD_H};
    }
    color(){ return COLOR_BY_GLYPH[this.suit]; }
    val(){ return RANK_TO_VAL[this.rank]; }
    label(){ return `${this.rank}${this.suit}`; }
    draw(ctx){
      const {x,y,w,h} = this.rect;
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(x,y,w,h);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x,y,w,h);
      ctx.fillStyle = this.color();
      ctx.font = "20px Arial";
      ctx.fillText(this.label(), x+6, y+6);
    }
  }

  function parseCardStr(s){
    const suit = GLYPH_BY_CDHS[s.slice(-1)];
    const rank = s.slice(0,-1);
    return new Card(suit, rank);
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

  function freecellRect(i){ return {x:50 + i*100, y:50, w:CARD_W, h:CARD_H}; }
  function foundationRect(i){ return {x:550 + i*100, y:50, w:CARD_W, h:CARD_H}; }
  function cascadeRect(i){ return {x:50 + i*115, y:200, w:CARD_W, h:HEIGHT-220}; }

  // ================== Game ==================
  class FreeCellGame {
    constructor(dealMode="msvc", dealNumber=1, easterId=1){
      this.dealMode = dealMode;
      this.dealNumber = dealNumber;
      this.easterId = easterId;
      this.reset();
    }

    reset(){
      this.freecells = [null,null,null,null];
      this.foundations = [[],[],[],[]];
      this.cascades = Array.from({length:8}, ()=>[]);

      if (this.dealMode === "easter"){
        const board = EASTER_DEALS[this.easterId];
        this.cascades = board.map(col => col.map(parseCardStr));
      } else {
        const cols = freecellDeal(this.dealNumber);
        this.cascades = cols.map(col => col.map(cardFromId));
      }

      // drag
      this.dragCards = [];
      this.dragFrom = null; // {type, ...}
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
      const pile = this.foundations[fidx];
      if (!pile.length) return card.val() === 1;
      const top = pile[pile.length-1];
      return card.suit === top.suit && card.val() === top.val()+1;
    }

    canToCascade(card, cidx){
      const pile = this.cascades[cidx];
      if (!pile.length) return true;
      const top = pile[pile.length-1];
      if (isRed(card.suit) === isRed(top.suit)) return false;
      return card.val() === top.val()-1;
    }

    movableLimit(){
      const emptyFree = this.freecells.filter(x=>x===null).length;
      const emptyCas = this.cascades.filter(p=>p.length===0).length;
      return (emptyFree + 1) * (2 ** emptyCas);
    }

    isValidRun(cards){
      for (let i=0;i<cards.length-1;i++){
        const a = cards[i], b = cards[i+1];
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
          if (isRed(top.suit) === wantRed) ranks.push(top.val());
        }
      }
      return ranks.length ? Math.min(...ranks) : 0;
    }

    safeToAutoFoundation(card, fidx){
      if (!this.canToFoundation(card, fidx)) return false;
      const oppMin = this.minFoundationRankByColor(!isRed(card.suit));
      return oppMin >= card.val() - 1;
    }

    // ---------- auto move ----------
    tryAutoMoveOnce(safeOnly=true){
      // freecells -> foundation
      for (let i=0;i<4;i++){
        const c = this.freecells[i];
        if (!c) continue;
        for (let f=0;f<4;f++){
          const ok = safeOnly ? this.safeToAutoFoundation(c,f) : this.canToFoundation(c,f);
          if (ok){
            this.freecells[i] = null;
            this.foundations[f].push(c);
            return true;
          }
        }
      }
      // cascades top -> foundation
      for (let ci=0;ci<8;ci++){
        const pile = this.cascades[ci];
        if (!pile.length) continue;
        const c = pile[pile.length-1];
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

    // ---------- locate top card under mouse ----------
    locateTopCardAt(mx, my){
      for (let i=0;i<4;i++){
        const c = this.freecells[i];
        if (c && rectContains(c.rect, mx, my)) return ["freecell", i];
      }
      for (let i=0;i<8;i++){
        const pile = this.cascades[i];
        if (!pile.length) continue;
        const c = pile[pile.length-1];
        if (rectContains(c.rect, mx, my)) return ["cascade", i];
      }
      return null;
    }

    // ---------- pick (drag) ----------
    pick(mx, my){
      if (this.dragCards.length) return;

      // freecells
      for (let i=0;i<4;i++){
        const c = this.freecells[i];
        if (c && rectContains(c.rect, mx, my)){
          this.dragCards = [c];
          this.dragFrom = {type:"freecell", i};
          this.dragOffset = {x: mx - c.rect.x, y: my - c.rect.y};
          return;
        }
      }

      // cascades: pick run if valid else top only
      for (let i=0;i<8;i++){
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

      // foundation (single)
      if (cards.length === 1){
        for (let i=0;i<4;i++){
          const r = foundationRect(i);
          if (rectContains(r, mx, my) && this.canToFoundation(first, i)){
            this.commit({type:"foundation", i});
            this.autoMoveAll(true);
            return;
          }
        }
      }

      // freecell (single, empty)
      if (cards.length === 1){
        for (let i=0;i<4;i++){
          const r = freecellRect(i);
          if (rectContains(r, mx, my) && this.freecells[i] === null){
            this.commit({type:"freecell", i});
            this.autoMoveAll(true);
            return;
          }
        }
      }

      // cascade
      for (let i=0;i<8;i++){
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
      if (src.type === "freecell"){
        this.freecells[src.i] = null;
      } else if (src.type === "cascade"){
        this.cascades[src.i] = this.cascades[src.i].slice(0, src.start);
      }
    }

    commit(target){
      const cards = this.dragCards;
      this.removeFromSource();

      if (target.type === "foundation"){
        this.foundations[target.i].push(cards[0]);
      } else if (target.type === "freecell"){
        this.freecells[target.i] = cards[0];
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
        const [type, idx] = loc;

        if (type === "freecell"){
          const c = this.freecells[idx];
          if (!c) return;
          for (let f=0;f<4;f++){
            const ok = forceUnsafe ? this.canToFoundation(c,f) : this.safeToAutoFoundation(c,f);
            if (ok){
              this.freecells[idx] = null;
              this.foundations[f].push(c);
              this.autoMoveAll(true);
              return;
            }
          }
        } else if (type === "cascade"){
          const pile = this.cascades[idx];
          if (!pile.length) return;
          const c = pile[pile.length-1];
          for (let f=0;f<4;f++){
            const ok = forceUnsafe ? this.canToFoundation(c,f) : this.safeToAutoFoundation(c,f);
            if (ok){
              pile.pop();
              this.foundations[f].push(c);
              this.autoMoveAll(true);
              return;
            }
          }
        }
        return;
      }

      // single: start drag
      this.pick(mx, my);
    }

    // ---------- win ----------
    won(){
      const total = this.foundations.reduce((a,f)=>a+f.length,0);
      return total === 52 && this.foundations.every(f => f.length === 13);
    }

    // ---------- render ----------
    draw(ctx, mouse){
      // bg
      ctx.fillStyle = BG;
      ctx.fillRect(0,0,WIDTH,HEIGHT);

      // freecells
      for (let i=0;i<4;i++){
        const r = freecellRect(i);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.strokeRect(r.x,r.y,r.w,r.h);
        const c = this.freecells[i];
        if (c){
          c.rect.x = r.x; c.rect.y = r.y;
          c.draw(ctx);
        }
      }

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

      // cascades
      for (let i=0;i<8;i++){
        const pile = this.cascades[i];
        const x = 50 + i*115;
        const y0 = 200;
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

      // footer
      let modeTxt = `Deal: ${this.dealMode.toUpperCase()} `;
      modeTxt += (this.dealMode === "msvc") ? `#${this.dealNumber}` : `(Easter ${this.easterId})`;
      const limitTxt = `Move limit: ${this.movableLimit()}`;
      const typingTxt = `Type deal #: ${this.typing ? this.typing : "(none)"}`;

      const help1 = "LMB drag/drop | Double-click: auto to Foundation | Shift: force (unsafe) | Enter: deal #";
      const help2 = "E: next Easter | M: MSVC mode | R: reset | Esc: clear typing | Backspace: delete digit | A: auto sweep";

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
  let game = new FreeCellGame("msvc", 1, 1);
  let mouse = {x:0,y:0};

  function getMousePos(e){
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function shiftDown(e){
    return !!(e.shiftKey);
  }

  canvas.addEventListener("mousemove", (e) => {
    mouse = getMousePos(e);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const p = getMousePos(e);
    game.handleClick(p.x, p.y, shiftDown(e));
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    if (!game.dragCards.length) return;
    const p = getMousePos(e);
    game.drop(p.x, p.y, shiftDown(e));
  });

  window.addEventListener("keydown", (e) => {
    // typing digits
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

    // actions
    if (e.key === "Enter"){
      if (game.typing){
        const n = parseInt(game.typing, 10);
        if (!Number.isNaN(n)){
          game.dealMode = "msvc";
          game.dealNumber = n;
          game.reset();
          game.toast(`Dealt MSVC deal #${n}`);
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
      game = new FreeCellGame(mode, dn, ei);
      game.toast("Reset");
      return;
    }

    if (e.key === "e" || e.key === "E"){
      if (game.dealMode !== "easter") game.dealMode = "easter";
      game.easterId += 1;
      if (game.easterId > 6) game.easterId = 1;
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
      // Shift+A => unsafe sweep, else safe sweep (pygame와 동일 의도)
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
