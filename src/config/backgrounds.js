// The quad field: a photo with white quads drawn over its bright parts,
// behind the landing page and the page heads.
//
// The photo is cut into a quad tree (a cell splits while its brightness
// varies more than `detail`). Every cell at least `threshold` bright gets a
// glyph from `ramp`: the brightness above the threshold is divided evenly
// between the steps, darkest first. Add, remove or reorder steps freely.
//
// Glyphs:
//   { type: 'outline' }   a hairline box
//   { type: 'dots' }      a box holding a halftone of dots (see `dot`)
//   { type: 'grid', n }   a box split n x n (2 = four quarters)
//   { type: 'fill' }      a solid block
//
// Sizes are in pixels of the photo at 1920 wide, so the tree belongs to the
// image: it scales and crops with it and never changes with the window or zoom.

import discography from '../assets/images/bg-discography.webp';
import landing from '../assets/images/landing-2560.webp';

export const QUAD_FIELD = {
    color: '#ffffff',
    opacity: 0.75,
    lineWidth: 1,
    threshold: 0.5, // 0-1: darker cells are left alone
    detail: 0.045, // 0-1: how much a cell may vary before it splits
    minCell: 8,
    maxCell: 128,
    gamma: 1,
    dot: { size: 3.2, pitch: 16 }, // the halftone: dot diameter and spacing
    ramp: [
        { type: 'outline' },
        { type: 'dots' },
        { type: 'grid', n: 2 },
        { type: 'fill' },
    ],
    // the photo under the quads
    base: '#584f6e', // the page colour under it
    imageOpacity: 0.9,
    imageBlend: 'luminosity', // a canvas composite: 'luminosity', 'source-over', 'multiply'...
    revealMs: 1400, // quads come on in random order
};

const PHOTO = { imageBlend: 'source-over', imageOpacity: 1};

export const BACKGROUNDS = {
    landing: { src: landing, focus: [0.5, 0.78], field: PHOTO },
    software: { src: discography, focus: [0.8, 0.5], field: PHOTO },
    discography: { src: discography, focus: [0.8, 0.5], field: PHOTO },
};
