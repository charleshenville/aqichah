import React, { useId } from 'react';
import DotMatrix from './DotMatrix';
import { AQ_DOTS, COLS, ROWS, DOT_RADIUS } from '../lib/aqGlyphs';

const DOTS = AQ_DOTS.map((d) => [d.x, d.y]);

/**
 * The dot-matrix "aq" (see DotMatrix for `reveal` and `lit`). `split`
 * (0-1 down the mark, or null) gives its resting colour a hard edge there:
 * `--dot-off-top` above, `--dot-off-bottom` below, so the part over one
 * background and the part over another can each read.
 */
function LedMark({ title = 'aq', split = null, ...rest }) {
    const id = useId().replace(/:/g, '');
    const y = -0.5 + (split ?? 0) * ROWS;
    return (
        <DotMatrix
            dots={DOTS}
            r={DOT_RADIUS}
            viewBox={`-0.5 -0.5 ${COLS} ${ROWS}`}
            title={title}
            style={split === null ? undefined : { '--dot-off': `url(#${id})` }}
            {...rest}
        >
            {split !== null && (
                <defs>
                    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y} y2={y + 0.001}>
                        <stop offset="0" style={{ stopColor: 'var(--dot-off-top)' }} />
                        <stop offset="1" style={{ stopColor: 'var(--dot-off-bottom)' }} />
                    </linearGradient>
                </defs>
            )}
        </DotMatrix>
    );
}

export default LedMark;
