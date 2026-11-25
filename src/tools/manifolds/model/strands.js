// The strands a manifold draws at a moment, from its parameters:
//
//   rest    generated defining points with the object's edits added, then
//           the hand-drawn strands. Cached on the generator's parameters
//           and the edits' identity (edits are replaced, never mutated).
//   posed   the rest points moved by the motion at time t: a smooth field
//           (wobble) whose phase turns a whole number of times a loop, so
//           it loops seamlessly and is the same at t whenever it is asked.
//   window  the part of each strand drawn (start, end, stagger, slide).
//
// Strands are addressed as { hand: false, i } (generated) or { hand: true, i }
// (the i-th hand-drawn one); `id` = 'g7' / 'h0'.
//
// Coordinates of hand-drawn points and edits are numbers here. The
// compositor can pass `coord` to read them as expressions (as a Spline's
// points are), so a variable a controller drives can move any one of them.
//
// Plain functions: no three, no React.

import { generate, genKey, handRand } from './generate';
import { noise3 } from './random';

const asNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const strandId = (hand, i) => `${hand ? 'h' : 'g'}${i}`;

/** A cache for restStrands: keep one per object. */
export const makeCache = () => ({ key: null, gen: null, edits: null, hand: null, look: null, rest: null });

/**
 * The strands at rest: [{ id, hand, i, points, rand, hidden, widthMul }].
 * `coord` reads one coordinate (default: as a number).
 */
export function restStrands(p, cache = makeCache(), coord = asNumber) {
    const key = genKey(p);
    if (cache.key !== key) {
        cache.key = key;
        cache.gen = generate(p);
        cache.rest = null;
    }
    if (cache.rest && cache.edits === p.edits && cache.hand === p.hand && cache.look === p.strandLook) return cache.rest;
    cache.edits = p.edits;
    cache.hand = p.hand;
    cache.look = p.strandLook;
    const edits = p.edits || {};
    const look = p.strandLook || {};
    const rest = cache.gen.map((s, i) => {
        const e = edits[i];
        const points = e
            ? s.points.map((q, k) => (e[k] ? [q[0] + coord(e[k][0]), q[1] + coord(e[k][1]), q[2] + coord(e[k][2])] : q))
            : s.points;
        const lk = look[i] || {};
        return {
            id: strandId(false, i), hand: false, i, points, rand: s.rand, hidden: !!lk.hidden, widthMul: Number.isFinite(lk.width) ? lk.width : 1,
        };
    });
    (p.hand || []).forEach((h, j) => {
        rest.push({
            id: strandId(true, j),
            hand: true,
            i: j,
            points: h.points.map((q) => [coord(q[0]), coord(q[1]), coord(q[2])]),
            rand: handRand(p.seed, j),
            hidden: !!h.hidden,
            widthMul: Number.isFinite(h.width) ? h.width : 1,
        });
    });
    cache.rest = rest;
    return rest;
}

/** The loop's phase at t, in [0, 1). */
export const loopPhase = (p, t) => {
    const L = Math.max(0.05, p.loop || 8);
    return (((t % L) + L) % L) / L;
};

/** Whether anything moves the points over time (otherwise posed === rest). */
export const pointsMove = (p) => p.wobble > 0;

/** `points` moved by the wobble at time t (a new array; rest is left alone). */
export function posePoints(points, p, t) {
    if (!(p.wobble > 0)) return points;
    const amp = p.wobble * Math.max(0.01, p.extent) * 0.25;
    const w = 2 * Math.PI * Math.round(p.wobbleCycles || 0) * loopPhase(p, t);
    const c = Math.cos(w);
    const s = Math.sin(w);
    const f = Math.max(0.0001, p.wobbleScale) / Math.max(0.01, p.extent) * 1.5;
    const sd = (p.seed | 0) * 7 + 101;
    return points.map((q) => {
        const x = q[0] * f;
        const y = q[1] * f;
        const z = q[2] * f;
        // Two fields a quarter-turn apart: a point goes round a loop in each axis.
        return [
            q[0] + amp * (noise3(sd, x, y, z) * c + noise3(sd + 1, x, y, z) * s),
            q[1] + amp * (noise3(sd + 2, x, y, z) * c + noise3(sd + 3, x, y, z) * s),
            q[2] + amp * (noise3(sd + 4, x, y, z) * c + noise3(sd + 5, x, y, z) * s),
        ];
    });
}

/** The object's breathing scale at t (1 when still). */
export function breatheScale(p, t) {
    if (!(p.breathe > 0)) return 1;
    return 1 + p.breathe * 0.3 * Math.sin(2 * Math.PI * Math.round(p.breatheCycles || 0) * loopPhase(p, t));
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** The [from, to] arc fractions of a strand drawn, or null when none of it is. */
export function strandWindow(p, rand) {
    const st = clamp01(p.trimStagger || 0);
    const r = rand.stagger;
    const grow = (x) => clamp01(x * (1 + st) - r * st);
    let a = grow(p.trimStart);
    let b = grow(p.trimEnd);
    const sl = p.slide || 0;
    a = clamp01(a + sl);
    b = clamp01(b + sl);
    if (b - a < 1e-4) return null;
    return [a, b];
}
