// Built-in looks: starting points after the kinds of picture the tool was
// made for. A look sets the object, the lines and the backdrop; it keeps the
// frame size and clears edits and hand-drawn strands (they belong to the
// strands the old look made).

import { MANIFOLD } from '../../config/landing';

// The site's own: the landing page's manifold on the page colour.
const SITE = {
    id: 'aq',
    name: 'aq',
    note: '',
    set: {
        ...MANIFOLD.params,
        posX: 0.4, posY: -0.82, scale: 0.5, wobble: 0,
        bgMode: 'color', bgColor: '#584f6e',
    },
};

export const LOOKS = [
    SITE,
    {
        id: 'ink-chrome',
        name: 'Ink chrome',
        note: 'Liquid chrome photocopied: reflections thresholded to ink on paper, with lattice holes.',
        set: {
            form: 'confluence', count: 16, anchors: 6, seed: 12, extent: 2.6, spread: 0.55, core: 0.35, swirl: 0.5, curl: 0.7, chaos: 0.2, lengthVar: 0.35, flatten: 0.45,
            curve: 'catmull', tension: 0.5, samples: 220,
            profile: 'blade', radial: 10, width: 0.42, thickness: 0.55, widthVar: 0.55, taperIn: 0.2, taperOut: 0.55, taperShape: 1.6, twist: 0.6, twistVar: 0.8, swell: 0.75, swellScale: 2.4,
            bundle: 1, wobble: 0.1,
            colorMode: 'solid', colorA: '#e8e8e8', metalness: 1, roughness: 0.04, env: 'studio', envBands: 6, envRotate: 30, envTilt: 15,
            holes: 0, holeScale: 0.05,
            edgeOn: true, edgeColor: '#141414', edgeWidth: 1.6, edgeSilhouette: 1, edgeDepth: 1, edgeNormal: 0.5, edgeLuma: 0, edgeThreshold: 0.25, edgeJitter: 0.6, edgeBreakup: 0.1, edgeBoil: 8,
            fillMode: 'ink', fillColor: '#f1f0ec', inkColor: '#161616', inkThreshold: 0.36, inkSoft: 0.02, fillMix: 1,
            bgMode: 'color', bgColor: '#e9e8e3', exposure: 0, keyLight: 1.2,
        },
    },
    {
        id: 'shard-burst',
        name: 'Shard burst',
        note: 'Chrome blades flung out of a core, reflecting a coloured sky.',
        set: {
            form: 'burst', count: 140, anchors: 4, seed: 3, extent: 3.2, spread: 0.75, aimYaw: -30, aimPitch: 25, twoSided: false, core: 0.12, swirl: 0.15, curl: 0.25, chaos: 0.08, lengthVar: 0.6, flatten: 0.2,
            curve: 'catmull', tension: 0.5, samples: 90,
            profile: 'blade', radial: 6, width: 0.2, thickness: 0.18, widthVar: 0.7, taperIn: 0.04, taperOut: 0.85, taperShape: 1.1, twist: 0.15, twistVar: 0.3, swell: 0.15, swellScale: 2,
            bundle: 1, wobble: 0.05,
            colorMode: 'strand', colorA: '#f4efe9', colorB: '#c9a99a', metalness: 1, roughness: 0.05, iridescence: 0.25, env: 'sky', envColorA: '#2a5fbf', envColorB: '#f2e6dc', envRotate: 200, envTilt: 0,
            edgeOn: true, edgeColor: '#1b1612', edgeWidth: 0.8, edgeSilhouette: 0.8, edgeDepth: 0.6, edgeNormal: 0.4, edgeLuma: 0, edgeThreshold: 0.3,
            fillMode: 'render',
            bgMode: 'color', bgColor: '#d9d7d2', exposure: 0.2,
        },
    },
    {
        id: 'metal-heart',
        name: 'Cut-out',
        note: 'Flat white shapes with a black stroke, the 3D model as a cut-out.',
        set: {
            form: 'sheaf', count: 22, anchors: 5, seed: 41, extent: 3.4, spread: 0.55, aimYaw: 20, aimPitch: 35, core: 0.08, swirl: 0.25, curl: 0.9, chaos: 0.12, lengthVar: 0.45, flatten: 0.6,
            curve: 'catmull', tension: 0.5, samples: 200,
            profile: 'ribbon', radial: 6, width: 0.3, thickness: 0.4, widthVar: 0.6, taperIn: 0.1, taperOut: 0.9, taperShape: 1.5, twist: 0.7, twistVar: 0.9, swell: 0.9, swellScale: 3.5,
            bundle: 1, wobble: 0.08,
            colorMode: 'solid', colorA: '#ffffff', metalness: 0.2, roughness: 0.5, env: 'studio',
            edgeOn: true, edgeColor: '#000000', edgeWidth: 1.2, edgeSilhouette: 1, edgeDepth: 1.2, edgeNormal: 0, edgeLuma: 0, edgeThreshold: 0.15, edgeSoft: 0.05, edgeJitter: 0, edgeBreakup: 0,
            fillMode: 'flat', fillColor: '#ffffff', fillMix: 1,
            bgMode: 'color', bgColor: '#ffffff',
        },
    },
    {
        id: 'molar',
        name: 'Blue lines',
        note: 'Bundles of thin strands, white with sky-blue shadows, outlined.',
        set: {
            form: 'confluence', count: 40, anchors: 6, seed: 5, extent: 3.6, spread: 0.85, core: 0.25, swirl: 0.6, curl: 0.5, chaos: 0.25, lengthVar: 0.4, flatten: 0.5,
            curve: 'bspline', samples: 260,
            profile: 'blade', radial: 6, width: 0.16, thickness: 0.3, widthVar: 0.6, taperIn: 0.25, taperOut: 0.35, taperShape: 1.3, twist: 0.5, twistVar: 0.6, swell: 1.1, swellScale: 4,
            bundle: 3, bundleSpread: 0.09, bundleFan: 0.7, bundleTwist: 0.4, bundleWidth: 0.5,
            wobble: 0.1,
            colorMode: 'solid', colorA: '#ffffff', metalness: 1, roughness: 0.12, env: 'sky', envColorA: '#1d63e0', envColorB: '#ffffff', envRotate: 120, envTilt: 20,
            edgeOn: true, edgeColor: '#0f2140', edgeWidth: 0.9, edgeSilhouette: 1, edgeDepth: 1, edgeNormal: 0.3, edgeLuma: 0, edgeThreshold: 0.25,
            fillMode: 'tone', fillColor: '#ffffff', inkColor: '#1a62e8', toneLevels: 3, toneHue: 0, fillMix: 1,
            bgMode: 'color', bgColor: '#f4f4f2', exposure: 0.6,
        },
    },
    {
        id: 'street-chrome',
        name: 'Liquid flow',
        note: 'Streams of molten chrome through a field, catching a pale sky.',
        set: {
            form: 'flow', count: 30, anchors: 7, seed: 19, extent: 1.35, spread: 0.6, aimYaw: 60, aimPitch: -15, core: 0.3, swirl: 0.4, curl: 0.3, chaos: 0.35, lengthVar: 0.3, flatten: 0.25,
            curve: 'catmull', tension: 0.5, samples: 200,
            profile: 'tube', radial: 14, width: 0.26, thickness: 0.45, widthVar: 0.6, taperIn: 0.3, taperOut: 0.45, taperShape: 1.2, twist: 0.3, twistVar: 0.5, swell: 0.8, swellScale: 3.5, pinch: 0.15, pinchCount: 4,
            bundle: 1, wobble: 0.15, wobbleCycles: 1, swellFlow: 1,
            colorMode: 'length', colorA: '#f2f4f7', colorB: '#c4ccd6', metalness: 1, roughness: 0.03, env: 'studio', envBands: 8, envRotate: 40, envTilt: -10,
            edgeOn: true, edgeColor: '#20252b', edgeWidth: 0.7, edgeSilhouette: 0.7, edgeDepth: 0.6, edgeNormal: 0, edgeLuma: 0.5, edgeThreshold: 0.3,
            fillMode: 'render',
            bgMode: 'color', bgColor: '#fbfbfa',
        },
    },
    {
        id: 'tangle',
        name: 'Bézier tangle',
        note: 'A sheaf of Bézier bundles with skewed handles, pale chrome with every edge drawn.',
        set: {
            form: 'sheaf', count: 22, anchors: 5, seed: 41, extent: 3.4, spread: 0.55, aimYaw: 20, aimPitch: 35, core: 0.08, swirl: 0.25, curl: 0.9, chaos: 0.12, lengthVar: 0.45, flatten: 0.6,
            curve: 'bezier', handleLength: 0.38, handleSkew: 0.5, samples: 200,
            profile: 'blade', radial: 6, width: 0.3, thickness: 0.4, widthVar: 0.6, taperIn: 0.1, taperOut: 0.9, taperShape: 1.5, twist: 0.7, twistVar: 0.9, swell: 0.9, swellScale: 3.5,
            bundle: 4, bundleSpread: 0.12, bundleFan: 0.5, bundleTwist: 0.5, bundleWidth: 0.45,
            wobble: 0.08,
            colorMode: 'solid', colorA: '#ffffff', metalness: 0.2, roughness: 0.5, env: 'sky', envColorA: '#2f6fd6', envColorB: '#f3f5f8',
            edgeOn: true, edgeColor: '#000000', edgeWidth: 1.2, edgeSilhouette: 1, edgeDepth: 1.2, edgeNormal: 0, edgeLuma: 0, edgeThreshold: 0.15, edgeSoft: 0.05,
            fillMode: 'render',
            bgMode: 'color', bgColor: '#ffffff',
        },
    },
];

/** Keys a look never touches (the frame's size). */
export const LOOK_KEEPS = ['aspect', 'outLong'];
