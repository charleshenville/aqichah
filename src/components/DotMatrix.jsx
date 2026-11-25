import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LED } from '../config/landing';
import s from './dotMatrix.module.css';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A random order of n dots, as each dot's rank (0..n-1). */
function ranks(n) {
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    const rank = new Array(n);
    order.forEach((dot, k) => { rank[dot] = k; });
    return rank;
}

/**
 * Dots as LEDs, each its own circle. They only ever switch, one at a time
 * at even intervals in a random order: never a flicker.
 *
 *   reveal   on mount, every dot comes on over LED.duration (the landing)
 *   lit      true / false: dots go from off (the light purple) to on (white)
 *            and back, over LED.hover.duration, while it changes
 *
 * `dots` are [x, y] in the viewBox; `r` their radius.
 */
function DotMatrix({
    dots, r, viewBox, width, height, reveal = false, revealDuration = LED.duration, lit, title, className = '', style, children,
}) {
    const ref = useRef(null);
    const n = dots.length;
    const [rank, setRank] = useState(() => ranks(n));

    // A fresh order each time it switches, so it never repeats itself.
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        setRank(ranks(n));
    }, [lit, n]);

    useEffect(() => {
        if (!reveal || reducedMotion() || !ref.current?.animate) return undefined;
        const step = revealDuration / Math.max(1, n - 1);
        const order = ranks(n);
        const total = LED.delay + revealDuration + 1;
        const anims = Array.from(ref.current.querySelectorAll('circle')).map((c, i) => {
            const on = (LED.delay + order[i] * step) / total;
            return c.animate(
                [{ opacity: 0, offset: 0 }, { opacity: 0, offset: on }, { opacity: 1, offset: Math.min(1, on + 0.0001) }, { opacity: 1, offset: 1 }],
                { duration: total, fill: 'backwards' },
            );
        });
        return () => anims.forEach((a) => a.cancel());
    }, [reveal, n, revealDuration]);

    const step = LED.hover.duration / Math.max(1, n - 1);
    const switching = lit !== undefined;
    // Switching: each dot is an off circle with an on circle over it, and
    // the on one switches by opacity at its own delay (opacity always
    // transitions; a fill between a gradient and a colour would not).
    const circles = useMemo(() => {
        const plain = dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} />);
        if (!switching) return plain;
        return (
            <>
                <g className={s.off}>{plain}</g>
                <g className={s.on}>
                    {dots.map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r={r} style={{ transitionDelay: `${Math.round(rank[i] * step)}ms` }} />
                    ))}
                </g>
            </>
        );
    }, [dots, r, rank, step, switching]);

    return (
        <svg
            ref={ref}
            className={`${s.matrix} ${switching ? s.switching : ''} ${lit ? s.lit : ''} ${className}`}
            viewBox={viewBox}
            width={width}
            height={height}
            style={style}
            role="img"
            aria-label={title}
        >
            {children}
            {circles}
        </svg>
    );
}

export default DotMatrix;
