// The landing page: the LED mark, the scrolling marks behind it and the
// manifold over the photo.

// ---- The white "aq" -------------------------------------------------------------
// Every dot is its own LED. They only ever switch, one at a time at even
// intervals, in a random order: never a flicker. On load the landing's aq
// comes on over `duration` and the page titles over `titles.duration`; on
// hover the nav's aq lights up over `hover.duration` (and back on leaving).
export const LED = {
    delay: 150, // ms before the first LED
    duration: 450, // ms from the first LED to the last
    hover: { duration: 167 },
    titles: { duration: 225 }, // the software / discography page titles
};

// ---- The blurred marks in the panel --------------------------------------------
// aq, mirrored aq, aq ... scrolling right to left forever.
export const MARQUEE = {
    secondsPerTile: 30, // one aq + mirrored aq pair
    opacity: 0.3,
    reverse: false, // true scrolls left to right
};

// ---- The manifold ----------------------------------------------------------------
// The plaything video's manifold (compositor-projects/plaything.json), drawn
// with no background over the photo, its lower part tucked under the bar.
// `params` overrides any Manifolds parameter (src/tools/manifolds/params.js).
//
// It is drawn at a fixed size on the screen: browser zoom changes the text
// around it, never the manifold.
export const MANIFOLD = {
    enabled: true,
    // The canvas covers the whole landing page (nothing can clip the
    // manifold); place and size it with posX / posY / scale below.
    box: { left: 0, top: 0, width: 100, height: 100 },
    boxPortrait: { left: 0, top: 0, width: 100, height: 100 },
    fps: 30,
    pixelBudget: 2.6e6, // render pixels at most (scaled to fit)
    lineScale: 1.5, // line widths: screen pixels per `edgeWidth` unit
    camera: { position: [0, 0, 5.2], target: [0, 0, 0], fov: 35 },
    params: {
        // the plaything manifold: a sheaf fanning from one root
        form: 'sheaf',
        count: 29,
        anchors: 6,
        seed: 340,
        extent: 10,
        spread: 0.21,
        aimYaw: 0,
        aimPitch: 20,
        twoSided: false,
        core: 0.08, // tight: the strands visibly start from one root
        swirl: 0.68,
        curl: 0.5,
        chaos: 0.24,
        lengthVar: 0.4,
        flatten: 0.5,
        curve: 'bspline',
        tension: 0.5,
        handleLength: 0.38,
        handleSkew: 0,
        samples: 260,
        trimStart: 0,
        trimEnd: 1,
        trimStagger: 0.27,
        slide: -0.052,
        profile: 'blade',
        radial: 3,
        width: 0.31,
        thickness: 0.3,
        widthVar: 0.15,
        taperIn: 0.25,
        taperOut: 0.25,
        taperShape: 1.3,
        twist: 1.08,
        twistVar: 0.6,
        swell: 1.1,
        swellScale: 4,
        pinch: 0,
        pinchCount: 4,
        bundle: 3,
        bundleSpread: 0.09,
        bundleFan: 0.55,
        bundleTwist: 0.4,
        bundleWidth: 0.5,
        loop: 8,
        wobble: 0, // still: no bobbing
        wobbleScale: 0.6,
        wobbleCycles: 1,
        colorMode: 'solid',
        colorA: '#ffffff',
        metalness: 1,
        roughness: 0.12,
        env: 'sky',
        envRotate: 120,
        envTilt: 20,
        envBands: 6,
        envColorA: '#0010e0',
        envColorB: '#ffffff',
        holes: 0.6,
        holeScale: 0.506,
        holeJitter: 0.32,
        // placed by `anchor` below (posX / posY are worked out from it);
        // the plaything rotation, turned over
        posX: 800,
        posY: 0,
        posZ: -2,
        rotX: 40,
        rotY: 0,
        rotZ: 103.64, // the plaything turn, right way up for this camera
        scale: 0.7, // its size
        spinY: 0,
        // Lines & fill: white, and the page colour darker
        edgeOn: true,
        edgeColor: '#1e1a29',
        edgeWidth: 1.4,
        edgeSilhouette: 1,
        edgeDepth: 4,
        edgeNormal: 4,
        edgeLuma: 0.82,
        edgeThreshold: 0.25,
        edgeSoft: 0.15,
        fillMode: 'tone',
        fillColor: '#ffffff',
        inkColor: '#2e2839', // the page colour, much darker
        toneLevels: 2,
        fillMix: 1,
        exposure: 0,
        toneMap: 'aces',
        keyLight: 1.2,
    },
    // Where it stands. Its lowest point (the root) is put `x` across the page
    // (0 left edge, 1 right edge) and `depth` of the bar's height below the
    // bar's top edge (0 on the edge, 1 at the bottom of the page), so its
    // foot stays hidden whatever the window's shape. To move it: raise `x`
    // to go right, raise `depth` to go down; `params.scale` sizes it.
    anchor: { x: 0.86, depth: 0.85 },
    anchorPortrait: { x: 0.62, depth: 0.5 },
    // on tall screens
    portrait: { scale: 0.34 },
    // While idle the swirl breathes: key: [from, to] added to the parameter,
    // swung there and back once every `driftSeconds`.
    drift: { swirl: [0, 0.053] },
    driftSeconds: 9,
    // With a mouse: the manifold turns toward the cursor, and winds up while hovered.
    pointer: {
        yaw: 5, // degrees it turns toward the cursor at the screen edge (subtle)
        pitch: 0, // no tilting: it never moves up and down
        ease: 3, // how quickly it follows (per second)
        hoverSwirl: 0.18, // added to swirl while the cursor is on it
        hoverEase: 1.6,
    },
};
