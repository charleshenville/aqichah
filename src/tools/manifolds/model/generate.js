// The generator: a manifold's strands as defining points, from its Form and
// Curve parameters. Each strand's randomness comes from (seed, its index)
// alone, so adding strands keeps the ones already there and an edit made to
// strand 7 stays on strand 7.
//
//   confluence  strands come in from all round, pass through a knot at the
//               centre and leave the other side; swirl winds them about the
//               aim as they go through
//   burst       blades out from a core, in a cone about the aim (spread 1:
//               every way); both ways passes each through the core
//   sheaf       a fan from one root toward the aim, bending together
//   vortex      helices about the vertical
//   flow        streamlines of a smooth field drifting toward the aim
//
// Plain functions: no three, no React.

import {
    hash, rng, noise3, add, sub, scale, cross, norm, perpendicular, rotate, direction, len,
} from './random';

/** The parameters that change what the generator makes. */
export const GEN_KEYS = [
    'form', 'count', 'anchors', 'seed', 'extent', 'spread', 'aimYaw', 'aimPitch', 'twoSided', 'core',
    'swirl', 'curl', 'chaos', 'lengthVar', 'flatten', 'curve', 'handleLength', 'handleSkew',
];

export const genKey = (p) => GEN_KEYS.map((k) => p[k]).join('|');

/** A random direction within `halfAngle` radians of unit `axis`. */
function inCone(r, axis, halfAngle) {
    const cosMax = Math.cos(Math.min(Math.PI, Math.max(0, halfAngle)));
    const z = cosMax + (1 - cosMax) * r();
    const phi = r() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    const u = perpendicular(axis);
    const v = cross(axis, u);
    return norm([
        axis[0] * z + (u[0] * Math.cos(phi) + v[0] * Math.sin(phi)) * s,
        axis[1] * z + (u[1] * Math.cos(phi) + v[1] * Math.sin(phi)) * s,
        axis[2] * z + (u[2] * Math.cos(phi) + v[2] * Math.sin(phi)) * s,
    ]);
}

/** A strand's anchors (n of them) for each form. */
function anchorsFor(p, i, r, n) {
    const ext = Math.max(0.01, p.extent);
    const aim = direction(p.aimYaw || 0, p.aimPitch || 0);
    const L = ext * (1 - Math.min(0.95, p.lengthVar) * r());
    const coreR = Math.max(0, p.core) * ext * 0.5;
    const chaos = Math.max(0, p.chaos);
    const curl = p.curl || 0;
    const swirl = (p.swirl || 0) * Math.PI * 2;
    const out = [];
    const jitter = () => scale(r.inSphere(), chaos * L * 0.18);

    switch (p.form) {
        case 'burst': {
            const d = inCone(r, aim, p.spread * Math.PI);
            const o = scale(r.inSphere(), coreR);
            const bend = rotate(perpendicular(d), d, r() * Math.PI * 2);
            for (let k = 0; k < n; k++) {
                const t = k / (n - 1);
                const s = p.twoSided ? t * 2 - 1 : t;
                const u = Math.abs(s);
                let q = add(scale(d, s * L), scale(bend, curl * L * 0.3 * u * u));
                q = rotate(q, aim, swirl * u);
                q = add(o, q);
                out.push(k === 0 && !p.twoSided ? q : add(q, jitter()));
            }
            break;
        }
        case 'sheaf': {
            const d = inCone(r, aim, p.spread * Math.PI * 0.5);
            const o = scale(r.inSphere(), coreR);
            // One bend for the whole sheaf (its seed's), a little each its own.
            const g = rotate(perpendicular(aim), aim, ((hash(p.seed, 77) % 1000) / 1000) * Math.PI * 2);
            const own = 0.7 + 0.6 * r();
            for (let k = 0; k < n; k++) {
                const t = k / (n - 1);
                let q = add(scale(d, t * L), scale(g, curl * L * 0.45 * t * t * own));
                q = rotate(q, aim, swirl * t * own);
                q = add(o, q);
                out.push(k === 0 ? q : add(q, jitter()));
            }
            break;
        }
        case 'vortex': {
            const rho = ext * (0.15 + 0.85 * Math.sqrt(r())) * (0.4 + Math.min(1, p.core) * 0.6);
            const h0 = (r() - 0.5) * ext * 2 * p.spread;
            const phi0 = r() * Math.PI * 2;
            const turns = swirl || Math.PI;
            for (let k = 0; k < n; k++) {
                const t = k / (n - 1);
                const a = phi0 + turns * t;
                const rr = rho * (1 + curl * 0.5 * Math.sin(Math.PI * t));
                const q = [Math.cos(a) * rr, h0 + (t - 0.5) * L * 0.9, Math.sin(a) * rr];
                out.push(add(q, jitter()));
            }
            break;
        }
        case 'flow': {
            let q = scale(r.inSphere(), ext * (0.4 + p.spread * 0.8));
            const step = L / (n - 1);
            const sc = 0.9 / ext;
            const sd = p.seed * 31;
            for (let k = 0; k < n; k++) {
                out.push(q);
                const f = [
                    noise3(sd + 1, q[0] * sc, q[1] * sc, q[2] * sc),
                    noise3(sd + 2, q[0] * sc, q[1] * sc, q[2] * sc),
                    noise3(sd + 3, q[0] * sc, q[1] * sc, q[2] * sc),
                ];
                let v = add(scale(aim, 0.7), scale(f, 0.6 + chaos * 2.5));
                v = add(v, scale(cross(aim, q), (p.swirl || 0) * 0.8 / ext));
                v = add(v, scale(rotate(perpendicular(aim), aim, r() * 6.283), curl * 0.3));
                q = add(q, scale(norm(v), step));
            }
            break;
        }
        case 'confluence':
        default: {
            const A = r.unitVector();
            // The far end: opposite, turned off it by up to the spread.
            const B = inCone(r, scale(A, -1), p.spread * Math.PI * 0.75);
            const S = scale(A, L * 0.5 * (0.7 + 0.3 * r()));
            const E = scale(B, L * 0.5 * (0.7 + 0.3 * r()));
            const c = scale(r.inSphere(), coreR);
            // Through the knot point c at the middle.
            const C = sub(scale(c, 2), scale(add(S, E), 0.5));
            const bend = rotate(perpendicular(norm(sub(E, S))), norm(sub(E, S)), r() * Math.PI * 2);
            for (let k = 0; k < n; k++) {
                const t = k / (n - 1);
                const a = (1 - t) * (1 - t);
                const b = 2 * t * (1 - t);
                const d = t * t;
                let q = [
                    a * S[0] + b * C[0] + d * E[0],
                    a * S[1] + b * C[1] + d * E[1],
                    a * S[2] + b * C[2] + d * E[2],
                ];
                q = add(q, scale(bend, curl * L * 0.25 * Math.sin(Math.PI * t)));
                q = rotate(q, aim, swirl * (t - 0.5));
                out.push(add(q, jitter()));
            }
            break;
        }
    }

    // One-sided forms grow from their root toward the aim: move them back by
    // half their usual length so they sit about the origin. (Their expected
    // centre, not the strands' centroid, so adding strands moves nothing.)
    const oneSided = p.form === 'sheaf' || p.form === 'flow' || (p.form === 'burst' && !p.twoSided);
    if (oneSided) {
        const back = scale(aim, ext * (1 - Math.min(0.95, p.lengthVar) * 0.5) * (p.form === 'burst' ? 0.3 : 0.5));
        for (let k = 0; k < out.length; k++) out[k] = sub(out[k], back);
    }

    const keep = 1 - Math.max(0, Math.min(1, p.flatten));
    if (keep < 1) out.forEach((q) => { q[2] *= keep; });
    return out;
}

/** Bézier defining points from anchors: handles along the tangent, skewed off it at random. */
export function withHandles(anchors, handleLength, skew, r) {
    const n = anchors.length;
    const tan = anchors.map((a, k) => {
        const prev = anchors[Math.max(0, k - 1)];
        const next = anchors[Math.min(n - 1, k + 1)];
        return scale(sub(next, prev), k === 0 || k === n - 1 ? 1 : 0.5);
    });
    const handle = (k, sign) => {
        let h = scale(tan[k], sign * handleLength);
        if (skew > 0) {
            const l = len(h);
            const ax = rotate(perpendicular(norm(h)), norm(h), r() * Math.PI * 2);
            h = scale(norm(rotate(h, ax, skew * Math.PI * 0.9 * r.signed())), l);
        }
        return add(anchors[k], h);
    };
    const out = [anchors[0]];
    for (let k = 0; k < n - 1; k++) {
        out.push(handle(k, 1), handle(k + 1, -1), anchors[k + 1]);
    }
    return out;
}

/**
 * The generated strands: [{ points, rand }] where `points` are the defining
 * points for the parameters' curve kind and `rand` the strand's own random
 * numbers (width, twist, roll, colour, stagger, phase; all in [0, 1)).
 */
export function generate(p) {
    const count = Math.max(0, Math.round(p.count));
    const n = Math.max(2, Math.round(p.anchors));
    const out = [];
    for (let i = 0; i < count; i++) {
        const r = rng(hash(p.seed, i, 0x5eed));
        // Its own numbers first, so the form never shifts them.
        const rand = {
            width: r(), twist: r(), roll: r(), color: r(), stagger: r(), phase: r(),
        };
        let points = anchorsFor(p, i, r, n);
        if (p.curve === 'bezier') points = withHandles(points, p.handleLength, p.handleSkew, rng(hash(p.seed, i, 0xbe2)));
        out.push({ points, rand });
    }
    return out;
}

/** Random numbers for a hand-drawn strand, from its position in the list. */
export function handRand(seed, j) {
    const r = rng(hash(seed, j, 0x4a4d));
    return {
        width: r(), twist: r(), roll: r(), color: r(), stagger: r(), phase: r(),
    };
}

/** A new hand-drawn strand: a gentle S through the origin, `n` anchors (as the curve kind wants). */
export function newHandStrand(kind, n = 4, size = 2) {
    const anchors = [];
    for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        anchors.push([(t - 0.5) * size, Math.sin(t * Math.PI * 2) * size * 0.15, 0]);
    }
    if (kind !== 'bezier') return anchors;
    return withHandles(anchors, 0.35, 0, rng(1));
}

