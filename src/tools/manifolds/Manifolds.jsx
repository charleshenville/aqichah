import React, {
    useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Play, Pause, Download, Shuffle, StepBack, StepForward, Undo2, Redo2, Crosshair, Copy, Check, Upload, ChevronLeft, ChevronRight, Plus, Trash2, RotateCcw, Eye, EyeOff, Camera } from 'lucide-react';
import VfxNumberField from '../VfxNumberField';
import vfx from '../vfx.module.css';
import styles from './manifolds.module.css';
import {
    DEFAULTS, OBJECT_GROUPS, TRANSFORM_GROUP, SPIN_GROUP, EDGE_GROUPS, STAGE_GROUPS,
} from './params';
import { LOOKS, LOOK_KEEPS } from './looks';
import {
    Slider, Switch, Hint, Section, ParamGroup,
} from './controls';
import Stage from './engine/Stage';
import PointEditor from './engine/PointEditor';
import { outputSize, exportPng, exportMp4 } from './engine/exporter';
import { canEncodeMp4 } from '../../lib/mp4Writer';
import { restStrands, makeCache } from './model/strands';
import { isHandle } from './model/curves';
import {
    setPoint, resetPoint, resetStrand, setStrandLook, strandLookOf, addHandStrand, removeHandStrand,
    addHandPoint, removeHandPoint, bake, parseId,
} from './model/edits';
import {
    downloadPreset, readPresetFile,
} from './presets';

// Manifolds: confluences of swept splines (blades, ribbons, tubes) in
// chrome, glass or flat colour, with edge-detected lines over them. The
// geometry and look are in ./engine and ./model; this is the panel, the
// transport, the point editor's wiring and the loop.

const STEP = 1 / 30;
const fmt = (t) => `${t.toFixed(2)}s`;
const START_LOOK = 'aq';
const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

function loadTexture(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const tex = new THREE.Texture(img);
            tex.needsUpdate = true;
            resolve(tex);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't open ${file.name}`)); };
        img.src = url;
    });
}

const lookParams = (look, keep) => ({
    ...DEFAULTS,
    ...look.set,
    ...Object.fromEntries(LOOK_KEEPS.map((k) => [k, keep[k]])),
    edits: {},
    hand: [],
    strandLook: {},
});

// ---- Export dialog ------------------------------------------------------------------

const QUALITY = [[0.12, 'Draft'], [0.3, 'High'], [0.7, 'Max']];

function ExportDialog({
    run, loop, outW, outH, onClose,
}) {
    const [scale, setScale] = useState(1);
    const [quality, setQuality] = useState(0.3);
    const [fps, setFps] = useState(30);
    const [t0, setT0] = useState(0);
    const [t1, setT1] = useState(loop);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const cancel = useRef(false);
    const w = Math.round((outW * scale) / 2) * 2;
    const h = Math.round((outH * scale) / 2) * 2;

    const go = async () => {
        setBusy(true);
        setError('');
        cancel.current = false;
        try {
            const done = await run({
                scale, quality, fps, t0, t1,
            }, setProgress, () => cancel.current);
            if (done) onClose();
        } catch (e) {
            setError(e.message || String(e));
        }
        setBusy(false);
    };

    return (
        <div className={styles.modal} onClick={() => { if (!busy) onClose(); }} role="presentation">
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export MP4">
                <h2 className={styles.dialogTitle}>Export MP4</h2>
                <div className={vfx.vfx_row} style={{ gridTemplateColumns: '78px 1fr' }}>
                    <span className={vfx.vfx_label}>Size</span>
                    <select className={vfx.vfx_select} value={scale} disabled={busy} onChange={(e) => setScale(Number(e.target.value))}>
                        {[0.5, 1, 1.5, 2].map((sc) => <option key={sc} value={sc}>{`${sc}× · ${Math.round((outW * sc) / 2) * 2}×${Math.round((outH * sc) / 2) * 2}`}</option>)}
                    </select>
                </div>
                <div className={vfx.vfx_row} style={{ gridTemplateColumns: '78px 1fr' }}>
                    <span className={vfx.vfx_label}>Quality</span>
                    <select className={vfx.vfx_select} value={quality} disabled={busy} onChange={(e) => setQuality(Number(e.target.value))}>
                        {QUALITY.map(([q, l]) => <option key={q} value={q}>{l}</option>)}
                    </select>
                </div>
                <Slider label="Frame rate" value={fps} min={12} max={60} step={1} int onChange={(v) => setFps(Math.max(1, v))} disabled={busy} />
                <Slider label="From s" value={t0} min={0} max={loop} step={0.01} onChange={(v) => setT0(Math.max(0, v))} disabled={busy} />
                <Slider label="To s" value={t1} min={0} max={loop * 4} step={0.01} onChange={(v) => setT1(Math.max(t0 + 0.05, v))} disabled={busy} />
                <Hint>
                    {`${w}×${h}, ${(t1 - t0).toFixed(2)}s, ${Math.round((t1 - t0) * fps)} frames, rendered offline and frame-exact. Motion loops every ${loop}s. MP4 has no transparency.`}
                </Hint>
                {busy && (
                    <div className={vfx.vfx_progress} style={{ marginTop: 10 }}>
                        <div className={vfx.vfx_progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                )}
                {error && <Hint style={{ opacity: 1 }}><span className={styles.warn}>{error}</span></Hint>}
                <div className={styles.buttons}>
                    {!busy && <button type="button" className={vfx.vfx_select} style={{ textAlign: 'center' }} onClick={go}>Export</button>}
                    {busy && <button type="button" className={`${vfx.vfx_select} ${vfx.vfx_recActive}`} style={{ textAlign: 'center' }} onClick={() => { cancel.current = true; }}>Cancel</button>}
                    {!busy && <button type="button" className={vfx.vfx_select} style={{ textAlign: 'center' }} onClick={onClose}>Close</button>}
                </div>
            </div>
        </div>
    );
}

// ---- Points panel ---------------------------------------------------------------------

function PointsPanel({
    p, update, sel, setSel, editing, setEditing, showAll, setShowAll, rest, gen,
}) {
    const strand = rest.find((s) => s.id === sel.id) || null;
    const s = parseId(sel.id);
    const look = strandLookOf(p, sel.id);
    const n = strand ? strand.points.length : 0;
    const k = sel.point;
    const point = strand && k >= 0 ? strand.points[k] : null;
    const edited = s && !s.hand && p.edits[s.i];
    const editCount = Object.values(p.edits).reduce((a, e) => a + Object.keys(e).length, 0);
    const btn = `${vfx.vfx_select} ${styles.btn}`;

    const stepStrand = (d) => {
        if (!rest.length) return;
        const i = Math.max(0, rest.findIndex((x) => x.id === sel.id));
        const next = rest[(i + d + rest.length) % rest.length];
        setSel({ id: next.id, point: -1 });
    };
    const stepPoint = (d) => {
        if (!strand) return;
        setSel({ id: sel.id, point: ((k < 0 ? (d > 0 ? -1 : 0) : k) + d + n) % n });
    };
    const setCoord = (c, v) => {
        if (!point) return;
        const pos = point.slice();
        pos[c] = v;
        update(setPoint(p, gen, sel.id, k, pos));
    };

    return (
        <>
            <Switch label="Edit points (E)" value={editing} onChange={setEditing} />
            {editing && <Switch label="Markers on every strand" value={showAll} onChange={setShowAll} />}

            <div className={styles.strandHead}>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Previous strand" onClick={() => stepStrand(-1)}><ChevronLeft size={13} /></button>
                <span>
                    {strand
                        ? <span className={styles.strandName}>{s.hand ? `Hand-drawn ${s.i + 1}` : `Strand ${s.i + 1}`}</span>
                        : <span style={{ opacity: 0.6 }}>No strand selected</span>}
                    {strand && <span style={{ opacity: 0.5 }}>{` · ${n} points`}</span>}
                </span>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Next strand" onClick={() => stepStrand(1)}><ChevronRight size={13} /></button>
            </div>

            {strand && (
                <>
                    <Slider label="Width ×" value={look.width ?? 1} min={0} max={4} step={0.01} onChange={(v) => update(setStrandLook(p, sel.id, { width: v }))} />
                    <div className={styles.buttons2}>
                        <button type="button" className={btn} onClick={() => update(setStrandLook(p, sel.id, { hidden: !look.hidden }))}>
                            {look.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                            {look.hidden ? 'Show' : 'Hide'}
                        </button>
                        {s.hand
                            ? <button type="button" className={btn} onClick={() => { update(removeHandStrand(p, sel.id)); setSel({ id: null, point: -1 }); }}><Trash2 size={12} />Delete</button>
                            : <button type="button" className={btn} disabled={!edited} onClick={() => update(resetStrand(p, sel.id))}><RotateCcw size={12} />Reset</button>}
                    </div>

                    <div className={styles.strandHead}>
                        <button type="button" className={vfx.vfx_iconBtn} aria-label="Previous point" onClick={() => stepPoint(-1)}><ChevronLeft size={13} /></button>
                        <span>
                            {k >= 0
                                ? <span className={styles.strandName}>{`Point ${k + 1}${isHandle(p.curve, k) ? ' (handle)' : ''}`}</span>
                                : <span style={{ opacity: 0.6 }}>Pick a point</span>}
                        </span>
                        <button type="button" className={vfx.vfx_iconBtn} aria-label="Next point" onClick={() => stepPoint(1)}><ChevronRight size={13} /></button>
                    </div>
                    {point && (
                        <>
                            <div className={styles.xyz}>
                                {['X', 'Y', 'Z'].map((label, c) => (
                                    <React.Fragment key={label}>
                                        <span>{label}</span>
                                        <VfxNumberField value={Math.round(point[c] * 1000) / 1000} step={0.01} onCommit={(v) => setCoord(c, v)} />
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className={styles.buttons2}>
                                {s.hand ? (
                                    <>
                                        <button type="button" className={btn} onClick={() => update(addHandPoint(p, sel.id, k))}><Plus size={12} />Add after</button>
                                        <button type="button" className={btn} onClick={() => { update(removeHandPoint(p, sel.id, k)); setSel({ id: sel.id, point: Math.max(0, k - 1) }); }}><Trash2 size={12} />Remove</button>
                                    </>
                                ) : (
                                    <button type="button" className={btn} style={{ gridColumn: '1 / 3' }} disabled={!edited?.[k]} onClick={() => update(resetPoint(p, sel.id, k))}><RotateCcw size={12} />Reset point</button>
                                )}
                            </div>
                        </>
                    )}
                    <button
                        type="button"
                        className={btn}
                        style={{ width: '100%', marginBottom: 8 }}
                        onClick={() => {
                            const { patch, id } = addHandStrand(p, strand.points);
                            update(patch);
                            setSel({ id, point: -1 });
                        }}
                    >
                        <Copy size={12} />
                        Copy as hand-drawn
                    </button>
                </>
            )}

            <div className={vfx.vfx_sectionTitle} style={{ marginTop: 6 }}>All strands</div>
            <div className={styles.buttons3}>
                <button
                    type="button"
                    className={btn}
                    onClick={() => {
                        const { patch, id } = addHandStrand(p);
                        update(patch);
                        setSel({ id, point: -1 });
                        setEditing(true);
                    }}
                >
                    <Plus size={12} />
                    New
                </button>
                <button type="button" className={btn} disabled={!p.count} title="Turn every generated strand into a hand-drawn one (the Form stops moving them)" onClick={() => { update(bake(p, rest)); setSel({ id: null, point: -1 }); }}>Bake</button>
                <button type="button" className={btn} disabled={!editCount} onClick={() => update({ edits: {} })}>{`Reset ${editCount || ''}`}</button>
            </div>
            <Hint>
                Click a strand to select it, click a marker to pick a point, drag the arrows to move it. Generated strands keep your moves on top of the generator (change the Form and they stay); hand-drawn strands are yours alone. Bézier handles are orange. Undo with ⌘Z.
            </Hint>
        </>
    );
}

// ---- The tool -----------------------------------------------------------------------

function Manifolds() {
    const [p, setP] = useState(() => lookParams(LOOKS.find((l) => l.id === START_LOOK), DEFAULTS));
    // The controls stay open: no collapsing panel.
    const menuOpen = true;
    const [playing, setPlaying] = useState(true);
    const [open, setOpen] = useState({ Points: false, Presets: false });
    const [editing, setEditingState] = useState(false);
    const [showAll, setShowAllState] = useState(true);
    const [sel, setSelState] = useState({ id: null, point: -1 });
    const [stats, setStats] = useState({ drawn: 0, verts: 0, ms: 0, capped: false });
    const [glError, setGlError] = useState('');
    const [dialog, setDialog] = useState(false);
    const [pngScale, setPngScale] = useState(1);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [images, setImages] = useState({ env: '', bg: '' });
    const [message, setMessage] = useState('');
    const [presetName, setPresetName] = useState('');
    const [presetMsg, setPresetMsg] = useState('');
    const [, setHistoryVersion] = useState(0);

    const boxRef = useRef(null);
    const canvasRef = useRef(null);
    const rangeRef = useRef(null);
    const timeRef = useRef(null);
    const envFileRef = useRef(null);
    const bgFileRef = useRef(null);
    const presetFileRef = useRef(null);
    const stageRef = useRef(null);
    const editorRef = useRef(null);
    const orbitRef = useRef(null);
    const pRef = useRef(p);
    const clockRef = useRef({ t: 0, playing: true });
    const dirtyRef = useRef(true);
    const busyRef = useRef(false);
    const scrubRef = useRef(false);
    const downRef = useRef(null);
    const history = useRef({ past: [], future: [], last: 0 });
    const uiCache = useRef(makeCache());

    // ---- Parameters, with undo ------------------------------------------------------

    /** Change parameters: a patch object or a function of the current ones. Changes within half a second undo together. */
    const update = useCallback((patch) => {
        const prev = pRef.current;
        const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
        const h = history.current;
        const now = performance.now();
        if (now - h.last > 500) {
            h.past.push(prev);
            if (h.past.length > 200) h.past.shift();
            h.future = [];
            setHistoryVersion((v) => v + 1);
        }
        h.last = now;
        pRef.current = next;
        dirtyRef.current = true;
        setP(next);
    }, []);
    const set = useCallback((key, v) => update({ [key]: v }), [update]);

    const undo = useCallback((redo = false) => {
        const h = history.current;
        const from = redo ? h.future : h.past;
        const to = redo ? h.past : h.future;
        if (!from.length) return;
        to.push(pRef.current);
        const next = from.pop();
        h.last = 0;
        pRef.current = next;
        dirtyRef.current = true;
        setP(next);
        setHistoryVersion((v) => v + 1);
    }, []);

    const setSel = useCallback((s) => {
        setSelState(s);
        editorRef.current?.setSelection(s);
        dirtyRef.current = true;
    }, []);
    const setEditing = useCallback((on) => {
        setEditingState(on);
        if (on) setOpen((o) => ({ ...o, Points: true }));
        editorRef.current?.setEnabled(on);
        dirtyRef.current = true;
    }, []);
    const setShowAll = useCallback((on) => {
        setShowAllState(on);
        if (editorRef.current) editorRef.current.showAll = on;
        dirtyRef.current = true;
    }, []);

    // ---- Stage, editor, orbit and the loop ---------------------------------------------

    useEffect(() => {
        let stage;
        try {
            stage = new Stage(canvasRef.current);
        } catch (e) {
            setGlError(e.message || String(e));
            return undefined;
        }
        stageRef.current = stage;
        const orbit = new OrbitControls(stage.camera, canvasRef.current);
        orbit.target = stage.target;
        orbit.addEventListener('change', () => { dirtyRef.current = true; });
        orbitRef.current = orbit;
        const editor = new PointEditor(stage, {
            onPick: () => {},
            onMove: (id, k, pos) => {
                const cur = pRef.current;
                update(setPoint(cur, stage.manifold.cache.gen, id, k, pos));
            },
            onDragging: (on) => { orbit.enabled = !on; },
        });
        editorRef.current = editor;
        stage.beforeOverlay = (pp, t) => editor.update(pp, t);

        let raf = 0;
        let last = performance.now();
        let lastStats = 0;
        const tick = (now) => {
            raf = requestAnimationFrame(tick);
            const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
            last = now;
            if (busyRef.current || stage.lost) return;
            const c = clockRef.current;
            const pp = pRef.current;
            const loop = Math.max(0.05, pp.loop);
            if (c.playing && !scrubRef.current) {
                c.t = (c.t + dt) % loop;
                dirtyRef.current = true;
            }
            if (!dirtyRef.current) return;
            dirtyRef.current = false;
            const t0 = performance.now();
            const st = stage.render(pp, c.t, { outW: outputSize(pp).outW });
            const ms = performance.now() - t0;
            if (timeRef.current) timeRef.current.textContent = `${fmt(c.t)} / ${fmt(loop)}`;
            if (rangeRef.current && !scrubRef.current) {
                rangeRef.current.max = loop;
                rangeRef.current.value = c.t;
            }
            if (st && now - lastStats > 300) {
                lastStats = now;
                setStats({
                    drawn: st.drawn, verts: st.verts, ms: Math.round(ms), capped: st.capped,
                });
            }
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            orbit.dispose();
            editor.dispose();
            stage.dispose();
            stageRef.current = null;
            editorRef.current = null;
        };
    }, [update]);

    // Fit the canvas to the frame's aspect inside the stage box.
    const { outW, outH } = outputSize(p);
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return undefined;
        const fit = () => {
            const bw = box.clientWidth;
            const bh = box.clientHeight;
            const a = outW / outH;
            let w = bw;
            let h = bw / a;
            if (h > bh) { h = bh; w = bh * a; }
            const c = canvasRef.current;
            c.style.width = `${Math.round(w)}px`;
            c.style.height = `${Math.round(h)}px`;
            c.style.left = `${Math.round((bw - w) / 2)}px`;
            c.style.top = `${Math.round((bh - h) / 2)}px`;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const scale = Math.min(dpr, outW / Math.max(1, w));
            stageRef.current?.setSize(w * Math.max(scale, 0.5), h * Math.max(scale, 0.5));
            if (editorRef.current) editorRef.current.cssHeight = h;
            dirtyRef.current = true;
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(box);
        return () => ro.disconnect();
    }, [outW, outH, menuOpen]);


    // ---- Transport ------------------------------------------------------------------------

    const togglePlay = useCallback(() => {
        const c = clockRef.current;
        c.playing = !c.playing;
        setPlaying(c.playing);
    }, []);
    const seek = (t) => {
        clockRef.current.t = Math.max(0, t);
        dirtyRef.current = true;
    };
    const step = (d) => {
        clockRef.current.playing = false;
        setPlaying(false);
        const loop = Math.max(0.05, pRef.current.loop);
        seek(((clockRef.current.t + d * STEP) % loop + loop) % loop);
    };
    const resetView = () => {
        const s = stageRef.current;
        if (!s) return;
        s.camera.position.set(0, 0.3, 5.2);
        s.target.set(0, 0, 0);
        s.camera.lookAt(s.target);
        orbitRef.current?.update();
        dirtyRef.current = true;
    };

    // ---- Keys -----------------------------------------------------------------------------------

    useEffect(() => {
        const onKey = (e) => {
            if (isTyping(e.target) || busyRef.current) return;
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo(e.shiftKey);
            } else if (mod) {
                // leave the browser's own
            } else if (e.key === ' ') {
                e.preventDefault();
                togglePlay();
            } else if (e.key === 'e' || e.key === 'E') {
                setEditing(!editorRef.current?.enabled);
            } else if (e.key === 'Escape') {
                setSel({ id: null, point: -1 });
            } else if (e.key === '[' || e.key === ']') {
                step(e.key === '[' ? -1 : 1);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // ---- Picking ------------------------------------------------------------------------------

    const onPointerDown = (e) => { downRef.current = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = (e) => {
        const d = downRef.current;
        downRef.current = null;
        const ed = editorRef.current;
        if (!d || !ed || !editing || ed.dragging) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || ed.overGizmo()) return;
        const r = canvasRef.current.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const hit = ed.pick(ndc);
        if (hit) setSel(hit.id ? hit : { id: null, point: -1 });
    };

    // ---- Images ---------------------------------------------------------------------------------

    const openImage = async (file, which) => {
        if (!file) return;
        try {
            const tex = await loadTexture(file);
            const s = stageRef.current;
            if (which === 'env') {
                s.envs.setImage(tex);
                if (pRef.current.env !== 'image') update({ env: 'image' });
            } else {
                s.setBackdrop(tex);
                if (pRef.current.bgMode !== 'image') update({ bgMode: 'image' });
            }
            setImages((m) => ({ ...m, [which]: file.name }));
            dirtyRef.current = true;
        } catch (e) {
            setMessage(e.message);
        }
    };

    // ---- Presets ------------------------------------------------------------------------------

    const cameraState = () => {
        const s = stageRef.current;
        return s ? { position: s.camera.position.toArray(), target: s.target.toArray() } : null;
    };
    const applyPreset = (pr) => {
        update({ ...pr.params, ...Object.fromEntries(LOOK_KEEPS.map((k) => [k, pr.params[k] ?? pRef.current[k]])) });
        const s = stageRef.current;
        if (pr.camera && s) {
            s.camera.position.fromArray(pr.camera.position);
            s.target.fromArray(pr.camera.target);
            s.camera.lookAt(s.target);
            orbitRef.current?.update();
        }
        setSel({ id: null, point: -1 });
        setPresetName(pr.name);
        setPresetMsg('');
    };
    // ---- Export -------------------------------------------------------------------------------

    const name = `manifold-${p.form}-${p.seed}`;
    const doPng = async () => {
        busyRef.current = true;
        setBusy(true);
        try {
            await exportPng(stageRef.current, pRef.current, clockRef.current.t, pngScale, name);
        } catch (e) {
            setMessage(e.message || String(e));
        } finally {
            busyRef.current = false;
            setBusy(false);
            dirtyRef.current = true;
        }
    };
    const runMp4 = async (opts, onProgress, cancelled) => {
        busyRef.current = true;
        try {
            return await exportMp4(stageRef.current, pRef.current, { ...opts, name }, onProgress, cancelled);
        } finally {
            busyRef.current = false;
            dirtyRef.current = true;
        }
    };
    const copySettings = () => {
        const out = {};
        Object.keys(DEFAULTS).forEach((k) => {
            if (JSON.stringify(p[k]) !== JSON.stringify(DEFAULTS[k])) out[k] = p[k];
        });
        navigator.clipboard?.writeText(JSON.stringify(out, null, 1)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    };

    // ---- Render -------------------------------------------------------------------------------

    const toggle = (id, val) => setOpen((o) => ({ ...o, [id]: val }));
    const lookId = (LOOKS.find((l) => Object.entries(l.set).every(([k, v]) => p[k] === v)) || { id: '' }).id;
    const rest = useMemo(() => restStrands(p, uiCache.current), [p]);
    const gen = uiCache.current.gen || [];
    const h = history.current;
    const btn = `${vfx.vfx_select} ${styles.btn}`;
    const group = (g, children) => (
        <ParamGroup key={g.title} group={g} p={p} set={set} open={open} onToggle={toggle}>{children}</ParamGroup>
    );

    return (
        <div className={vfx.vfx}>
            <div ref={boxRef} className={`${styles.stage} ${menuOpen ? styles.stagePanel : ''}`}>
                <canvas
                    ref={canvasRef}
                    className={`${styles.canvas} ${p.bgMode === 'transparent' ? styles.checker : ''} ${editing ? styles.editing : ''}`}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    aria-label="Manifold preview: drag to orbit, scroll to zoom"
                />
                {editing && <div className={styles.badge}>EDIT POINTS · click a strand or marker · esc to deselect</div>}
                {glError && <div className={vfx.vfx_hint} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.8 }}>{glError}</div>}
            </div>

            <div className={`${styles.transport} ${menuOpen ? styles.transportPanel : ''}`}>
                <button type="button" className={vfx.vfx_iconBtn} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} disabled={busy}>
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Step back" onClick={() => step(-1)}><StepBack size={13} /></button>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Step forward" onClick={() => step(1)}><StepForward size={13} /></button>
                <input
                    ref={rangeRef}
                    type="range"
                    className={vfx.vfx_slider}
                    min={0}
                    max={p.loop}
                    step={0.001}
                    defaultValue={0}
                    aria-label="Time"
                    onPointerDown={() => { scrubRef.current = true; }}
                    onPointerUp={() => { scrubRef.current = false; }}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                />
                <span ref={timeRef} className={styles.time}>0.00s</span>
                <button type="button" className={`${vfx.vfx_iconBtn} ${editing ? styles.on : ''}`} aria-label="Edit points" title="Edit points (E)" onClick={() => setEditing(!editing)}><Crosshair size={14} /></button>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Reset view" title="Reset view" onClick={resetView}><Camera size={14} /></button>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Undo" title="Undo (⌘Z)" disabled={!h.past.length} onClick={() => undo(false)}><Undo2 size={14} /></button>
                <button type="button" className={vfx.vfx_iconBtn} aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!h.future.length} onClick={() => undo(true)}><Redo2 size={14} /></button>
                <span className={styles.stats}>
                    {`${stats.drawn} strands · ${(stats.verts / 1000).toFixed(0)}k verts · ${stats.ms}ms`}
                    {stats.capped ? ' · detail capped' : ''}
                </span>
            </div>


            <input ref={envFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { openImage(e.target.files?.[0], 'env'); e.target.value = ''; }} />
            <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { openImage(e.target.files?.[0], 'bg'); e.target.value = ''; }} />
            <input
                ref={presetFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try { applyPreset(await readPresetFile(f)); } catch (err) { setPresetMsg(err.message); }
                }}
            />

            {menuOpen && (
                <div className={vfx.vfx_panel}>
                    <div className={vfx.vfx_head}>
                        <span className={vfx.vfx_title}>Manifolds</span>
                    </div>

                    {/* Looks */}
                    <div className={vfx.vfx_section}>
                        <div className={vfx.vfx_sectionTitle}>Look</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px', gap: 6 }}>
                            <select
                                className={vfx.vfx_select}
                                value={lookId}
                                onChange={(e) => {
                                    const l = LOOKS.find((x) => x.id === e.target.value);
                                    if (l) { update(lookParams(l, pRef.current)); setSel({ id: null, point: -1 }); }
                                }}
                            >
                                {!lookId && <option value="">Custom</option>}
                                {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            <button type="button" className={btn} aria-label="New seed" title="New seed" onClick={() => set('seed', Math.floor(Math.random() * 10000))}><Shuffle size={12} /></button>
                        </div>
                        <Hint>{(LOOKS.find((l) => l.id === lookId) || {}).note || 'Your own. Save it as a preset to keep it.'}</Hint>
                    </div>

                    <Section id="Presets" title="presets" open={open} onToggle={toggle}>
                        <input
                            type="text"
                            className={vfx.vfx_text}
                            style={{ marginBottom: 8 }}
                            placeholder="name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            spellCheck={false}
                        />
                        <div className={styles.buttons2}>
                            <button type="button" className={btn} onClick={() => downloadPreset(presetName.trim() || 'preset', pRef.current, cameraState())}>download</button>
                            <button type="button" className={btn} onClick={() => presetFileRef.current.click()}>open</button>
                        </div>
                        {presetMsg && <div className={`${vfx.vfx_hint} ${styles.warn}`}>{presetMsg}</div>}
                    </Section>

                    <Section id="Points" title="Points" open={open} onToggle={toggle} extra={editing ? <span className={styles.on} style={{ fontSize: 10 }}>edit</span> : null}>
                        <PointsPanel
                            p={p}
                            update={update}
                            sel={sel}
                            setSel={setSel}
                            editing={editing}
                            setEditing={setEditing}
                            showAll={showAll}
                            setShowAll={setShowAll}
                            rest={rest}
                            gen={gen}
                        />
                    </Section>

                    {OBJECT_GROUPS.map((g) => group(g, g.title === 'Reflections' && p.env === 'image' ? (
                        <>
                            <button type="button" className={btn} style={{ width: '100%', marginBottom: 6 }} onClick={() => envFileRef.current.click()}><Upload size={12} />Reflect an image…</button>
                            <div className={styles.name}>{images.env || 'No image yet: an equirectangular panorama works best.'}</div>
                        </>
                    ) : null))}
                    {group(TRANSFORM_GROUP)}
                    {group(SPIN_GROUP)}
                    {EDGE_GROUPS.map((g) => group(g))}
                    {STAGE_GROUPS.map((g) => group(g, g.title === 'Frame' && p.bgMode === 'image' ? (
                        <>
                            <button type="button" className={btn} style={{ width: '100%', marginBottom: 6 }} onClick={() => bgFileRef.current.click()}><Upload size={12} />Backdrop image…</button>
                            <div className={styles.name}>{images.bg || 'No image yet.'}</div>
                        </>
                    ) : null))}

                    <Section id="Export" title="Export" open={open} onToggle={toggle}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                            <select className={vfx.vfx_select} value={pngScale} onChange={(e) => setPngScale(Number(e.target.value))}>
                                {[1, 2, 3].map((sc) => <option key={sc} value={sc}>{`${sc}× · ${outW * sc}×${outH * sc}`}</option>)}
                            </select>
                            <button type="button" className={btn} disabled={busy} onClick={doPng}><Download size={12} />PNG</button>
                        </div>
                        <div className={styles.buttons2}>
                            <button type="button" className={btn} disabled={busy || !canEncodeMp4()} onClick={() => setDialog(true)}><Download size={12} />MP4…</button>
                            <button type="button" className={btn} onClick={copySettings}>{copied ? <Check size={12} /> : <Copy size={12} />}Settings</button>
                        </div>
                        <Hint>
                            {message && <span className={styles.warn}>{`${message} `}</span>}
                            {`PNG of the frame shown (transparent with Backdrop: None). Frame ${outW}×${outH}.`}
                        </Hint>
                    </Section>
                </div>
            )}

            {dialog && (
                <ExportDialog run={runMp4} loop={p.loop} outW={outW} outH={outH} onClose={() => setDialog(false)} />
            )}
        </div>
    );
}

export default Manifolds;
