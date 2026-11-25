// Changes to a manifold's defining points, as patches to its parameters.
// Edits and hand-drawn strands are replaced, never mutated (the mesh cache
// and React both see a change by identity).
//
// A strand is addressed by its id: 'g7' (generated strand 7) or 'h0' (the
// first hand-drawn one). A generated strand's points are what the generator
// made plus an edit each; a hand-drawn strand's points are its own.
//
// Plain functions: no three, no React.

import { newHandStrand } from './generate';

export const parseId = (id) => (id ? { hand: id[0] === 'h', i: Number(id.slice(1)) } : null);

const round = (v) => Math.round(v * 1e5) / 1e5;

/** Move point k of strand `id` to `pos` (rest position). `gen` the generated strands. */
export function setPoint(p, gen, id, k, pos) {
    const s = parseId(id);
    if (!s) return {};
    if (s.hand) {
        const hand = p.hand.map((h, j) => (j === s.i ? { ...h, points: h.points.map((q, m) => (m === k ? pos.map(round) : q)) } : h));
        return { hand };
    }
    const base = gen[s.i]?.points[k];
    if (!base) return {};
    const d = [pos[0] - base[0], pos[1] - base[1], pos[2] - base[2]].map(round);
    const strand = { ...(p.edits[s.i] || {}) };
    if (d.every((x) => x === 0)) delete strand[k]; else strand[k] = d;
    const edits = { ...p.edits };
    if (Object.keys(strand).length) edits[s.i] = strand; else delete edits[s.i];
    return { edits };
}

/** Put point k of a generated strand back where the generator made it. */
export function resetPoint(p, id, k) {
    const s = parseId(id);
    if (!s || s.hand || !p.edits[s.i]) return {};
    const strand = { ...p.edits[s.i] };
    delete strand[k];
    const edits = { ...p.edits };
    if (Object.keys(strand).length) edits[s.i] = strand; else delete edits[s.i];
    return { edits };
}

export function resetStrand(p, id) {
    const s = parseId(id);
    if (!s || s.hand || !p.edits[s.i]) return {};
    const edits = { ...p.edits };
    delete edits[s.i];
    return { edits };
}

/** A generated strand's look (hidden, width) or a hand-drawn one's. */
export function setStrandLook(p, id, patch) {
    const s = parseId(id);
    if (!s) return {};
    if (s.hand) return { hand: p.hand.map((h, j) => (j === s.i ? { ...h, ...patch } : h)) };
    const look = { ...p.strandLook, [s.i]: { ...(p.strandLook[s.i] || {}), ...patch } };
    return { strandLook: look };
}

export const strandLookOf = (p, id) => {
    const s = parseId(id);
    if (!s) return {};
    return s.hand ? (p.hand[s.i] || {}) : (p.strandLook[s.i] || {});
};

/** A new hand-drawn strand: a copy of `from` (rest points) a little aside, or a fresh one. Returns { patch, id }. */
export function addHandStrand(p, from = null) {
    const n = Math.max(2, Math.round(p.anchors));
    const offset = Math.max(0.05, p.extent * 0.08);
    const points = from
        ? from.map((q) => [round(q[0] + offset), round(q[1] + offset), round(q[2])])
        : newHandStrand(p.curve, Math.min(n, 6), p.extent).map((q) => q.map(round));
    return { patch: { hand: [...p.hand, { points }] }, id: `h${p.hand.length}` };
}

export function removeHandStrand(p, id) {
    const s = parseId(id);
    if (!s || !s.hand) return {};
    return { hand: p.hand.filter((_, j) => j !== s.i) };
}

/**
 * Add a point to a hand-drawn strand after point k (or at the end): halfway to
 * the next, or carried on past the last. A Bézier strand takes three points
 * (handle, handle, anchor) so it stays a chain.
 */
export function addHandPoint(p, id, k = -1) {
    const s = parseId(id);
    if (!s || !s.hand) return {};
    const pts = p.hand[s.i].points;
    const n = pts.length;
    const bez = p.curve === 'bezier';
    const at = k < 0 || k >= n - 1 ? n - 1 : k;
    const a = pts[at];
    const b = at < n - 1 ? pts[at + 1] : null;
    const prev = pts[Math.max(0, at - 1)];
    const end = b ? a.map((v, c) => (v + b[c]) / 2) : a.map((v, c) => v + (v - prev[c]));
    const add = bez
        ? [a.map((v, c) => v + (end[c] - v) / 3), a.map((v, c) => v + ((end[c] - v) * 2) / 3), end]
        : [end];
    let insertAt = at + 1;
    if (bez) insertAt = Math.min(n, Math.ceil((at + 1) / 3) * 3 + 1);
    const points = [...pts.slice(0, insertAt), ...add.map((q) => q.map(round)), ...pts.slice(insertAt)];
    return { hand: p.hand.map((h, j) => (j === s.i ? { ...h, points } : h)) };
}

/** Remove point k from a hand-drawn strand (a Bézier anchor takes its handles with it). Keeps at least two. */
export function removeHandPoint(p, id, k) {
    const s = parseId(id);
    if (!s || !s.hand) return {};
    const pts = p.hand[s.i].points;
    let drop;
    if (p.curve === 'bezier') {
        if (pts.length <= 4) return {};
        const anchor = Math.round(k / 3) * 3;
        drop = anchor === 0 ? [0, 1, 2] : [anchor - 1, anchor, anchor + 1].filter((x) => x < pts.length);
        if (anchor >= pts.length - 1) drop = [pts.length - 3, pts.length - 2, pts.length - 1];
    } else {
        if (pts.length <= 2) return {};
        drop = [k];
    }
    const points = pts.filter((_, m) => !drop.includes(m));
    return { hand: p.hand.map((h, j) => (j === s.i ? { ...h, points } : h)) };
}

/**
 * Bake: every visible generated strand (with its edits) becomes a hand-drawn
 * one and the generator is set to none, so the Form can no longer move them.
 */
export function bake(p, rest) {
    const baked = rest.filter((st) => !st.hand).map((st) => ({
        points: st.points.map((q) => q.map(round)),
        ...(st.hidden ? { hidden: true } : {}),
        ...(st.widthMul !== 1 ? { width: st.widthMul } : {}),
    }));
    return {
        hand: [...baked, ...p.hand], count: 0, edits: {}, strandLook: {},
    };
}
