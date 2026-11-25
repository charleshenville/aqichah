// Every Manifolds parameter, in the compositor's own definition format
// (model/schema.js): { key, label, type, min, max, step, def, rebuilds, when }.
// The tool's panel is drawn from these groups, and the compositor will spread
// the same groups into its schema, so a parameter is one flat key with a
// plain value that a controller link can drive.
//
//   OBJECT_GROUPS   the manifold itself: its form, curves, cross-section,
//                   motion, material, reflections and holes. The compositor's
//                   placed object (with TRANSFORM_GROUP and SPIN_GROUP, which
//                   it has its own of).
//   EDGE_GROUPS     the Lines & fill post effect (engine/EdgeFx.js): a
//                   compositor effect on its own.
//   STAGE_GROUPS    the tool's own frame, camera, light and backdrop; in the
//                   compositor these are the project's.
//
// Beside the parameters an object carries two pieces of data no controller
// touches (as a Spline carries its `points`):
//   edits   { [strand]: { [point]: [dx, dy, dz] } }  moves made to generated
//           strands' defining points, on top of what the generator made
//   hand    [{ points: [[x, y, z], ...], hidden }]  strands drawn by hand
//   strandLook { [strand]: { hidden, width } }  a generated strand hidden or
//           made wider or thinner
//
// Time-dependent things are pure functions of the time and `loop`, so the
// preview and an export agree frame for frame.
//
// Plain data: no three, no React.

import { CURVE_KINDS } from './model/curves';

const num = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'number', min, max, step, def, ...extra });
const bool = (key, label, def, extra = {}) => ({ key, label, type: 'bool', def, ...extra });
const color = (key, label, def, extra = {}) => ({ key, label, type: 'color', def, ...extra });
const select = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, def, ...extra });

export const FORMS = [
    ['confluence', 'Confluence'],
    ['burst', 'Burst'],
    ['sheaf', 'Sheaf'],
    ['vortex', 'Vortex'],
    ['flow', 'Flow'],
];
export const PROFILES = [['blade', 'Blade'], ['ribbon', 'Ribbon'], ['tube', 'Tube']];
export const ENVS = [['studio', 'Studio'], ['sky', 'Sky'], ['stripes', 'Bands'], ['room', 'Room'], ['image', 'Image']];

const aimed = (p) => p.form === 'burst' || p.form === 'sheaf' || p.form === 'flow';
const isForm = (...f) => (p) => f.includes(p.form);
const notSolid = (p) => p.colorMode !== 'solid';

export const OBJECT_GROUPS = [
    {
        title: 'Form',
        hint: 'How the strands are laid out. Every strand is random from the seed and its own number, so more strands keep the ones already there.',
        params: [
            select('form', 'Form', FORMS, 'confluence'),
            num('count', 'Strands', 0, 400, 1, 24, { rebuilds: true }),
            num('anchors', 'Points each', 2, 16, 1, 5, { rebuilds: true }),
            num('seed', 'Seed', 0, 9999, 1, 7, { rebuilds: true }),
            num('extent', 'Size', 0.1, 10, 0.01, 2),
            num('spread', 'Spread', 0, 1, 0.01, 0.6),
            num('aimYaw', 'Aim (yaw °)', -180, 180, 1, 0, { when: aimed }),
            num('aimPitch', 'Aim (pitch °)', -90, 90, 1, 20, { when: aimed }),
            bool('twoSided', 'Both ways', false, { when: isForm('burst') }),
            num('core', 'Core', 0, 2, 0.01, 0.25),
            num('swirl', 'Swirl (turns)', -3, 3, 0.01, 0.35),
            num('curl', 'Bend', -2, 2, 0.01, 0.5),
            num('chaos', 'Chaos', 0, 1, 0.01, 0.15),
            num('lengthVar', 'Length var', 0, 1, 0.01, 0.4),
            num('flatten', 'Flatten', 0, 1, 0.01, 0.3),
        ],
    },
    {
        title: 'Curve',
        hint: 'Through points passes through every defining point (tension 0.5 never loops). Bézier strands have two handles between anchors; B-spline is pulled toward its points, the smoothest.',
        params: [
            select('curve', 'Curve', CURVE_KINDS, 'catmull'),
            num('tension', 'Tension', 0, 1, 0.01, 0.5, { when: (p) => p.curve === 'catmull' }),
            num('handleLength', 'Handle length', 0, 1.5, 0.01, 0.38, { when: (p) => p.curve === 'bezier' }),
            num('handleSkew', 'Handle skew', 0, 1, 0.01, 0, { when: (p) => p.curve === 'bezier' }),
            num('samples', 'Detail', 8, 600, 1, 160, { rebuilds: true }),
            num('trimStart', 'Start', 0, 1, 0.001, 0),
            num('trimEnd', 'End', 0, 1, 0.001, 1),
            num('trimStagger', 'Stagger', 0, 1, 0.01, 0),
            num('slide', 'Slide', -1, 1, 0.001, 0),
        ],
    },
    {
        title: 'Cross-section',
        hint: 'Blades are lens-shaped with sharp edges, ribbons are open sheets (thickness cups them), tubes are ellipses (thickness flattens them).',
        params: [
            select('profile', 'Shape', PROFILES, 'blade', { rebuilds: true }),
            num('radial', 'Sides', 2, 32, 1, 8, { rebuilds: true }),
            num('width', 'Width', 0.001, 2, 0.001, 0.22),
            num('thickness', 'Thickness', 0, 1, 0.01, 0.35),
            num('widthVar', 'Width var', 0, 1, 0.01, 0.6),
            num('taperIn', 'Taper in', 0, 1, 0.01, 0.15),
            num('taperOut', 'Taper out', 0, 1, 0.01, 0.6),
            num('taperShape', 'Taper shape', 0.2, 4, 0.01, 1.4),
            num('twist', 'Twist (turns)', -6, 6, 0.01, 0.5),
            num('twistVar', 'Twist var', 0, 3, 0.01, 0.5),
            num('swell', 'Swell', 0, 2, 0.01, 0.5),
            num('swellScale', 'Swell frequency', 0.2, 20, 0.01, 3),
            num('pinch', 'Pinch', 0, 1, 0.01, 0),
            num('pinchCount', 'Pinches', 1, 24, 1, 4, { when: (p) => p.pinch > 0 }),
        ],
    },
    {
        title: 'Bundles',
        hint: 'Each strand drawn as several thinner ones around it, fanning apart along its length.',
        collapsed: true,
        params: [
            num('bundle', 'Per strand', 1, 12, 1, 1, { rebuilds: true }),
            num('bundleSpread', 'Spread', 0, 1, 0.001, 0.08, { when: (p) => p.bundle > 1 }),
            num('bundleFan', 'Fan', 0, 1, 0.01, 0.5, { when: (p) => p.bundle > 1 }),
            num('bundleTwist', 'Wind (turns)', -4, 4, 0.01, 0.5, { when: (p) => p.bundle > 1 }),
            num('bundleWidth', 'Width', 0.05, 1.5, 0.01, 0.45, { when: (p) => p.bundle > 1 }),
        ],
    },
    {
        title: 'Motion',
        hint: 'Cycles are whole numbers per loop, so everything loops seamlessly.',
        params: [
            num('loop', 'Loop (s)', 0.5, 60, 0.5, 8),
            num('wobble', 'Wobble', 0, 2, 0.01, 0.12),
            num('wobbleScale', 'Wobble size', 0.05, 5, 0.01, 0.6),
            num('wobbleCycles', 'Wobble cycles', 0, 8, 1, 1),
            num('breathe', 'Breathe', 0, 1, 0.01, 0),
            num('breatheCycles', 'Breathe cycles', 0, 8, 1, 1, { when: (p) => p.breathe > 0 }),
            num('twistFlow', 'Twist flow', -8, 8, 1, 0),
            num('swellFlow', 'Swell flow', -8, 8, 1, 0),
            num('holeFlow', 'Hole flow', -8, 8, 1, 0, { when: (p) => p.holes > 0 }),
        ],
    },
    {
        title: 'Material',
        params: [
            select('colorMode', 'Colour', [['solid', 'Solid'], ['length', 'Along'], ['strand', 'Per strand']], 'length'),
            color('colorA', 'Colour A', '#e6e8ec'),
            color('colorB', 'Colour B', '#8c96a3', { when: notSolid }),
            num('metalness', 'Metal', 0, 1, 0.01, 1),
            num('roughness', 'Roughness', 0, 1, 0.01, 0.06),
            num('clearcoat', 'Clearcoat', 0, 1, 0.01, 0),
            num('iridescence', 'Iridescence', 0, 1, 0.01, 0),
            num('transmission', 'Glass', 0, 1, 0.01, 0),
            num('ior', 'IOR', 1, 2.33, 0.01, 1.5, { when: (p) => p.transmission > 0 }),
            num('envIntensity', 'Reflections', 0, 4, 0.01, 1),
            color('emissive', 'Glow colour', '#ffffff'),
            num('emissiveIntensity', 'Glow', 0, 10, 0.01, 0),
            num('opacity', 'Opacity', 0, 1, 0.01, 1),
        ],
    },
    {
        title: 'Reflections',
        hint: 'What the metal reflects. Studio and bands give hard graphic highlights; sky the blue-and-white of the references.',
        params: [
            select('env', 'Reflect', ENVS, 'studio', { rebuilds: true }),
            num('envRotate', 'Turn (°)', 0, 360, 1, 0, { rebuilds: true }),
            num('envTilt', 'Tilt (°)', -90, 90, 1, 0, { rebuilds: true }),
            num('envBands', 'Bands', 1, 24, 1, 6, { rebuilds: true, when: (p) => p.env === 'stripes' || p.env === 'studio' }),
            color('envColorA', 'Sky', '#2f6fd6', { rebuilds: true, when: (p) => p.env === 'sky' || p.env === 'stripes' }),
            color('envColorB', 'Horizon', '#f3f5f8', { rebuilds: true, when: (p) => p.env === 'sky' || p.env === 'stripes' }),
        ],
    },
    {
        title: 'Holes',
        hint: 'A cellular lattice cut through the surface. The lines effect outlines every hole.',
        collapsed: true,
        params: [
            num('holes', 'Amount', 0, 1, 0.01, 0),
            num('holeScale', 'Cell size', 0.005, 1, 0.001, 0.06, { when: (p) => p.holes > 0 }),
            num('holeJitter', 'Irregular', 0, 1, 0.01, 1, { when: (p) => p.holes > 0 }),
        ],
    },
];

export const TRANSFORM_GROUP = {
    title: 'Transform',
    collapsed: true,
    params: [
        num('posX', 'Pos X', -10, 10, 0.005, 0),
        num('posY', 'Pos Y', -10, 10, 0.005, 0),
        num('posZ', 'Pos Z', -10, 10, 0.005, 0),
        num('rotX', 'Rot X', -180, 180, 0.5, 0),
        num('rotY', 'Rot Y', -180, 180, 0.5, 0),
        num('rotZ', 'Rot Z', -180, 180, 0.5, 0),
        num('scale', 'Scale', 0.01, 8, 0.01, 1),
    ],
};

export const SPIN_GROUP = {
    title: 'Spin',
    collapsed: true,
    hint: 'Degrees a second. 360 ÷ the loop length turns once a loop.',
    params: [
        num('spinX', 'About X (°/s)', -720, 720, 0.5, 0),
        num('spinY', 'About Y (°/s)', -720, 720, 0.5, 0),
        num('spinZ', 'About Z (°/s)', -720, 720, 0.5, 0),
    ],
};

// ---- Lines & fill (the post effect) ---------------------------------------------------

const edging = (p) => !!p.edgeOn;
const fillIs = (...m) => (p) => m.includes(p.fillMode);

export const EDGE_GROUPS = [
    {
        title: 'Lines',
        hint: 'Edge detection on the render: silhouettes, folds (depth and normals, where the 3D is known) and changes in brightness. Widths are in output pixels.',
        params: [
            bool('edgeOn', 'On', true),
            color('edgeColor', 'Colour', '#111111', { when: edging }),
            num('edgeWidth', 'Width (px)', 0.25, 12, 0.05, 1.4, { when: edging }),
            num('edgeOpacity', 'Opacity', 0, 1, 0.01, 1, { when: edging }),
            num('edgeSilhouette', 'Outline', 0, 1, 0.01, 1, { when: edging }),
            num('edgeDepth', 'Depth', 0, 4, 0.01, 1, { when: edging }),
            num('edgeNormal', 'Folds', 0, 4, 0.01, 0.6, { when: edging }),
            num('edgeLuma', 'Brightness', 0, 4, 0.01, 0, { when: edging }),
            num('edgeThreshold', 'Threshold', 0, 1, 0.005, 0.2, { when: edging }),
            num('edgeSoft', 'Softness', 0, 1, 0.01, 0.15, { when: edging }),
            num('edgeJitter', 'Wobble (px)', 0, 8, 0.05, 0, { when: edging }),
            num('edgeBreakup', 'Breakup', 0, 1, 0.01, 0, { when: edging }),
            num('edgeBoil', 'Boil (fps)', 0, 24, 1, 0, { when: (p) => edging(p) && (p.edgeJitter > 0 || p.edgeBreakup > 0) }),
        ],
    },
    {
        title: 'Fill',
        hint: 'What the surface itself becomes: the render as it is, one flat colour (a cut-out), ink (reflections thresholded to two tones, like a photocopy) or a few posterised tones.',
        params: [
            select('fillMode', 'Fill', [['render', 'Render'], ['flat', 'Flat'], ['ink', 'Ink'], ['tone', 'Tones']], 'render'),
            color('fillColor', 'Paper', '#ffffff', { when: fillIs('flat', 'ink', 'tone') }),
            color('inkColor', 'Ink', '#151515', { when: fillIs('ink', 'tone') }),
            num('inkThreshold', 'Threshold', 0, 1, 0.005, 0.42, { when: fillIs('ink') }),
            num('inkSoft', 'Softness', 0, 0.5, 0.005, 0.02, { when: fillIs('ink') }),
            num('toneLevels', 'Tones', 2, 8, 1, 3, { when: fillIs('tone') }),
            num('toneHue', 'Keep colour', 0, 1, 0.01, 0, { when: fillIs('tone') }),
            num('fillMix', 'Mix', 0, 1, 0.01, 1, { when: fillIs('flat', 'ink', 'tone') }),
        ],
    },
];

// ---- The tool's stage ---------------------------------------------------------------------

export const ASPECTS = [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:4', '3:4'], ['21:9', '21:9']];

export const STAGE_GROUPS = [
    {
        title: 'Frame',
        params: [
            select('aspect', 'Aspect', ASPECTS, '4:5'),
            num('outLong', 'Long side (px)', 256, 4096, 2, 1600),
            select('bgMode', 'Backdrop', [['color', 'Colour'], ['image', 'Image'], ['transparent', 'None']], 'color'),
            color('bgColor', 'Colour', '#ecebe7', { when: (p) => p.bgMode !== 'transparent' }),
            num('exposure', 'Exposure', -3, 3, 0.01, 0),
            select('toneMap', 'Tone map', [['aces', 'Filmic'], ['clip', 'Clip']], 'aces'),
        ],
    },
    {
        title: 'Camera & light',
        collapsed: true,
        params: [
            num('fov', 'Lens (° fov)', 5, 100, 0.5, 35),
            num('orbit', 'Orbit (°/s)', -180, 180, 0.5, 0),
            num('keyLight', 'Key light', 0, 10, 0.01, 1.2),
            num('keyYaw', 'Key from (°)', -180, 180, 1, 40),
            num('keyPitch', 'Key height (°)', -90, 90, 1, 50),
        ],
    },
];

// ---- Defaults ---------------------------------------------------------------------------------

const defaultsOf = (groups) => Object.fromEntries(groups.flatMap((g) => g.params.map((d) => [d.key, d.def])));

export const OBJECT_DEFAULTS = {
    ...defaultsOf(OBJECT_GROUPS),
    ...defaultsOf([TRANSFORM_GROUP, SPIN_GROUP]),
    edits: {},
    hand: [],
    strandLook: {},
};
export const EDGE_DEFAULTS = defaultsOf(EDGE_GROUPS);
export const STAGE_DEFAULTS = defaultsOf(STAGE_GROUPS);

/** Everything the tool holds, flat (object, effect and stage keys never collide). */
export const DEFAULTS = { ...OBJECT_DEFAULTS, ...EDGE_DEFAULTS, ...STAGE_DEFAULTS };

/** Every definition by key. */
export const DEFS = new Map(
    [...OBJECT_GROUPS, TRANSFORM_GROUP, SPIN_GROUP, ...EDGE_GROUPS, ...STAGE_GROUPS].flatMap((g) => g.params).map((d) => [d.key, d]),
);

/**
 * Only the keys the tool knows, each a value of its definition's type (an
 * old or foreign file can't add junk). Data keys pass through as objects.
 */
export function cleanParams(p) {
    const out = { ...DEFAULTS };
    if (!p || typeof p !== 'object') return out;
    DEFS.forEach((d, key) => {
        const v = p[key];
        if (v === undefined || v === null) return;
        if (d.type === 'number' && Number.isFinite(Number(v))) out[key] = Number(v);
        else if (d.type === 'bool') out[key] = !!v;
        else if (d.type === 'color' && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
        else if (d.type === 'select' && d.options.some(([o]) => o === v)) out[key] = v;
    });
    if (p.edits && typeof p.edits === 'object') out.edits = p.edits;
    if (Array.isArray(p.hand)) out.hand = p.hand.filter((s) => Array.isArray(s?.points));
    if (p.strandLook && typeof p.strandLook === 'object') out.strandLook = p.strandLook;
    return out;
}

// ---- In the compositor ---------------------------------------------------------------------
//
// The compositor's Manifold object and Lines effect are built from these
// (its schema adds its own layer, spin and transform groups). Two things
// exist only there: what the metal reflects can be the scene around it
// (the take's scan and the 3D in front, with its own sky behind), and the
// Lines & fill can be on the object alone.

const reflectsScene = (p) => p.reflect === 'scene';

/** The object's groups as the compositor shows them. */
export const COMPOSITOR_OBJECT_GROUPS = OBJECT_GROUPS.map((g) => {
    if (g.title !== 'Reflections') return g;
    return {
        ...g,
        hint: 'Its own sky, or the scene around it: the take’s scan and the 3D in front of the footage, captured from its middle every frame, with its sky wherever the scene has nothing.',
        params: [
            select('reflect', 'Reflect', [['sky', 'Its own sky'], ['scene', 'The scene (its sky behind)']], 'sky'),
            num('reflectSize', 'Scene detail (px)', 32, 1024, 32, 256, { rebuilds: true, when: reflectsScene }),
            ...g.params.map((d) => (d.key === 'env'
                // An image to reflect is the tool's alone (the compositor has no picture for it).
                ? { ...d, label: 'Sky', options: d.options.filter(([v]) => v !== 'image') }
                : d)),
        ],
    };
});

const lining = (p) => !!p.linesOn;

/** Lines & fill on the manifold alone (drawn over it where it is in the frame). */
export const OBJECT_LINE_GROUPS = EDGE_GROUPS.map((g, i) => ({
    ...g,
    title: i === 0 ? 'Lines & fill' : g.title,
    collapsed: true,
    ...(i === 0 ? {
        hint: 'Edge detection on this manifold alone: its outline, folds and holes, drawn where it shows (whatever is in front of it covers them). The Lines effect does the whole picture.',
    } : { when: lining }),
    params: [
        ...(i === 0 ? [bool('linesOn', 'On this manifold', false)] : []),
        ...g.params.map((d) => ({ ...d, when: (p) => lining(p) && (!d.when || d.when(p)) })),
    ],
}));

/** The Lines effect, over the whole picture or one track's. */
export const EFFECT_LINE_GROUPS = EDGE_GROUPS.map((g, i) => (i === 0 ? {
    ...g,
    hint: 'Edge detection over the picture: its brightness, and (on the 3D scene’s picture) the 3D’s outlines, overlaps and folds. Widths are in output pixels.',
    params: [
        g.params[0],
        select('edgeSource', 'Edges of', [['3d', 'The picture and the 3D'], ['picture', 'The picture only']], '3d'),
        ...g.params.slice(1),
    ],
} : g));

export const COMPOSITOR_OBJECT_DEFAULTS = {
    ...OBJECT_DEFAULTS,
    ...defaultsOf(COMPOSITOR_OBJECT_GROUPS),
    ...defaultsOf(OBJECT_LINE_GROUPS),
};
export const EFFECT_LINE_DEFAULTS = defaultsOf(EFFECT_LINE_GROUPS);

/** A Manifolds preset's parameters as the compositor object's (its frame, camera and backdrop left out). */
export function presetToObjectParams(params) {
    const p = cleanParams(params);
    const keys = new Set([...Object.keys(COMPOSITOR_OBJECT_DEFAULTS), ...EDGE_GROUPS.flatMap((g) => g.params.map((d) => d.key))]);
    const out = {};
    keys.forEach((k) => { if (p[k] !== undefined) out[k] = p[k]; });
    if (out.env === 'image') out.env = 'studio';
    // The tool always draws its lines and fill; here they are on when the look has any.
    out.linesOn = !!p.edgeOn || p.fillMode !== 'render';
    out.edits = p.edits;
    out.hand = p.hand;
    out.strandLook = p.strandLook;
    return out;
}
