import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Stage from '../tools/manifolds/engine/Stage';
import { DEFAULTS } from '../tools/manifolds/params';

const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A Manifolds stage with no backdrop: the manifold, its reflections and its
 * Lines & fill, over whatever is behind the canvas. `config` is shaped like
 * MANIFOLD in config/landing.js.
 *
 * Sizes are in screen pixels (CSS size x devicePixelRatio), which browser
 * zoom leaves alone, so zooming changes the page's text and never the
 * render. Draws only on screen and in a visible tab, at most `config.fps`.
 * With a mouse it turns toward the cursor, and winds up while the cursor is
 * over the manifold (a rough region of the screen it covers, made once).
 *
 * `floorRef` (with `config.anchor`) stands it on an element: its lowest
 * point goes `depth` of that element's height below the element's top edge
 * and `x` across the canvas, measured on screen, so it sits the same on any
 * window shape.
 */
function ManifoldView({
    config, floorRef = null, className = '', style,
}) {
    const canvasRef = useRef(null);
    // Bumped when the GPU drops the context and doesn't give it back (phones
    // do, under memory pressure or after a while in the background): a fresh
    // canvas, so a fresh context.
    const [gen, setGen] = useState(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        let stage;
        try {
            stage = new Stage(canvas);
        } catch (e) {
            canvas.style.display = 'none'; // no WebGL 2: leave the page as it is
            return undefined;
        }
        const params = {
            ...DEFAULTS, ...config.params, bgMode: 'transparent', fov: config.camera.fov, orbit: 0,
        };
        const portraitParams = { ...params, ...config.portrait };
        let base = params;
        let anchor = config.anchor;
        let regionStale = true; // placement and hover region are redone after a resize
        const shift = { x: 0, y: 0 }; // world units, from the anchor
        stage.camera.position.set(...config.camera.position);
        stage.target.set(...config.camera.target);
        stage.camera.lookAt(stage.target);

        const drift = Object.entries(config.drift || {});
        const ptr = config.pointer;
        const interactive = !!ptr && finePointer();
        const motion = { yaw: 0, pitch: 0, hover: 0 };
        const target = { yaw: 0, pitch: 0, over: false };
        let pointer = null; // last cursor position, client px

        const frame = (t) => {
            const p = { ...base, posX: base.posX + shift.x, posY: base.posY + shift.y };
            if (drift.length) {
                const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (config.driftSeconds || 30));
                drift.forEach(([key, [a, b]]) => { p[key] = base[key] + a + (b - a) * k; });
            }
            if (interactive) {
                p.rotY = base.rotY + motion.yaw;
                p.rotX = base.rotX + motion.pitch;
                p.swirl += motion.hover * ptr.hoverSwirl;
            }
            return p;
        };

        // Physical size: CSS pixels times the device ratio is the same at any
        // zoom. The render is scaled to a pixel budget from there.
        let phys = { w: 2, h: 2 };
        const resize = () => {
            regionStale = true;
            const box = canvas.getBoundingClientRect();
            const tall = box.height > box.width;
            base = config.portrait && tall ? portraitParams : params;
            anchor = (tall && config.anchorPortrait) || config.anchor;
            const dpr = window.devicePixelRatio || 1;
            phys = { w: Math.max(2, box.width * dpr), h: Math.max(2, box.height * dpr) };
            const budget = (!finePointer() && config.pixelBudgetTouch) || config.pixelBudget || 1.5e6;
            const k = Math.min(1, Math.sqrt(budget / (phys.w * phys.h)));
            stage.setSize(phys.w * k, phys.h * k);
        };
        resize();
        // resizing clears the canvas, so draw again at once (not only on the
        // next frame, which may not come: reduced motion, or paused)
        const ro = new ResizeObserver(() => { resize(); draw(); });
        ro.observe(canvas);
        // the floor moving (the bar growing with zoomed text) re-places it
        if (floorRef?.current) ro.observe(floorRef.current);

        // Where the manifold is on screen, roughly: a coarse grid of cells it
        // covers at rest, made once from a sample of its vertices (and again
        // when the canvas changes shape), widened a cell all round. Hovering is
        // then one lookup, and the region doesn't shift as the manifold moves.
        const GRID = { cols: 64, rows: 40 };
        let region = null;
        const v = new THREE.Vector3();
        const buildRegion = () => {
            const mesh = stage.manifold.mesh;
            const g = mesh.geometry;
            const pos = g.attributes.position;
            const idx = g.index;
            const n = idx ? Math.min(idx.count, g.drawRange.count) : pos.count;
            if (!n) return;
            const { cols, rows } = GRID;
            const raw = new Uint8Array(cols * rows);
            const step = Math.max(1, Math.floor(n / 8000));
            for (let k = 0; k < n; k += step) {
                v.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mesh.matrixWorld).project(stage.view);
                const cx = Math.floor((v.x * 0.5 + 0.5) * cols);
                const cy = Math.floor((0.5 - v.y * 0.5) * rows);
                if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) raw[cy * cols + cx] = 1;
            }
            const cells = new Uint8Array(cols * rows);
            for (let y = 0; y < rows; y += 1) {
                for (let x = 0; x < cols; x += 1) {
                    if (!raw[y * cols + x]) continue;
                    for (let dy = -1; dy <= 1; dy += 1) {
                        for (let dx = -1; dx <= 1; dx += 1) {
                            const xx = x + dx;
                            const yy = y + dy;
                            if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) cells[yy * cols + xx] = 1;
                        }
                    }
                }
            }
            region = cells;
        };
        // The manifold's lowest point on screen (CSS px in the canvas).
        const lowest = () => {
            const mesh = stage.manifold.mesh;
            const g = mesh.geometry;
            const pos = g.attributes.position;
            const idx = g.index;
            const n = idx ? Math.min(idx.count, g.drawRange.count) : pos.count;
            const box = canvas.getBoundingClientRect();
            let best = null;
            const step = Math.max(1, Math.floor(n / 8000));
            for (let k = 0; k < n; k += step) {
                v.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mesh.matrixWorld).project(stage.view);
                const y = (0.5 - v.y * 0.5) * box.height;
                if (!best || y > best.y) best = { x: (v.x * 0.5 + 0.5) * box.width, y };
            }
            return best;
        };
        // Move it so its lowest point lands where the anchor says (twice:
        // perspective makes one step approximate).
        const place = (t) => {
            const floor = floorRef?.current;
            if (!anchor || !floor) return;
            const box = canvas.getBoundingClientRect();
            const fb = floor.getBoundingClientRect();
            const tx = anchor.x * box.width;
            const ty = fb.top - box.top + anchor.depth * fb.height;
            const dist = Math.abs(config.camera.position[2] - base.posZ);
            const perPx = (2 * Math.tan((config.camera.fov * Math.PI) / 360) * dist) / box.height;
            for (let i = 0; i < 2; i += 1) {
                stage.render(frame(t), t, { overlay: false, outW: phys.w / (config.lineScale || 1.5) });
                const low = lowest();
                if (!low) return;
                shift.x += (tx - low.x) * perPx;
                shift.y -= (ty - low.y) * perPx;
            }
        };

        const overManifold = () => {
            if (!pointer || !region) return false;
            const box = canvas.getBoundingClientRect();
            const cx = Math.floor(((pointer[0] - box.left) / box.width) * GRID.cols);
            const cy = Math.floor(((pointer[1] - box.top) / box.height) * GRID.rows);
            if (cx < 0 || cy < 0 || cx >= GRID.cols || cy >= GRID.rows) return false;
            return region[cy * GRID.cols + cx] === 1;
        };
        let over = false;

        const onMove = (e) => {
            pointer = [e.clientX, e.clientY];
            over = overManifold();
            const box = canvas.getBoundingClientRect();
            const nx = Math.max(-1, Math.min(1, ((e.clientX - (box.left + box.width / 2)) / window.innerWidth) * 2));
            const ny = Math.max(-1, Math.min(1, ((e.clientY - (box.top + box.height / 2)) / window.innerHeight) * 2));
            target.yaw = nx * ptr.yaw;
            target.pitch = ny * ptr.pitch;
        };
        const onLeave = () => {
            pointer = null;
            over = false;
            target.yaw = 0;
            target.pitch = 0;
        };
        if (interactive) {
            window.addEventListener('pointermove', onMove, { passive: true });
            document.documentElement.addEventListener('pointerleave', onLeave);
        }

        const reduced = reducedMotion();
        const interval = 1000 / (config.fps || 30);
        let visible = true;
        let raf = 0;
        let last = 0;
        let t = 0;
        let prev = performance.now();
        const draw = () => {
            if (stage.lost) return;
            stage.render(frame(t), t, { overlay: false, outW: phys.w / (config.lineScale || 1.5) });
            if (regionStale) {
                // measured at rest: no turn, no wind-up
                regionStale = false;
                const keep = { ...motion };
                Object.assign(motion, { yaw: 0, pitch: 0, hover: 0 });
                place(t);
                stage.render(frame(t), t, { overlay: false, outW: phys.w / (config.lineScale || 1.5) });
                if (interactive) buildRegion();
                Object.assign(motion, keep);
                stage.render(frame(t), t, { overlay: false, outW: phys.w / (config.lineScale || 1.5) });
            }
        };

        const tick = (now) => {
            raf = requestAnimationFrame(tick);
            if (now - last < interval) return;
            last = now - ((now - last) % interval);
            const dt = Math.min(0.1, (now - prev) / 1000);
            prev = now;
            t += dt;
            if (interactive) {
                const a = 1 - Math.exp(-dt * ptr.ease);
                motion.yaw += (target.yaw - motion.yaw) * a;
                motion.pitch += (target.pitch - motion.pitch) * a;
                motion.hover += ((over ? 1 : 0) - motion.hover) * (1 - Math.exp(-dt * ptr.hoverEase));
            }
            draw();
        };
        const sync = () => {
            const run = visible && !document.hidden && !reduced;
            if (run && !raf) {
                prev = performance.now();
                raf = requestAnimationFrame(tick);
            } else if (!run && raf) {
                cancelAnimationFrame(raf);
                raf = 0;
            }
        };
        draw();

        let lostTimer = 0;
        const onLost = () => {
            clearTimeout(lostTimer);
            lostTimer = setTimeout(() => setGen((g) => g + 1), 1200);
        };
        const onRestored = () => {
            clearTimeout(lostTimer);
            regionStale = true;
            draw();
        };
        canvas.addEventListener('webglcontextlost', onLost);
        canvas.addEventListener('webglcontextrestored', onRestored);

        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
        io.observe(canvas);
        document.addEventListener('visibilitychange', sync);
        sync();

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(lostTimer);
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
            io.disconnect();
            ro.disconnect();
            document.removeEventListener('visibilitychange', sync);
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            stage.dispose();
        };
    }, [config, floorRef, gen]);

    return <canvas key={gen} ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}

export default ManifoldView;
