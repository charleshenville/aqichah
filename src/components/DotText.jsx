import React, { useMemo } from 'react';
import DotMatrix from './DotMatrix';
import FONT from '../lib/busStopDots.json';

// Bus Stop, rebuilt as dots so each one can switch on its own. Sized in em
// of the parent: the baseline sits `descent` em above the svg's bottom edge.
const { upm, r: R, glyphs } = FONT;
const all = Object.values(glyphs).flatMap((g) => g.dots);
const TOP = Math.max(...all.map(([, y]) => y)) + R;
const BOTTOM = Math.min(...all.map(([, y]) => y)) - R;
export const DESCENT = -BOTTOM / upm; // em below the baseline
const TRACK = -0.02 * upm; // letter-spacing

function layout(text) {
    const dots = [];
    let x = 0;
    Array.from(text.toLowerCase()).forEach((ch) => {
        const g = glyphs[ch] || glyphs[' '];
        g.dots.forEach(([dx, dy]) => dots.push([x + dx, TOP - dy]));
        x += g.adv + TRACK;
    });
    return { dots, width: x - TRACK };
}

function DotText({ text, ...rest }) {
    const { dots, width } = useMemo(() => layout(text), [text]);
    const h = TOP - BOTTOM;
    return (
        <DotMatrix
            dots={dots}
            r={R}
            viewBox={`0 0 ${width} ${h}`}
            title={text}
            style={{ width: `${width / upm}em`, height: `${h / upm}em`, display: 'block' }}
            {...rest}
        />
    );
}

export default DotText;
