// A manifold's strands swept into one mesh: each strand (and each of its
// bundle's sub-strands) is a cross-section carried along its centreline's
// frames, scaled by the taper, swell and pinch and turned by the twist.
// Everything goes into one BufferGeometry, so the whole manifold is a single
// draw however many strands it has.
//
// The buffers are allocated for every strand and rewritten in place; hidden
// or fully trimmed strands are skipped and the draw range shrunk, so only a
// change in the strand count, detail, sides or cross-section reallocates.
//
// Attributes: position, normal, color (linear), uv (world units: x along the
// strand from its start, y across the cross-section; the holes read these).

import * as THREE from 'three';
import { sampleCurve, makeSampler } from '../model/curves';
import { strandWindow, posePoints, loopPhase } from '../model/strands';
import { hash, rng } from '../model/random';

/** At most this many vertices: past it, Detail is lowered to fit (stats say so). */
export const MAX_VERTS = 3_000_000;

// ---- Cross-sections -------------------------------------------------------------------------
//
// A cross-section is K points in the frame's plane, x across the width and y
// through the thickness, both in half-widths, each with a 2D normal and a
// distance around it (for uv.y). `strips` are runs of consecutive points
// joined into quads; a blade's two faces are separate strips so its edges
// stay sharp.

function makeProfile(kind, sides, thickness) {
    const n = Math.max(2, Math.round(sides));
    const pts = [];
    const nrm = [];
    const strips = [];
    if (kind === 'ribbon') {
        // An open sheet, cupped by the thickness.
        const cup = thickness * 0.6;
        for (let j = 0; j <= n; j++) {
            const x = -1 + (2 * j) / n;
            pts.push([x, cup * x * x]);
            const l = Math.hypot(-2 * cup * x, 1);
            nrm.push([(-2 * cup * x) / l, 1 / l]);
        }
        strips.push([0, n + 1]);
    } else if (kind === 'tube') {
        const ry = Math.max(0.04, 1 - thickness * 0.92);
        for (let j = 0; j <= n; j++) {
            const a = (2 * Math.PI * j) / n;
            pts.push([Math.cos(a), Math.sin(a) * ry]);
            const nx = Math.cos(a) / 1;
            const ny = Math.sin(a) / ry;
            const l = Math.hypot(nx, ny);
            nrm.push([nx / l, ny / l]);
        }
        strips.push([0, n + 1]);
    } else {
        // Blade: two arcs meeting at sharp edges.
        const b = Math.max(0.02, thickness * 0.7);
        for (let side = 0; side < 2; side++) {
            const s = side === 0 ? 1 : -1;
            const start = pts.length;
            for (let j = 0; j <= n; j++) {
                const x = side === 0 ? -1 + (2 * j) / n : 1 - (2 * j) / n;
                pts.push([x, s * b * (1 - x * x)]);
                const nx = 2 * b * x * s;
                const ny = s;
                const l = Math.hypot(nx, ny);
                nrm.push([nx / l, ny / l]);
            }
            strips.push([start, n + 1]);
        }
    }
    // Distance around, in half-widths.
    const around = [0];
    for (let j = 1; j < pts.length; j++) around.push(around[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    return {
        K: pts.length, pts, nrm, around, strips,
    };
}

// ---- Width along a strand ---------------------------------------------------------------------

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function taperAt(u, p) {
    let w = 1;
    if (p.taperIn > 0) w = Math.min(w, clamp01(u / p.taperIn) ** p.taperShape);
    if (p.taperOut > 0) w = Math.min(w, clamp01((1 - u) / p.taperOut) ** p.taperShape);
    return w;
}

// Swell: three sines at unrelated frequencies along the strand, each moving
// a whole number of cycles a loop (so flowing swell loops seamlessly).
function swellAt(f, p, ph, phase) {
    if (!(p.swell > 0)) return 1;
    const sc = p.swellScale;
    const fl = Math.round(p.swellFlow || 0) * phase;
    const v = 0.55 * Math.sin(2 * Math.PI * (f * sc + fl + ph[0]))
        + 0.3 * Math.sin(2 * Math.PI * (f * sc * 2.17 + 2 * fl + ph[1]))
        + 0.15 * Math.sin(2 * Math.PI * (f * sc * 3.71 + 3 * fl + ph[2]));
    return Math.max(0.03, 1 + p.swell * v);
}

function pinchAt(f, p) {
    if (!(p.pinch > 0)) return 1;
    const c = 0.5 - 0.5 * Math.cos(2 * Math.PI * f * Math.max(1, Math.round(p.pinchCount)));
    return 1 - p.pinch * 0.97 * c ** 6;
}

// ---- The mesh ----------------------------------------------------------------------------------

export default class StrandGeometry {
    constructor() {
        this.geometry = new THREE.BufferGeometry();
        this.sampler = makeSampler();
        this.layout = '';
        this.stats = {
            strands: 0, drawn: 0, verts: 0, tris: 0, capped: false,
        };
    }

    /** (Re)allocate for `subs` sub-strands of S samples and the profile's K points. */
    allocate(subs, S, prof) {
        const key = `${subs}|${S}|${prof.K}|${prof.strips.map((s) => s.join(':')).join(',')}`;
        if (key === this.layout) return;
        this.layout = key;
        const V = subs * S * prof.K;
        const g = this.geometry;
        const attr = (n) => {
            const a = new THREE.BufferAttribute(new Float32Array(Math.max(1, V) * n), n);
            a.setUsage(THREE.DynamicDrawUsage);
            return a;
        };
        g.setAttribute('position', attr(3));
        g.setAttribute('normal', attr(3));
        g.setAttribute('color', attr(3));
        g.setAttribute('uv', attr(2));
        // Indices: the same pattern for every sub-strand, offset by its block.
        const perRing = prof.strips.reduce((n, [, c]) => n + (c - 1), 0);
        const perSub = (S - 1) * perRing * 6;
        const Idx = V > 65535 ? Uint32Array : Uint16Array;
        const idx = new Idx(Math.max(1, subs * perSub));
        let o = 0;
        for (let m = 0; m < subs; m++) {
            const base = m * S * prof.K;
            for (let k = 0; k < S - 1; k++) {
                const r0 = base + k * prof.K;
                const r1 = r0 + prof.K;
                for (const [start, cnt] of prof.strips) {
                    for (let j = start; j < start + cnt - 1; j++) {
                        idx[o++] = r0 + j; idx[o++] = r1 + j; idx[o++] = r0 + j + 1;
                        idx[o++] = r0 + j + 1; idx[o++] = r1 + j; idx[o++] = r1 + j + 1;
                    }
                }
            }
        }
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        this.perSub = perSub;
        this.vertsPerSub = S * prof.K;
    }

    /**
     * Rewrite the mesh for `strands` (model/strands restStrands) at time t.
     * `colors` = { a: THREE.Color, b: THREE.Color } in linear.
     */
    build(strands, p, t, colors) {
        const bundle = Math.max(1, Math.round(p.bundle));
        const prof = makeProfile(p.profile, p.radial, p.thickness);
        let S = Math.max(2, Math.round(p.samples));
        const subs = strands.length * bundle;
        const capped = subs * S * prof.K > MAX_VERTS;
        if (capped) S = Math.max(2, Math.floor(MAX_VERTS / Math.max(1, subs * prof.K)));
        this.allocate(subs, S, prof);

        const g = this.geometry;
        const P = g.attributes.position.array;
        const Nn = g.attributes.normal.array;
        const C = g.attributes.color.array;
        const U = g.attributes.uv.array;
        const s = this.sampler;
        const phase = loopPhase(p, t);
        const baseTwist = (Math.round(p.twistFlow || 0) * phase);
        const halfW = p.width * 0.5;
        let m = 0; // sub-strands written
        // Which strand (its index in `strands`) each written sub-strand is, for picking.
        this.slots = [];

        for (let si = 0; si < strands.length; si++) {
            const st = strands[si];
            if (st.hidden) continue;
            const win = strandWindow(p, st.rand);
            if (!win) continue;
            const pts = posePoints(st.points, p, t);
            const res = sampleCurve(pts, {
                kind: p.curve, tension: p.tension, count: S, from: win[0], to: win[1], up: [0, 1, 0],
            }, s);
            const R = st.rand;
            const sr = rng(hash(p.seed, st.hand ? 9000 + st.i : st.i, 0x5e11));
            const ph = [sr(), sr(), sr()];
            const wStrand = halfW * st.widthMul * (1 - Math.min(1, p.widthVar) * R.width);
            const twistTurns = p.twist + p.twistVar * (R.twist * 2 - 1);
            const ca = colors.a;
            const cb = colors.b;
            const cStrand = p.colorMode === 'strand' ? R.color : 0;
            const uOffset = R.phase * 37.0;

            for (let j = 0; j < bundle; j++) {
                const subR = bundle > 1 ? rng(hash(p.seed, st.hand ? 9000 + st.i : st.i, j, 0xb0d)) : null;
                const radius = subR ? p.bundleSpread * (0.35 + 0.65 * Math.sqrt(subR())) : 0;
                const ang0 = subR ? (2 * Math.PI * j) / bundle + subR() * 1.2 : 0;
                const wSub = subR ? p.bundleWidth * (0.6 + 0.8 * subR()) : 1;
                const rollSub = subR ? subR() * 6.283 : 0;
                const vBase = m * this.vertsPerSub;

                for (let k = 0; k < S; k++) {
                    const u = S > 1 ? k / (S - 1) : 0;
                    const f = win[0] + (win[1] - win[0]) * u;
                    const o = k * 3;
                    let cx = s.pos[o]; let cy = s.pos[o + 1]; let cz = s.pos[o + 2];
                    const nx = s.nrm[o]; const ny = s.nrm[o + 1]; const nz = s.nrm[o + 2];
                    const bx = s.bin[o]; const by = s.bin[o + 1]; const bz = s.bin[o + 2];

                    if (radius > 0) {
                        const fan = 1 - p.bundleFan + p.bundleFan * f;
                        const a = ang0 + 2 * Math.PI * p.bundleTwist * f;
                        const ox = Math.cos(a) * radius * fan;
                        const oy = Math.sin(a) * radius * fan;
                        cx += bx * ox + nx * oy;
                        cy += by * ox + ny * oy;
                        cz += bz * ox + nz * oy;
                    }

                    const w = wStrand * wSub * taperAt(u, p) * swellAt(f, p, ph, phase) * pinchAt(f, p);
                    const th = 2 * Math.PI * (R.roll + twistTurns * f + baseTwist) + rollSub;
                    const c = Math.cos(th);
                    const sn = Math.sin(th);
                    // The cross-section's axes, turned by the twist.
                    const ax = c * bx + sn * nx; const ay = c * by + sn * ny; const az = c * bz + sn * nz;
                    const qx = -sn * bx + c * nx; const qy = -sn * by + c * ny; const qz = -sn * bz + c * nz;

                    const along = f * res.length + uOffset;
                    const cm = p.colorMode === 'length' ? f : cStrand;
                    const cr = ca.r + (cb.r - ca.r) * cm;
                    const cg = ca.g + (cb.g - ca.g) * cm;
                    const cbb = ca.b + (cb.b - ca.b) * cm;

                    let v = vBase + k * prof.K;
                    for (let q = 0; q < prof.K; q++, v++) {
                        const px = prof.pts[q][0] * w;
                        const py = prof.pts[q][1] * w;
                        P[v * 3] = cx + ax * px + qx * py;
                        P[v * 3 + 1] = cy + ay * px + qy * py;
                        P[v * 3 + 2] = cz + az * px + qz * py;
                        const mx = prof.nrm[q][0];
                        const my = prof.nrm[q][1];
                        Nn[v * 3] = ax * mx + qx * my;
                        Nn[v * 3 + 1] = ay * mx + qy * my;
                        Nn[v * 3 + 2] = az * mx + qz * my;
                        C[v * 3] = cr; C[v * 3 + 1] = cg; C[v * 3 + 2] = cbb;
                        U[v * 2] = along;
                        U[v * 2 + 1] = prof.around[q] * halfW;
                    }
                }
                this.slots.push(si);
                m++;
            }
        }

        ['position', 'normal', 'color', 'uv'].forEach((k) => { g.attributes[k].needsUpdate = true; });
        g.setDrawRange(0, m * this.perSub);
        const drawnStrands = Math.round(m / bundle);
        this.stats = {
            strands: strands.length, drawn: drawnStrands, verts: m * this.vertsPerSub, tris: (m * this.perSub) / 3, capped,
        };
        return this.stats;
    }

    /** The strand (its index in the last build's `strands`) a picked vertex belongs to. */
    strandOfVertex(v) {
        return this.slots?.[Math.floor(v / this.vertsPerSub)] ?? -1;
    }

    dispose() {
        this.geometry.dispose();
    }
}
