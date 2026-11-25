import React, { useEffect, useRef } from 'react';
import { QUAD_FIELD } from '../config/backgrounds';

// A photo with a white quad tree over its bright parts (config/backgrounds.js),
// filling its positioned parent.
//
// The tree belongs to the image: it is built once, in the image's own pixels
// (`REF` wide), and only ever drawn scaled and cropped with the photo. Sizes
// are in screen pixels (CSS size x devicePixelRatio), so browser zoom changes
// nothing. Cells sit on shared, pixel-snapped edges drawn with one line
// width, and the glyphs are drawn opaque on their own canvas (its opacity is
// CSS), so a shared edge is one line however many cells draw it.

const REF = 1920; // tree units: pixels of the image at this width
const SAMPLE = 2; // tree units per brightness sample

const decode = (src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img.decode().then(() => img);
};

/** Mean and spread of brightness over any rectangle, from summed-area tables. */
function analyse(img, o) {
    const iw = REF;
    const ih = Math.round((REF * img.naturalHeight) / img.naturalWidth);
    const aw = Math.ceil(iw / SAMPLE);
    const ah = Math.ceil(ih / SAMPLE);
    const c = document.createElement('canvas');
    c.width = aw;
    c.height = ah;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, aw, ah);
    const px = g.getImageData(0, 0, aw, ah).data;
    const W = aw + 1;
    const sum = new Float64Array(W * (ah + 1));
    const sq = new Float64Array(W * (ah + 1));
    for (let y = 0; y < ah; y += 1) {
        let row = 0;
        let rowSq = 0;
        for (let x = 0; x < aw; x += 1) {
            const i = (y * aw + x) * 4;
            let l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
            if (o.gamma !== 1) l **= o.gamma;
            row += l;
            rowSq += l * l;
            const k = (y + 1) * W + x + 1;
            sum[k] = sum[k - W] + row;
            sq[k] = sq[k - W] + rowSq;
        }
    }
    return { iw, ih, aw, ah, W, sum, sq };
}

/** The tree's drawn leaves as [x, y, size, step] in tree units. */
function buildTree(a, o) {
    const steps = o.ramp.length;
    const span = 1 - o.threshold;
    const out = [];
    const stat = (x, y, s) => {
        const x0 = Math.floor(x / SAMPLE);
        const y0 = Math.floor(y / SAMPLE);
        const x1 = Math.min(a.aw, Math.ceil((x + s) / SAMPLE));
        const y1 = Math.min(a.ah, Math.ceil((y + s) / SAMPLE));
        const n = (x1 - x0) * (y1 - y0);
        if (n <= 0) return null;
        const at = (t, xx, yy) => t[yy * a.W + xx];
        const box = (t) => at(t, x1, y1) - at(t, x0, y1) - at(t, x1, y0) + at(t, x0, y0);
        const mean = box(a.sum) / n;
        return { mean, sd: Math.sqrt(Math.max(0, box(a.sq) / n - mean * mean)) };
    };
    const visit = (x, y, s) => {
        if (x >= a.iw || y >= a.ih) return;
        const st = stat(x, y, s);
        if (!st) return;
        if (st.sd > o.detail && s / 2 >= o.minCell) {
            const k = s / 2;
            visit(x, y, k);
            visit(x + k, y, k);
            visit(x, y + k, k);
            visit(x + k, y + k, k);
            return;
        }
        if (st.mean < o.threshold) return;
        const step = span > 0 ? Math.min(steps - 1, Math.floor(((st.mean - o.threshold) / span) * steps)) : steps - 1;
        out.push(x, y, s, step);
    };
    for (let y = 0; y < a.ih; y += o.maxCell) for (let x = 0; x < a.iw; x += o.maxCell) visit(x, y, o.maxCell);
    return out;
}

/** Cover-fit of the image into w x h (device px) around `focus`. */
function cover(iw, ih, w, h, [fx, fy]) {
    const k = Math.max(w / iw, h / ih);
    return { k, ox: (w - iw * k) * fx, oy: (h - ih * k) * fy };
}

function QuadField({ src, focus = [0.5, 0.5], field, className = '' }) {
    const boxRef = useRef(null);
    const photoRef = useRef(null);
    const quadRef = useRef(null);
    const o = { ...QUAD_FIELD, ...field };

    useEffect(() => {
        const box = boxRef.current;
        const pc = photoRef.current;
        const qc = quadRef.current;
        const pg = pc.getContext('2d', { alpha: false });
        const qg = qc.getContext('2d');
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        let alive = true;
        let raf = 0;
        let img = null;
        let a = null;
        let leaves = null;
        let order = null;
        let revealed = 0; // how far the reveal has got
        let size = '';
        let drawRange = () => {};

        const paint = () => {
            if (!img) return;
            const r = box.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const W = Math.max(1, Math.round(r.width * dpr));
            const H = Math.max(1, Math.round(r.height * dpr));
            const key = `${W}x${H}`;
            if (key === size) return;
            size = key;
            pc.width = W;
            pc.height = H;
            qc.width = W;
            qc.height = H;

            const { k, ox, oy } = cover(a.iw, a.ih, W, H, focus);
            pg.fillStyle = o.base;
            pg.fillRect(0, 0, W, H);
            pg.globalCompositeOperation = o.imageBlend;
            pg.globalAlpha = o.imageOpacity;
            pg.drawImage(img, ox, oy, a.iw * k, a.ih * k);
            pg.globalCompositeOperation = 'source-over';
            pg.globalAlpha = 1;

            // one line width for every cell, in whole device pixels
            const lw = Math.max(1, Math.round(o.lineWidth * k));
            const half = lw % 2 ? 0.5 : 0;
            const X = (x) => Math.round(ox + x * k);
            const Y = (y) => Math.round(oy + y * k);
            const dot = Math.max(lw * 0.75, (o.dot.size * k) / 2);
            qg.clearRect(0, 0, W, H);
            qg.strokeStyle = o.color;
            qg.fillStyle = o.color;
            qg.lineWidth = lw;

            drawRange = (from, to) => {
                const stroke = new Path2D();
                const fill = new Path2D();
                for (let n = from; n < to; n += 1) {
                    const i = order[n] * 4;
                    const x = leaves[i];
                    const y = leaves[i + 1];
                    const s = leaves[i + 2];
                    const x0 = X(x);
                    const y0 = Y(y);
                    const x1 = X(x + s);
                    const y1 = Y(y + s);
                    if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue;
                    const glyph = o.ramp[leaves[i + 3]];
                    if (glyph.type === 'fill') {
                        fill.rect(x0, y0, x1 - x0, y1 - y0);
                        continue;
                    }
                    // the cell's edges, centred on the boundary it shares
                    stroke.rect(x0 + half, y0 + half, x1 - x0, y1 - y0);
                    if (glyph.type === 'grid') {
                        const m = Math.max(2, glyph.n || 2);
                        for (let j = 1; j < m; j += 1) {
                            const gx = X(x + (s * j) / m) + half;
                            const gy = Y(y + (s * j) / m) + half;
                            stroke.moveTo(gx, y0);
                            stroke.lineTo(gx, y1);
                            stroke.moveTo(x0, gy);
                            stroke.lineTo(x1, gy);
                        }
                    } else if (glyph.type === 'dots') {
                        // a fixed halftone: the same dot size and pitch in every cell
                        const m = Math.max(1, Math.floor(s / o.dot.pitch));
                        const p = s / m;
                        for (let j = 0; j < m; j += 1) {
                            for (let q = 0; q < m; q += 1) {
                                const cx = ox + (x + p * (q + 0.5)) * k;
                                const cy = oy + (y + p * (j + 0.5)) * k;
                                fill.moveTo(cx + dot, cy);
                                fill.arc(cx, cy, dot, 0, Math.PI * 2);
                            }
                        }
                    }
                }
                qg.stroke(stroke);
                qg.fill(fill);
            };
            drawRange(0, revealed);
        };

        const reveal = () => {
            const count = leaves.length / 4;
            if (reduced || !o.revealMs) {
                revealed = count;
                paint();
                return;
            }
            paint();
            const t0 = performance.now();
            const step = (now) => {
                if (!alive) return;
                const want = Math.min(count, Math.ceil((count * (now - t0)) / o.revealMs));
                if (want > revealed) {
                    drawRange(revealed, want);
                    revealed = want;
                }
                if (revealed < count) raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
        };

        decode(src).then((i) => {
            if (!alive) return;
            img = i;
            a = analyse(img, o);
            leaves = buildTree(a, o);
            const count = leaves.length / 4;
            order = new Uint32Array(count);
            for (let n = 0; n < count; n += 1) order[n] = n;
            for (let n = count - 1; n > 0; n -= 1) {
                const j = Math.floor(Math.random() * (n + 1));
                const t = order[n]; order[n] = order[j]; order[j] = t;
            }
            reveal();
        }).catch(() => {});

        // Repaint only when the size in screen pixels changes (zoom leaves it alone).
        const ro = new ResizeObserver(() => paint());
        ro.observe(box);
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, focus, field]);

    return (
        <div ref={boxRef} className={`quad-field ${className}`} aria-hidden="true">
            <canvas ref={photoRef} />
            <canvas ref={quadRef} style={{ opacity: o.opacity }} />
        </div>
    );
}

export default QuadField;
