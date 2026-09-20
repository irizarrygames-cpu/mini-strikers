'use strict';
const assert = require('assert');
const P = require('../server/pens');

for (let seed = 1; seed <= 20000; seed++) {
  const s = P.create(seed);
  while (!s.winner && s.n < 400) {
    const side = ((seed * 17 + s.n * 13) % 5 < 2) ? -0.78 : 0.72;
    const power = 0.55 + ((seed + s.n * 7) % 35) / 100;
    const diveSide = ((seed * 11 + s.n * 5) % 3) ? -side : side;
    P.resolve(s, { ax: side, az: 0.25 + ((seed + s.n) % 45) / 100, power }, { dx: diveSide, dz: 0.1, td: 0.2 + ((seed + s.n * 3) % 28) / 100 }, s.team === 'blue' ? 0.7 : 0.45);
  }
  assert(s.winner, `seed ${seed} did not finish`);
  assert.strictEqual(P.decided(s.kicks), s.winner, `seed ${seed} winner mismatch`);
  assert(Math.abs(s.kicks.blue.length - s.kicks.red.length) <= 1, `seed ${seed} turn imbalance`);
}

const early = { blue: [true, true, true], red: [false, false, false], };
assert.strictEqual(P.decided(early), 'blue');
assert.strictEqual(P.decided({ blue: [true, false, true, false, true], red: [true, false, true, false] }), null);
assert.strictEqual(P.decided({ blue: [true, false, true, false, true], red: [true, false, true, false, false] }), 'blue');
console.log('online penalty model: 20000 shootouts passed');
