'use strict';

const HW = 3.66, HT = 2.44, BR = 0.11, POST = 0.06, HIP = 0.72;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
function kick(input, quality, random) {
  const ax = clamp(Number(input.ax) || 0, -1.08, 1.08), az = clamp(Number(input.az) || 0.45, 0.03, 1.1), power = clamp(Number(input.power) || 0, 0, 1);
  const sigma = 0.16 + (1 - quality) * 0.22 + Math.max(0, power - 0.82) * 2.4;
  const x = ax * HW + gauss(random) * sigma;
  const z = Math.max(BR, az * HT + Math.max(0, power - 0.78) * 2 + gauss(random) * sigma * 0.6);
  const v = 16 + power * 13 + quality * 2, out = frame(x, z);
  return { x, z, v, T: 11 / v, power, out, postIn: (out === 'post' || out === 'bar') && random() < 0.4 };
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
function create(seed = Date.now()) {
  const random = rng(seed), first = random() < 0.5 ? 'blue' : 'red';
  return { seed, random, first, n: 0, team: first, kicks: { blue: [], red: [] }, score: { blue: 0, red: 0 }, winner: null };
}
function resolve(state, shotInput, diveInput, quality = 0.55) {
  if (state.winner) throw new Error('shootout finished');
  const shot = kick(shotInput, clamp(quality, 0.1, 1), state.random), couldGoIn = shot.out === 'in' || ((shot.out === 'post' || shot.out === 'bar') && shot.postIn);
  let result;
  if (couldGoIn && saves(diveInput, shot)) result = 'save';
  else if (shot.out === 'in') result = 'goal';
  else if ((shot.out === 'post' || shot.out === 'bar') && shot.postIn) result = shot.out === 'post' ? 'postIn' : 'barIn';
  else result = shot.out;
  const scored = result === 'goal' || result === 'postIn' || result === 'barIn';
  state.kicks[state.team].push(scored); state.score[state.team] += scored ? 1 : 0;
  const team = state.team; state.winner = decided(state.kicks); state.n++;
  if (!state.winner) state.team = state.n % 2 === 0 ? state.first : (state.first === 'blue' ? 'red' : 'blue');
  return { team, shot, dive: diveInput || null, result, scored, score: { ...state.score }, kicks: { blue: [...state.kicks.blue], red: [...state.kicks.red] }, winner: state.winner, n: state.n, next: state.team };
}

module.exports = { create, resolve, decided, kick, saves };
