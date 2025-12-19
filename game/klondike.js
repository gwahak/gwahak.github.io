(() => {
  // ================== 설정 ==================
  const WIDTH = 1000, HEIGHT = 700;
  const CARD_W = 80, CARD_H = 120;
  const BG_COLOR = "#007800";

  const DRAW_MODES = { 1:"easy", 2:"medium", 3:"hard", 4:"very hard" };

  const SUITS = ["♠","♥","♦","♣"];
  const COLORS = { "♠":"#000", "♣":"#000", "♥":"#c00", "♦":"#c00" };
  const RANKS = [1,2,3,4,5,6,7,8,9,10,"J","Q","K"];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // 선명한 텍스트
  ctx.textBaseline = "top";

  // ================== 유틸 ==================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function rectContains(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function rankVal(r) {
    if (typeof r === "number") return r;
    return ({ J:11, Q:12, K:13 })[r];
  }

  function rankStr(r) {
    if (typeof r === "number") return String(r);
    return r;
  }

  // ================== 카드 ==================
  class Card {
    constructor(suit, rank) {
      this.suit = suit;
      this.rank = rank;
      this.faceUp = false;
      this.rect = { x:0, y:0, w:CARD_W, h:CARD_H };
    }
    color() { return COLORS[this.suit]; }
    label() { return `${rankStr(this.rank)}${this.suit}`; }

    draw(ctx) {
      const {x,y,w,h} = this.rect;
      if (this.faceUp) {
        // face up
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(x,y,w,h);

        ctx.fillStyle = this.color();
        ctx.font = "20px Arial";
        ctx.fillText(this.label(), x+6, y+6);
      } else {
        // face down
        ctx.fillStyle = "#282896";
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(x,y,w,h);
      }
    }
  }

  // ================== 게임 ==================
  class Game {
    constructor(drawN = 1) {
      this.drawN = drawN;
      this.reset();
    }

    reset() {
      const deck = [];
      for (const s of SUITS) for (const r of RANKS) deck.push(new Card(s,r));
      shuffle(deck);

      this.tableau = Array.from({length:7}, () => []);
      let idx = 0;
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < i+1; j++) {
          this.tableau[i].push(deck[idx++]);
        }
        this.tableau[i][this.tableau[i].length-1].faceUp = true;
      }

      this.stock = deck.slice(idx);      // face down
      this.waste = [];                   // face up
      this.foundations = Array.from({length:4}, () => []);

      // drag state
      this.dragCards = [];
      this.dragOffset = {x:0,y:0};
      this.dragFrom = null;

      // waste window
      this.wasteWindowStart = 0;
      this.lastDrawK = 0;
    }

    // ================== 규칙 ==================
    canTableau(card, pile) {
      if (!pile.length) return card.rank === "K";
      const top = pile[pile.length - 1];
      if (!top.faceUp) return false;
      if (card.color() === top.color()) return false;
      return rankVal(card.rank) + 1 === rankVal(top.rank);
    }

    canFoundation(card, pile) {
      if (!pile.length) return card.rank === 1;
      const top = pile[pile.length - 1];
      return card.suit === top.suit && rankVal(card.rank) === rankVal(top.rank) + 1;
    }

    // ================== 드로우 ==================
    drawStock() {
      if (this.stock.length) {
        this.wasteWindowStart = this.waste.length;

        const k = Math.min(this.drawN, this.stock.length);
        for (let i = 0; i < k; i++) {
          const c = this.stock.pop();
          c.faceUp = true;
          this.waste.push(c);
        }
        this.lastDrawK = k;
      } else {
        // recycle
        while (this.waste.length) {
          const c = this.waste.pop();
          c.faceUp = false;
          this.stock.push(c);
        }
        this.lastDrawK = 0;
        this.wasteWindowStart = 0;
      }
    }

    // ================== 좌표 ==================
    stockRect() { return { x:50, y:50, w:CARD_W, h:CARD_H }; }
    wasteRect() { return { x:150, y:50, w:CARD_W, h:CARD_H }; }
    foundationRect(i) { return { x:400+i*100, y:50, w:CARD_W, h:CARD_H }; }
    tableauRect(i) { return { x:50+i*130, y:200, w:CARD_W, h:HEIGHT-200 }; }

    // ================== 입력 ==================
    pickCard(mx, my) {
      // tableau: 위에서부터 검사
      for (let i = 0; i < 7; i++) {
        const pile = this.tableau[i];
        for (let j = pile.length - 1; j >= 0; j--) {
          const c = pile[j];
          if (c.faceUp && rectContains(c.rect, mx, my)) {
            this.dragCards = pile.slice(j);
            this.dragFrom = { type:"tableau", i, j };
            this.dragOffset = { x: mx - c.rect.x, y: my - c.rect.y };
            return;
          }
        }
      }

      // waste: 맨 위 카드만
      if (this.waste.length) {
        const top = this.waste[this.waste.length - 1];
        if (rectContains(top.rect, mx, my)) {
          this.dragCards = [top];
          this.dragFrom = { type:"waste" };
          this.dragOffset = { x: mx - top.rect.x, y: my - top.rect.y };
        }
      }
    }

    dropCard(mx, my) {
      if (!this.dragCards.length) return;

      const card = this.dragCards[0];

      // foundation
      for (let i = 0; i < 4; i++) {
        const r = this.foundationRect(i);
        if (rectContains(r, mx, my) && this.canFoundation(card, this.foundations[i])) {
          this.commit({ type:"foundation", i });
          return;
        }
      }

      // tableau
      for (let i = 0; i < 7; i++) {
        const r = this.tableauRect(i);
        if (rectContains(r, mx, my) && this.canTableau(card, this.tableau[i])) {
          this.commit({ type:"tableau", i });
          return;
        }
      }

      this.cancelDrag();
    }

    commit(target) {
      const src = this.dragFrom;
      const cards = this.dragCards;

      // remove
      if (src.type === "tableau") {
        this.tableau[src.i] = this.tableau[src.i].slice(0, src.j);
        if (this.tableau[src.i].length) {
          this.tableau[src.i][this.tableau[src.i].length - 1].faceUp = true;
        }
      } else if (src.type === "waste") {
        this.waste.pop();
        if (this.wasteWindowStart > this.waste.length) {
          this.wasteWindowStart = this.waste.length;
        }
      }

      // add
      if (target.type === "tableau") {
        this.tableau[target.i].push(...cards);
      } else if (target.type === "foundation") {
        this.foundations[target.i].push(cards[0]);
      }

      this.dragCards = [];
      this.dragFrom = null;
    }

    cancelDrag() {
      this.dragCards = [];
      this.dragFrom = null;
    }

    // ================== 렌더링 ==================
    draw(ctx, mouse) {
      // bg
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0,0,WIDTH,HEIGHT);

      // stock
      const sr = this.stockRect();
      if (this.stock.length) {
        ctx.fillStyle = "#282896";
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(sr.x, sr.y, sr.w, sr.h);
      } else {
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 2;
        ctx.strokeRect(sr.x, sr.y, sr.w, sr.h);
      }

      // waste (이번 draw window만 표시)
      const visible = this.waste.slice(this.wasteWindowStart);
      const offset = 18;
      for (let i = 0; i < visible.length; i++) {
        const c = visible[i];
        c.rect.x = 150 + i*offset;
        c.rect.y = 50;
        c.draw(ctx);
      }

      // foundations
      for (let i = 0; i < 4; i++) {
        const fr = this.foundationRect(i);
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 2;
        ctx.strokeRect(fr.x, fr.y, fr.w, fr.h);

        const pile = this.foundations[i];
        if (pile.length) {
          const top = pile[pile.length - 1];
          top.rect.x = fr.x;
          top.rect.y = fr.y;
          top.draw(ctx);
        }
      }

      // tableau
      for (let i = 0; i < 7; i++) {
        const pile = this.tableau[i];
        const x = 50 + i*130;
        const y0 = 200;
        for (let j = 0; j < pile.length; j++) {
          const c = pile[j];
          c.rect.x = x;
          c.rect.y = y0 + j*25;
          c.draw(ctx);
        }
      }

      // drag
      if (this.dragCards.length && mouse) {
        const mx = mouse.x, my = mouse.y;
        const ox = this.dragOffset.x, oy = this.dragOffset.y;
        for (let i = 0; i < this.dragCards.length; i++) {
          const c = this.dragCards[i];
          c.rect.x = (mx - ox);
          c.rect.y = (my - oy + i*25);
          c.draw(ctx);
        }
      }

      // ui text
      ctx.fillStyle = "#fff";
      ctx.font = "18px Arial";
      ctx.fillText(
        `Draw: ${this.drawN} cards (${DRAW_MODES[this.drawN]}) | 1~4 change | R reset`,
        20, HEIGHT - 30
      );
    }
  }

  // ================== 메인 루프 ==================
  let game = new Game(1);
  let mouse = { x:0, y:0 };

  function getMousePos(e) {
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
    const p = getMousePos(e);
    const sr = game.stockRect();
    if (rectContains(sr, p.x, p.y)) {
      game.drawStock();
    } else {
      game.pickCard(p.x, p.y);
    }
  });

  window.addEventListener("mouseup", (e) => {
    // 캔버스 밖에서 놓아도 드롭 처리되게 window에
    if (!game.dragCards.length) return;
    const p = getMousePos(e);
    game.dropCard(p.x, p.y);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      game = new Game(game.drawN);
    }
    if (["1","2","3","4"].includes(e.key)) {
      game = new Game(parseInt(e.key, 10));
    }
  });

  function tick() {
    game.draw(ctx, mouse);
    requestAnimationFrame(tick);
  }
  tick();
})();
