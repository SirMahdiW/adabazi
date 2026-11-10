/* موتور بازی — منطق خالص، بدون DOM */
(function (global) {
  'use strict';

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function Engine(data, opts) {
    this.data = data;
    this.opts = opts; // {mode, categories:[cid], teams:[{name,color}], rounds, roundTime, wordsPerTurn}
    this.mode = opts.mode;
    this.teams = opts.teams.map(function (t, i) {
      return { name: t.name, color: t.color == null ? i : t.color, score: 0 };
    });
    this.round = 1;
    this.turnIndex = 0;          // شاخص تیم نوبت‌دار
    this.turnsInRound = 0;
    this.totalWords = 0;
    this.log = [];               // رکورد کلمه‌ها برای بازگشت
    this.roundDelta = this.teams.map(function () { return 0; });
    this.finished = false;
    this.pool = this.buildPool();
    this.startTurn();
  }

  Engine.prototype.buildPool = function () {
    var d = this.data, pool = [];
    if (this.mode === 'boom') {
      d.boom.forEach(function (w) { pool.push({ text: w, score: 3 }); });
    } else if (this.mode === 'songs') {
      d.songs.forEach(function (s) {
        pool.push({ text: s.t, sub: s.s, score: s.s && s.s.score ? s.s.score : 5 });
      });
    } else {
      var cats = this.opts.categories && this.opts.categories.length
        ? this.opts.categories
        : d.usableCategories.map(function (c) { return c.cid; });
      cats.forEach(function (cid) {
        (d.adabazi[String(cid)] || []).forEach(function (w) {
          pool.push({ text: w[0], score: w[1] });
        });
      });
    }
    return shuffle(pool);
  };

  Engine.prototype.startTurn = function () {
    var n = this.opts.wordsPerTurn;
    var queue = [];
    for (var i = 0; i < n; i++) {
      var w = this.pool.pop();
      if (!w) { this.pool = shuffle(this.buildPool()); w = this.pool.pop(); }
      if (!w) break;
      queue.push(w);
    }
    this.queue = queue;
    this.wordIndex = 0;
    this.turnScore = 0;
    this.turnCorrect = 0;
    this.timeLeft = this.opts.roundTime;
    this.over = false;
    this.turnActions = 0;
  };

  Engine.prototype.currentWord = function () {
    return this.queue[this.wordIndex] || null;
  };

  Engine.prototype.team = function () {
    return this.teams[this.turnIndex];
  };

  /* پاسخ: 'correct' | 'wrong' | 'skip' — امتیاز فقط برای correct */
  Engine.prototype.answer = function (kind) {
    var w = this.currentWord();
    if (!w || this.over) return null;
    var rec = { word: w, kind: kind, team: this.turnIndex, gained: 0 };

    if (kind === 'correct') {
      rec.gained = w.score;
      this.teams[this.turnIndex].score += w.score;
      this.turnScore += w.score;
      this.turnCorrect++;
      this.roundDelta[this.turnIndex] += w.score;
      this.totalWords++;
    }

    this.log.push(rec);
    this.wordIndex++;
    this.turnActions++;
    if (this.wordIndex >= this.queue.length) this.endTurn();
    return rec;
  };

  /* بازگشت یک قدم — فقط داخل نوبت جاری */
  Engine.prototype.undo = function () {
    if (!this.log.length || !this.turnActions) return false;
    var rec = this.log.pop();
    this.turnActions--;
    if (rec.kind === 'correct') {
      this.teams[rec.team].score -= rec.gained;
      this.roundDelta[rec.team] -= rec.gained;
      this.totalWords--;
      this.turnScore -= rec.gained;
      this.turnCorrect--;
    }
    // اگر نوبت تمام شده بود، برگرد به همان نوبت
    if (this.over) {
      this.over = false;
      this.turnIndex = rec.team;
    }
    this.wordIndex = Math.max(0, this.wordIndex - 1);
    // کلمه حذف‌شده را برگردان
    if (this.queue[this.wordIndex] !== rec.word) {
      this.queue.splice(this.wordIndex, 0, rec.word);
    }
    return true;
  };

  Engine.prototype.tick = function () {
    if (this.over) return this.timeLeft;
    this.timeLeft--;
    return this.timeLeft;
  };

  Engine.prototype.skipTurn = function () {
    if (this.over) return;
    this.endTurn();
  };

  Engine.prototype.endTurn = function () {
    if (this.over) return;
    this.over = true;
    this.turnsInRound++;

    var summary = {
      team: this.turnIndex,
      gained: this.turnScore,
      correct: this.turnCorrect,
      totals: this.teams.map(function (t) { return t.score; })
    };

    if (this.turnsInRound >= this.teams.length) {
      // پایان دور
      if (this.round >= this.opts.rounds) {
        this.finished = true;
        summary.end = true;
      } else {
        summary.roundEnd = true;
      }
    } else {
      // نوبت تیم بعدی
      this.turnIndex = (this.turnIndex + 1) % this.teams.length;
    }
    return summary;
  };

  /* فراخوانی بعد از بستن خلاصه دور / ادامه */
  Engine.prototype.nextRound = function () {
    this.round++;
    this.turnsInRound = 0;
    this.turnIndex = 0;
    this.roundDelta = this.teams.map(function () { return 0; });
    this.startTurn();
  };

  Engine.prototype.continueAfterTurn = function () {
    this.startTurn();
  };

  Engine.prototype.winner = function () {
    var best = 0;
    for (var i = 1; i < this.teams.length; i++) {
      if (this.teams[i].score > this.teams[best].score) best = i;
    }
    var tie = this.teams.every(function (t) { return t.score === this.teams[best].score; }, this);
    return tie ? null : this.teams[best];
  };

  Engine.prototype.isTie = function () {
    var first = this.teams[0].score;
    return this.teams.every(function (t) { return t.score === first; });
  };

  global.GameEngine = Engine;
})(window);
