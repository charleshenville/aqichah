// A strand's centreline through its defining points, and the frames its
// cross-section is swept along.
//
//   catmull   passes through every point. Tension is Catmull-Rom's alpha:
//             0 uniform (round, can overshoot and loop), 0.5 centripetal
//             (never loops at sharp turns), 1 chordal (tight).
//   bezier    a chain of cubic Béziers: anchor, handle, handle, anchor,
//             handle, handle, anchor… (3k + 1 points). Passes through the
//             anchors; the handles pull it. Fewer than 4 points: as catmull.
//   bspline   uniform cubic B-spline, ends clamped: passes through the first
//             and last point and is pulled toward the rest (the smoothest).
//   linear    straight between the points (hard kinks).
//
// Sampling is by arc length, so tapers, twist and holes are even along the
// strand however its points are spaced. Frames are rotation-minimising
// (parallel transport, by double reflection) and are worked out over the
// whole curve before a trimmed part is taken, so a strand growing in keeps
// its twist where it was.
//
// Plain functions: no three, no React.

export const CURVE_KINDS = [['catmull', 'Through points'], ['bezier', 'Bézier'], ['bspline', 'B-spline'], ['linear', 'Linear']];

/** How many defining points a curve of `kind` with `anchors` anchors has. */
export const pointsFor = (kind, anchors) => (kind === 'bezier' ? 3 * (Math.max(2, anchors) - 1) + 1 : Math.max(2, anchors));

/** Whether point `i` of a Bézier strand is a handle (not an anchor). */
export const isHandle = (kind, i) => kind === 'bezier' && i % 3 !== 0;

// ---- Evaluating -------------------------------------------------------------------------

function catmullSeg(p0, p1, p2, p3, alpha, t, out) {
    // Barry-Goldman pyramid with knot spacing |d|^alpha.
    const kt = (a, b) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        return Math.max(1e-6, d ** alpha);
    };
    const t0 = 0;
    const t1 = t0 + kt(p0, p1);
    const t2 = t1 + kt(p1, p2);
    const t3 = t2 + kt(p2, p3);
    const u = t1 + (t2 - t1) * t;
    for (let c = 0; c < 3; c++) {
        const a1 = ((t1 - u) * p0[c] + (u - t0) * p1[c]) / (t1 - t0);
        const a2 = ((t2 - u) * p1[c] + (u - t1) * p2[c]) / (t2 - t1);
        const a3 = ((t3 - u) * p2[c] + (u - t2) * p3[c]) / (t3 - t2);
        const b1 = ((t2 - u) * a1 + (u - t0) * a2) / (t2 - t0);
        const b2 = ((t3 - u) * a2 + (u - t1) * a3) / (t3 - t1);
        out[c] = ((t2 - u) * b1 + (u - t1) * b2) / (t2 - t1);
    }
}

function bezierSeg(p0, p1, p2, p3, t, out) {
    const s = 1 - t;
    const a = s * s * s;
    const b = 3 * s * s * t;
    const c = 3 * s * t * t;
    const d = t * t * t;
    for (let k = 0; k < 3; k++) out[k] = a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k];
}

function bsplineSeg(p0, p1, p2, p3, t, out) {
    const t2 = t * t;
    const t3 = t2 * t;
    const a = (1 - 3 * t + 3 * t2 - t3) / 6;
    const b = (4 - 6 * t2 + 3 * t3) / 6;
    const c = (1 + 3 * t + 3 * t2 - 3 * t3) / 6;
    const d = t3 / 6;
    for (let k = 0; k < 3; k++) out[k] = a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k];
}

/**
 * The curve as a function of u in [0, 1] (each segment an equal share of u).
 * Returns { at(u, out), segments }.
 */
export function evaluator(points, kind = 'catmull', tension = 0.5) {
    const P = points;
    const n = P.length;
    if (n === 0) return { at: (u, out) => { out[0] = 0; out[1] = 0; out[2] = 0; }, segments: 0 };
    if (n === 1) return { at: (u, out) => { out[0] = P[0][0]; out[1] = P[0][1]; out[2] = P[0][2]; }, segments: 0 };

    if (kind === 'bezier' && n >= 4) {
        const segs = Math.floor((n - 1) / 3);
        return {
            segments: segs,
            at(u, out) {
                const x = Math.min(segs - 1e-9, Math.max(0, u * segs));
                const i = Math.floor(x);
                bezierSeg(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], P[i * 3 + 3], x - i, out);
            },
        };
    }

    if (kind === 'bspline' && n >= 3) {
        const Q = [P[0], P[0], ...P, P[n - 1], P[n - 1]];
        const segs = Q.length - 3;
        return {
            segments: segs,
            at(u, out) {
                const x = Math.min(segs - 1e-9, Math.max(0, u * segs));
                const i = Math.floor(x);
                bsplineSeg(Q[i], Q[i + 1], Q[i + 2], Q[i + 3], x - i, out);
            },
        };
    }

    const segs = n - 1;
    if (kind === 'linear' || n === 2) {
        return {
            segments: segs,
            at(u, out) {
                const x = Math.min(segs - 1e-9, Math.max(0, u * segs));
                const i = Math.floor(x);
                const f = x - i;
                for (let k = 0; k < 3; k++) out[k] = P[i][k] + (P[i + 1][k] - P[i][k]) * f;
            },
        };
    }

    // Through the points: phantom ends mirrored so the ends run straight on.
    const first = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1], 2 * P[0][2] - P[1][2]];
    const last = [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1], 2 * P[n - 1][2] - P[n - 2][2]];
    const Q = [first, ...P, last];
    const alpha = Math.max(0, Math.min(1, tension));
    return {
        segments: segs,
        at(u, out) {
            const x = Math.min(segs - 1e-9, Math.max(0, u * segs));
            const i = Math.floor(x);
            catmullSeg(Q[i], Q[i + 1], Q[i + 2], Q[i + 3], alpha, x - i, out);
        },
    };
}

// ---- Sampling with frames ------------------------------------------------------------------

/** Reusable buffers for sampleCurve, grown as needed. */
export function makeSampler() {
    return {
        dense: new Float64Array(0), cum: new Float64Array(0), dT: new Float64Array(0), dN: new Float64Array(0),
        pos: new Float32Array(0), tan: new Float32Array(0), nrm: new Float32Array(0), bin: new Float32Array(0),
    };
}

const grow = (arr, n, Kind) => (arr.length >= n ? arr : new Kind(n));

/**
 * `count` samples of the curve through `points` between arc-length fractions
 * `from` and `to`, each with a position, unit tangent, normal and binormal
 * (rotation-minimising; the first normal is the one closest to `up`).
 * Writes into `s` (from makeSampler) and returns { length, visible } in the
 * points' units.
 */
export function sampleCurve(points, {
    kind = 'catmull', tension = 0.5, count = 64, from = 0, to = 1, up = [0, 1, 0],
}, s) {
    const ev = evaluator(points, kind, tension);
    const M = Math.min(4096, Math.max(64, Math.ceil(count * 2.5), ev.segments * 24));
    s.dense = grow(s.dense, M * 3, Float64Array);
    s.cum = grow(s.cum, M, Float64Array);
    s.dT = grow(s.dT, M * 3, Float64Array);
    s.dN = grow(s.dN, M * 3, Float64Array);
    s.pos = grow(s.pos, count * 3, Float32Array);
    s.tan = grow(s.tan, count * 3, Float32Array);
    s.nrm = grow(s.nrm, count * 3, Float32Array);
    s.bin = grow(s.bin, count * 3, Float32Array);
    const {
        dense: D, cum, dT, dN,
    } = s;

    const tmp = [0, 0, 0];
    let total = 0;
    for (let i = 0; i < M; i++) {
        ev.at(i / (M - 1), tmp);
        D[i * 3] = tmp[0];
        D[i * 3 + 1] = tmp[1];
        D[i * 3 + 2] = tmp[2];
        if (i > 0) total += Math.hypot(tmp[0] - D[i * 3 - 3], tmp[1] - D[i * 3 - 2], tmp[2] - D[i * 3 - 1]);
        cum[i] = total;
    }

    // Tangents (central differences), carried over where the curve stalls.
    let px = 0;
    let py = 0;
    let pz = 1;
    for (let i = 0; i < M; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(M - 1, i + 1);
        let x = D[b * 3] - D[a * 3];
        let y = D[b * 3 + 1] - D[a * 3 + 1];
        let z = D[b * 3 + 2] - D[a * 3 + 2];
        const l = Math.hypot(x, y, z);
        if (l > 1e-12) { x /= l; y /= l; z /= l; } else { x = px; y = py; z = pz; }
        dT[i * 3] = x; dT[i * 3 + 1] = y; dT[i * 3 + 2] = z;
        px = x; py = y; pz = z;
    }
    // A stalled start takes the first real tangent.
    for (let i = 0; i < M; i++) {
        if (Math.hypot(D[Math.min(M - 1, i + 1) * 3] - D[i * 3], D[Math.min(M - 1, i + 1) * 3 + 1] - D[i * 3 + 1], D[Math.min(M - 1, i + 1) * 3 + 2] - D[i * 3 + 2]) > 1e-12) {
            for (let j = 0; j < i; j++) { dT[j * 3] = dT[i * 3]; dT[j * 3 + 1] = dT[i * 3 + 1]; dT[j * 3 + 2] = dT[i * 3 + 2]; }
            break;
        }
    }

    // First normal: `up` with the tangent taken out (or any perpendicular).
    {
        const tx = dT[0]; const ty = dT[1]; const tz = dT[2];
        let d = up[0] * tx + up[1] * ty + up[2] * tz;
        let nx = up[0] - tx * d; let ny = up[1] - ty * d; let nz = up[2] - tz * d;
        let l = Math.hypot(nx, ny, nz);
        if (l < 1e-6) {
            const r = Math.abs(ty) < 0.9 ? [0, 1, 0] : [1, 0, 0];
            d = r[0] * tx + r[1] * ty + r[2] * tz;
            nx = r[0] - tx * d; ny = r[1] - ty * d; nz = r[2] - tz * d;
            l = Math.hypot(nx, ny, nz);
        }
        dN[0] = nx / l; dN[1] = ny / l; dN[2] = nz / l;
    }
    // Double reflection (Wang, Jüttler, Zheng & Liu 2008).
    for (let i = 0; i < M - 1; i++) {
        const v1x = D[(i + 1) * 3] - D[i * 3];
        const v1y = D[(i + 1) * 3 + 1] - D[i * 3 + 1];
        const v1z = D[(i + 1) * 3 + 2] - D[i * 3 + 2];
        const c1 = v1x * v1x + v1y * v1y + v1z * v1z;
        let rx = dN[i * 3]; let ry = dN[i * 3 + 1]; let rz = dN[i * 3 + 2];
        let tx = dT[i * 3]; let ty = dT[i * 3 + 1]; let tz = dT[i * 3 + 2];
        if (c1 > 1e-18) {
            let k = (2 / c1) * (v1x * rx + v1y * ry + v1z * rz);
            rx -= k * v1x; ry -= k * v1y; rz -= k * v1z;
            k = (2 / c1) * (v1x * tx + v1y * ty + v1z * tz);
            tx -= k * v1x; ty -= k * v1y; tz -= k * v1z;
            const v2x = dT[(i + 1) * 3] - tx;
            const v2y = dT[(i + 1) * 3 + 1] - ty;
            const v2z = dT[(i + 1) * 3 + 2] - tz;
            const c2 = v2x * v2x + v2y * v2y + v2z * v2z;
            if (c2 > 1e-18) {
                k = (2 / c2) * (v2x * rx + v2y * ry + v2z * rz);
                rx -= k * v2x; ry -= k * v2y; rz -= k * v2z;
            }
        }
        // Keep it exactly perpendicular and unit.
        const nt = dT[(i + 1) * 3]; const nty = dT[(i + 1) * 3 + 1]; const ntz = dT[(i + 1) * 3 + 2];
        const d = rx * nt + ry * nty + rz * ntz;
        rx -= nt * d; ry -= nty * d; rz -= ntz * d;
        const l = Math.hypot(rx, ry, rz) || 1;
        dN[(i + 1) * 3] = rx / l; dN[(i + 1) * 3 + 1] = ry / l; dN[(i + 1) * 3 + 2] = rz / l;
    }

    // Resample the [from, to] stretch evenly by arc length.
    const a0 = Math.max(0, Math.min(1, Math.min(from, to))) * total;
    const a1 = Math.max(0, Math.min(1, Math.max(from, to))) * total;
    const {
        pos, tan, nrm, bin,
    } = s;
    let j = 0;
    for (let k = 0; k < count; k++) {
        const target = count > 1 ? a0 + ((a1 - a0) * k) / (count - 1) : a0;
        while (j < M - 2 && cum[j + 1] < target) j++;
        const span = cum[j + 1] - cum[j];
        const f = span > 1e-12 ? Math.max(0, Math.min(1, (target - cum[j]) / span)) : 0;
        const o = k * 3;
        for (let c = 0; c < 3; c++) {
            pos[o + c] = D[j * 3 + c] + (D[(j + 1) * 3 + c] - D[j * 3 + c]) * f;
            tan[o + c] = dT[j * 3 + c] + (dT[(j + 1) * 3 + c] - dT[j * 3 + c]) * f;
            nrm[o + c] = dN[j * 3 + c] + (dN[(j + 1) * 3 + c] - dN[j * 3 + c]) * f;
        }
        // Re-orthonormalise the interpolated frame.
        let tl = Math.hypot(tan[o], tan[o + 1], tan[o + 2]) || 1;
        tan[o] /= tl; tan[o + 1] /= tl; tan[o + 2] /= tl;
        const d = nrm[o] * tan[o] + nrm[o + 1] * tan[o + 1] + nrm[o + 2] * tan[o + 2];
        nrm[o] -= tan[o] * d; nrm[o + 1] -= tan[o + 1] * d; nrm[o + 2] -= tan[o + 2] * d;
        tl = Math.hypot(nrm[o], nrm[o + 1], nrm[o + 2]) || 1;
        nrm[o] /= tl; nrm[o + 1] /= tl; nrm[o + 2] /= tl;
        bin[o] = tan[o + 1] * nrm[o + 2] - tan[o + 2] * nrm[o + 1];
        bin[o + 1] = tan[o + 2] * nrm[o] - tan[o] * nrm[o + 2];
        bin[o + 2] = tan[o] * nrm[o + 1] - tan[o + 1] * nrm[o];
    }
    return { length: total, visible: a1 - a0 };
}
