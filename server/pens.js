'use strict';

const HW = 3.66, HT = 2.44, BR = 0.11, POST = 0.06, HIP = 0.72;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Free kicks: the same numbers as PEN.FK in js/penalty.js (tools/fkscan.js checks they match).
// The wall covers one side, the keeper stands over the other; a ball still lower than the wall when
// it gets there on the wall's side is blocked; over the wall is seen late.
const FK = { DIST: 22, AT: 9.15, H: 2.0, JUMP: 0.32, KX: 0.9, NEAR: 0.12, SCREEN: 0.25, SCREEN_OPEN: 0.1, SIGMA: 1.35, MEN: 4 };
const fkWall = (random) => ({ side: random() < 0.5 ? -1 : 1, jump: random() < 0.45 });
const fkCovered = (x, wall) => (wall.side > 0 ? x > FK.NEAR : x < -FK.NEAR);
const fkArc = (power) => 0.35 + (1 - power) * 1.9;
const fkAtWall = (z, power) => { const f = FK.AT / FK.DIST; return z * f + fkArc(power) * 4 * f * (1 - f); };
const fkTop = (wall) => FK.H + (wall.jump ? FK.JUMP : 0);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gauss(random) {
  let u = 0, v = 0;
  while (!u) u = random(); while (!v) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function frame(x, z) {
  const ax = Math.abs(x);
  if (ax > HW + BR) return 'wide';
  if (z > HT + BR) return 'over';
  if (ax > HW - BR - POST) return 'post';
  if (z > HT - BR - POST) return 'bar';
  return 'in';
}
function kick(input, quality, random, wall = null) {
  const ax = clamp(Number(input.ax) || 0, -1.08, 1.08), az = clamp(Number(input.az) || 0.45, 0.03, 1.1), power = clamp(Number(input.power) || 0, 0, 1);
  const sigma = (0.16 + (1 - quality) * 0.22 + Math.max(0, power - 0.82) * 2.4) * (wall ? FK.SIGMA : 1);
  const x = ax * HW + gauss(random) * sigma;
  const z = Math.max(BR, az * HT + Math.max(0, power - 0.78) * 2 + gauss(random) * sigma * 0.6);
  const v = 16 + power * 13 + quality * 2;
  let out = frame(x, z);
  let postIn = (out === 'post' || out === 'bar') && random() < 0.4;
  const k = { x, z, v, T: (wall ? FK.DIST : 11) / v, power, out, postIn };
  if (wall) {
    k.fk = true; k.covered = fkCovered(x, wall); k.atWall = fkAtWall(z, power);
    if (k.covered && k.atWall < fkTop(wall)) { k.out = 'wall'; k.postIn = false; }
  }
  return k;
}
function saves(dive, shot) {
  const dx = clamp(Number(dive && dive.dx) || 0, -1, 1), dz = clamp(Number(dive && dive.dz) || 1, -1, 1), td = clamp(Number(dive && dive.td) || 0, -0.8, 1);
  const l = Math.hypot(dx, dz) || 1, nx = dx / l, nz = dz / l;
  const up = Math.abs(nx) < 0.3 && nz > 0, s = clamp(7.2 * (shot.T - td), 0, up ? 0.6 : 1.75);
  const phi = Math.atan2(nx, nz) * clamp(s / 0.7, 0, 1), ax = nx * s - Math.sin(phi) * 0.5, az = Math.max(0.3, HIP + nz * s) - Math.cos(phi) * 0.5;
  const bx = nx * s + Math.sin(phi) * 1.35, bz = Math.max(0.3, HIP + nz * s) + Math.cos(phi) * 1.35;
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, u = clamp(((shot.x - ax) * vx + (shot.z - az) * vz) / l2, 0, 1);
  return Math.hypot(shot.x - (ax + vx * u), shot.z - (az + vz * u)) < 0.44;
}
function decided(kicks) {
  const b = kicks.blue, r = kicks.red, gb = b.filter(Boolean).length, gr = r.filter(Boolean).length;
  if (b.length < 5 || r.length < 5) {
    if (gb + (5 - b.length) < gr) return 'red';
    if (gr + (5 - r.length) < gb) return 'blue';
    return null;
  }
  return b.length === r.length && gb !== gr ? (gb > gr ? 'blue' : 'red') : null;
}
// kind: 'pens' or 'fk' (a free-kick shootout: each kick has a wall, chosen before it is taken)
function create(seed = Date.now(), kind = 'pens') {
  const random = rng(seed), first = random() < 0.5 ? 'blue' : 'red';
  const fk = kind === 'fk';
  return { seed, random, kind: fk ? 'fk' : 'pens', first, n: 0, team: first, kicks: { blue: [], red: [] }, score: { blue: 0, red: 0 }, winner: null, wall: fk ? fkWall(random) : null };
}
function resolve(state, shotInput, diveInput, quality = 0.55) {
  if (state.winner) throw new Error('shootout finished');
  const wall = state.wall;
  const shot = kick(shotInput, clamp(quality, 0.1, 1), state.random, wall), couldGoIn = shot.out === 'in' || ((shot.out === 'post' || shot.out === 'bar') && shot.postIn);
  // a free kick's keeper stands over the open side and sees a ball over the wall late
  const kx = wall ? -wall.side * FK.KX : 0;
  const seen = wall ? { x: shot.x - kx, z: shot.z, T: shot.T - (shot.covered ? FK.SCREEN : FK.SCREEN_OPEN) } : shot;
  let result;
  if (shot.out === 'wall') result = 'wall';
  else if (couldGoIn && saves(diveInput, seen)) result = 'save';
  else if (shot.out === 'in') result = 'goal';
  else if ((shot.out === 'post' || shot.out === 'bar') && shot.postIn) result = shot.out === 'post' ? 'postIn' : 'barIn';
  else result = shot.out;
  const scored = result === 'goal' || result === 'postIn' || result === 'barIn';
  state.kicks[state.team].push(scored); state.score[state.team] += scored ? 1 : 0;
  const team = state.team; state.winner = decided(state.kicks); state.n++;
  if (!state.winner) state.team = state.n % 2 === 0 ? state.first : (state.first === 'blue' ? 'red' : 'blue');
  // the next free kick gets a wall of its own (the one just taken goes back with this kick)
  if (wall && !state.winner) state.wall = fkWall(state.random);
  return { team, shot, dive: diveInput || null, result, scored, score: { ...state.score }, kicks: { blue: [...state.kicks.blue], red: [...state.kicks.red] }, winner: state.winner, n: state.n, next: state.team, kickWall: wall };
}

module.exports = { create, resolve, decided, kick, saves, FK, fkWall, fkCovered, fkAtWall, fkTop };
