// Seeded randomness and smooth noise. Everything a manifold is made of comes
// from these, so the same seed always builds the same strands, and a strand's
// randomness depends only on (seed, its index): adding strands never
// reshuffles the ones already there.
//
// Plain functions: no three, no React.

/** A 32-bit hash of any number of integers. */
export function hash(...xs) {
    let h = 0x811c9dc5;
    for (let i = 0; i < xs.length; i++) {
        h ^= (xs[i] | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        h ^= h >>> 16;
    }
    return h >>> 0;
}

/** mulberry32: a generator of floats in [0, 1) from a 32-bit seed. */
export function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.signed = () => next() * 2 - 1;
    // Gaussian-ish (sum of three), in about [-1, 1].
    next.soft = () => (next() + next() + next()) / 1.5 - 1;
    next.unitVector = () => {
        const z = next() * 2 - 1;
        const a2 = next() * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - z * z));
        return [r * Math.cos(a2), r * Math.sin(a2), z];
    };
    next.inSphere = () => {
        const v = next.unitVector();
        const r = Math.cbrt(next());
        return [v[0] * r, v[1] * r, v[2] * r];
    };
    return next;
}

// ---- Value noise ---------------------------------------------------------------------

const lattice = (seed, x, y, z) => hash(seed, x, y, z) / 4294967296;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 3D value noise in [-1, 1]. */
export function noise3(seed, x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const w = fade(z - zi);
    const c = (dx, dy, dz) => lattice(seed, xi + dx, yi + dy, zi + dz);
    const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
    const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
    const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
    const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed, x) {
    const xi = Math.floor(x);
    const u = fade(x - xi);
    return lerp(lattice(seed, xi, 0, 0), lattice(seed, xi + 1, 0, 0), u) * 2 - 1;
}

/** Two octaves of noise3, about [-1, 1]. */
export const fbm3 = (seed, x, y, z) => (noise3(seed, x, y, z) * 0.67 + noise3(seed + 17, x * 2.03, y * 2.03, z * 2.03) * 0.33);

// ---- Small vector helpers -----------------------------------------------------------

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export function norm(a, fallback = [0, 1, 0]) {
    const l = len(a);
    return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback.slice();
}
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Any unit vector perpendicular to unit `v`. */
export function perpendicular(v) {
    const ref = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return norm(cross(v, ref));
}

/** `v` turned by `angle` radians about unit `axis` (Rodrigues). */
export function rotate(v, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const k = cross(axis, v);
    const d = dot(axis, v) * (1 - c);
    return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
}

/** A unit direction from yaw and pitch in degrees (yaw about Y from +X, pitch up). */
export function direction(yawDeg, pitchDeg) {
    const y = (yawDeg * Math.PI) / 180;
    const p = (pitchDeg * Math.PI) / 180;
    return [Math.cos(p) * Math.cos(y), Math.sin(p), -Math.cos(p) * Math.sin(y)];
}
