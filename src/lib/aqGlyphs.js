// The "aq" mark as a dot matrix, measured from the mockup: a 10 x 7 grid
// ('a' in columns 0-4, 'q' in 5-9, the q's tail in rows 5-6), dots 0.8 of
// the pitch across.

const A = ['.###.', '#...#', '#...#', '#..##', '.##.#'];
const Q = ['.###.', '#...#', '#...#', '#...#', '.####', '....#', '....#'];

export const DOT_RADIUS = 0.4; // in pitches
export const COLS = 10;
export const ROWS = 7;

/** Every lit dot as { x, y } in pitches (column, row). */
export const AQ_DOTS = (() => {
    const dots = [];
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < 5; col += 1) {
            if (A[row]?.[col] === '#') dots.push({ x: col, y: row });
            if (Q[row][col] === '#') dots.push({ x: col + 5, y: row });
        }
    }
    return dots;
})();
