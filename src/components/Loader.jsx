import React, { useEffect, useRef, useState } from 'react';
import Paper from './Paper';
import s from './loader.module.css';

const RATE = 8; // how fast the count chases what has loaded (per second)
const HOLD = 220; // ms at 100% before it fades
const FADE = 380; // ms (matches .leaving in loader.module.css)
const TIMEOUT = 10000; // ms: past this, stop waiting on whatever is still out
const FONT_WAIT = 1500; // ms the text stays hidden waiting for Bus Stop

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The Bus Stop font, as a task: the loader is set in it. */
export const loadFont = () => document.fonts?.load('1em "Bus Stop"', 'loading.0123456789%') ?? Promise.resolve();

/** An image, fetched and decoded, so the page draws it from cache. */
export const loadImage = (src) => () => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img.decode();
};

/**
 * The page over everything while the first page's pieces arrive: "loading"
 * with a ticking ellipsis and a percentage, in Bus Stop.
 *
 * `tasks` are functions returning promises (a failed one still counts as
 * done); the percentage is the share settled, eased. At 100% it calls
 * `onReady` (mount the page now) and fades out over it.
 */
function Loader({ tasks, onReady }) {
    const [pct, setPct] = useState(0);
    const [fontReady, setFontReady] = useState(false);
    const [phase, setPhase] = useState('loading'); // loading | leaving | gone
    const ready = useRef(onReady);
    ready.current = onReady;

    useEffect(() => {
        let live = true;
        const timers = [];
        const later = (fn, ms) => timers.push(setTimeout(() => live && fn(), ms));

        const show = () => setFontReady(true);
        loadFont().then(show, show);
        later(show, FONT_WAIT);

        let settled = 0;
        let target = tasks.length ? 0 : 100;
        tasks.forEach((task) => {
            Promise.resolve().then(task).catch(() => {}).then(() => {
                settled += 1;
                target = (settled / tasks.length) * 100;
            });
        });
        later(() => { target = 100; }, TIMEOUT);

        const snap = reducedMotion();
        let shown = 0;
        let last = performance.now();
        let raf = 0;
        const tick = (now) => {
            if (!live) return;
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            shown = snap ? target : shown + (target - shown) * (1 - Math.exp(-RATE * dt));
            if (target - shown < 0.5) shown = target;
            setPct(Math.floor(shown));
            if (shown < 100) {
                raf = requestAnimationFrame(tick);
                return;
            }
            later(() => {
                setPhase('leaving');
                ready.current?.();
                later(() => setPhase('gone'), FADE + 50);
            }, HOLD);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            live = false;
            cancelAnimationFrame(raf);
            timers.forEach(clearTimeout);
        };
    }, [tasks]);

    if (phase === 'gone') return null;
    return (
        <div
            className={`${s.loader} ${fontReady ? s.ready : ''} ${phase === 'leaving' ? s.leaving : ''}`}
            role="progressbar"
            aria-label="loading"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
        >
            <span className={s.word} aria-hidden="true">
                loading
                <span className={s.dots}>
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                </span>
            </span>
            <span className={s.count} aria-hidden="true">
                <span className={s.num}>{pct}</span>%
            </span>
            <Paper variant="fg" />
        </div>
    );
}

export default Loader;
