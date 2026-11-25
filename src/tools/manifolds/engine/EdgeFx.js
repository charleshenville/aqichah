// Lines & fill: edge detection as a post effect, in one full-screen pass.
//
// Input: a picture (display colour, or linear with linearIO as the
// compositor's frames are) and, where the 3D is known, a G-buffer from the
// gbuffer material: view normal x, y, view depth, coverage (cleared to 0).
//
// Lines are found on a ring of eight samples at half the line width:
//   outline     coverage changes (silhouettes, and every hole's edge)
//   depth       relative jumps in depth where both sides are surface (overlaps)
//   folds       the angle between normals (creases, a blade's sharp edge)
//   brightness  the picture's own luma (works on anything, G-buffer or not)
// and can wobble and break up like a hand-drawn or photocopied line, boiling
// a few times a second.
//
// Fill replaces the surface (where coverage says there is one; the whole
// picture without a G-buffer): flat (a cut-out in one colour), ink (the
// render thresholded to two tones, the way a photocopier treats chrome) or
// tones (posterised between ink and paper, optionally keeping some colour).
//
// Sizes are output pixels: `outW` is the width the frame will be, so a line
// is as thick in the preview as in a 4K export. Everything is a function of
// the time, so a frame always comes out the same.
//
// No React; works on any three.js WebGLRenderer (the tool's or the
// compositor's), drawing into a render target or the canvas.

import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tG;
uniform bool uHasG;
uniform bool uLinearIO;
uniform bool uPremultiply;
uniform vec2 uTexel;      // 1 / render size
uniform float uPx;        // render pixels per output pixel
uniform float uSeed;      // boil step
uniform sampler2D tHold;  // held-out real objects in front (r), or unused
uniform bool uHasHold;
uniform sampler2D tOver;  // what is laid over the picture (alpha), to leave alone, or unused
uniform bool uHasOver;
uniform bool uLumaSurface; // brightness edges only on the G-buffer's surface (lines on one object)

uniform bool uEdgeOn;
uniform vec3 uEdgeColor;
uniform float uEdgeWidth, uEdgeOpacity, uSil, uDepth, uNormal, uLuma, uThreshold, uSoft, uJitter, uBreakup;

uniform int uFill;        // 0 render, 1 flat, 2 ink, 3 tones
uniform vec3 uPaper, uInk;
uniform float uInkThreshold, uInkSoft, uLevels, uToneHue, uFillMix;

varying vec2 vUv;

vec3 toSRGB(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

vec4 picture(vec2 uv) {
    vec4 c = texture2D(tColor, uv);
    if (uLinearIO) c.rgb = toSRGB(c.rgb);
    return c;
}

// A G-buffer sample: normal (unit, facing us), depth, coverage.
void gsample(vec2 uv, out vec3 n, out float d, out float cov) {
    vec4 g = texture2D(tG, uv);
    cov = clamp(g.a, 0.0, 1.0);
    if (cov > 1e-3) {
        vec2 xy = g.xy / cov;
        n = vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
        d = g.z / cov;
    } else {
        n = vec3(0.0, 0.0, 1.0);
        d = 0.0;
    }
}

void main() {
    vec4 col = picture(vUv);
    vec3 base = col.rgb;
    float alpha = col.a;

    vec3 n0; float d0; float c0;
    if (uHasG) gsample(vUv, n0, d0, c0); else { n0 = vec3(0, 0, 1); d0 = 0.0; c0 = 1.0; }
    float surface = uHasG ? c0 : 1.0;
    // What a matte holds in front (a real person over the 3D) keeps its own picture.
    float front = uHasHold ? smoothstep(0.02, 0.35, texture2D(tHold, vUv).r) : 0.0;
    if (uHasOver) front = max(front, clamp(texture2D(tOver, vUv).a, 0.0, 1.0));
    surface *= 1.0 - front;

    // ---- Fill
    if (uFill > 0) {
        float L = luma(base);
        vec3 f;
        if (uFill == 1) {
            f = uPaper;
        } else if (uFill == 2) {
            f = mix(uInk, uPaper, smoothstep(uInkThreshold - uInkSoft, uInkThreshold + uInkSoft + 1e-4, L));
        } else {
            float lv = max(2.0, uLevels);
            float q = floor(clamp(L, 0.0, 0.9999) * lv) / (lv - 1.0);
            f = mix(uInk, uPaper, q);
            vec3 keep = L > 1e-4 ? base * (q / L) : base;
            f = mix(f, keep, uToneHue);
        }
        base = mix(base, mix(base, f, uFillMix), surface);
    }

    // ---- Lines
    float edge = 0.0;
    if (uEdgeOn && uEdgeOpacity > 0.0) {
        vec2 px = uTexel * uPx;
        vec2 uv = vUv;
        if (uJitter > 0.0) {
            vec2 q = vUv / (px * 18.0) + uSeed * 7.31;
            uv += (vec2(vnoise(q), vnoise(q + 19.7)) - 0.5) * 2.0 * uJitter * px;
        }
        vec3 n1; float d1; float c1;
        if (uHasG) gsample(uv, n1, d1, c1); else { n1 = vec3(0, 0, 1); d1 = 0.0; c1 = 1.0; }
        float l1 = luma(picture(uv).rgb);
        // Lines thinner than a pixel at this size stay a pixel wide and fade instead of vanishing.
        float rw = uEdgeWidth * 0.5 * uPx;
        float r = max(0.5, rw) / uPx;
        float thin = clamp(rw / 0.5, 0.15, 1.0);
        float e = 0.0;
        for (int k = 0; k < 8; k++) {
            float a = float(k) * 0.78539816;
            vec2 q = uv + vec2(cos(a), sin(a)) * r * px;
            float v = 0.0;
            if (uHasG) {
                vec3 n2; float d2; float c2;
                gsample(q, n2, d2, c2);
                v += abs(c1 - c2) * uSil;
                float both = step(0.5, c1) * step(0.5, c2);
                v += both * abs(d1 - d2) / max(min(d1, d2), 1e-3) * uDepth * 3.0;
                v += both * (1.0 - dot(n1, n2)) * uNormal * 1.6;
            }
            if (uLuma > 0.0) v += abs(l1 - luma(picture(q).rgb)) * uLuma * 2.0 * (uLumaSurface ? c1 : 1.0);
            e = max(e, v);
        }
        edge = smoothstep(uThreshold, uThreshold + uSoft + 1e-3, e);
        if (uBreakup > 0.0) {
            float b = vnoise(uv / (px * 26.0) + uSeed * 3.17 + 41.0);
            edge *= smoothstep(uBreakup * 1.1 - 0.12, uBreakup * 1.1, b);
        }
        edge *= uEdgeOpacity * thin * (1.0 - front);
    }
    base = mix(base, uEdgeColor, edge);
    alpha = max(alpha, edge);

    base = clamp(base, 0.0, 1.0);
    if (uLinearIO) base = toLinear(base);
    gl_FragColor = vec4(uPremultiply ? base * alpha : base, alpha);
}`;

const FILLS = {
    render: 0, flat: 1, ink: 2, tone: 3,
};

/** A colour hex as display values (no linearising: this pass works in display colour). */
const display = (c, hex) => {
    c.setStyle(hex, THREE.NoColorSpace);
    return c;
};

export default class EdgeFx {
    constructor(three) {
        this.three = three;
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                tColor: { value: null },
                tG: { value: null },
                uHasG: { value: false },
                uLinearIO: { value: false },
                uPremultiply: { value: false },
                uTexel: { value: new THREE.Vector2(1, 1) },
                uPx: { value: 1 },
                uSeed: { value: 0 },
                tHold: { value: null },
                uHasHold: { value: false },
                tOver: { value: null },
                uHasOver: { value: false },
                uLumaSurface: { value: false },
                uEdgeOn: { value: true },
                uEdgeColor: { value: new THREE.Color() },
                uEdgeWidth: { value: 1 },
                uEdgeOpacity: { value: 1 },
                uSil: { value: 1 },
                uDepth: { value: 1 },
                uNormal: { value: 1 },
                uLuma: { value: 0 },
                uThreshold: { value: 0.2 },
                uSoft: { value: 0.1 },
                uJitter: { value: 0 },
                uBreakup: { value: 0 },
                uFill: { value: 0 },
                uPaper: { value: new THREE.Color() },
                uInk: { value: new THREE.Color() },
                uInkThreshold: { value: 0.5 },
                uInkSoft: { value: 0.02 },
                uLevels: { value: 3 },
                uToneHue: { value: 0 },
                uFillMix: { value: 1 },
            },
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.quad.frustumCulled = false;
        this.scene = new THREE.Scene();
        this.scene.add(this.quad);
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    /**
     * Draw `src` (a texture) with lines and fill into `target` (a render
     * target, or null for the canvas). `gbuffer` the G-buffer texture or
     * null; `width` x `height` the size drawn at; `outW` the frame's width
     * in output pixels; `time` in seconds; `linearIO` for linear frames;
     * `premultiply` when drawing to a premultiplied canvas; `hold` a mask of
     * what stands in front (red channel) to leave alone; `lumaOnSurface`
     * finds brightness edges only on the G-buffer's surface; `over` what is
     * laid over the picture (its alpha) that lines and fill stay under.
     */
    run({
        src, gbuffer = null, params: p, width, height, outW, time = 0, target = null, linearIO = false, premultiply = false,
        hold = null, over = null, lumaOnSurface = false,
    }) {
        const u = this.material.uniforms;
        u.tColor.value = src;
        u.tG.value = gbuffer;
        u.uHasG.value = !!gbuffer;
        u.tHold.value = hold;
        u.uHasHold.value = !!hold;
        u.tOver.value = over;
        u.uHasOver.value = !!over;
        u.uLumaSurface.value = !!gbuffer && lumaOnSurface;
        u.uLinearIO.value = linearIO;
        u.uPremultiply.value = premultiply;
        u.uTexel.value.set(1 / width, 1 / height);
        u.uPx.value = width / Math.max(1, outW);
        u.uSeed.value = p.edgeBoil > 0 ? Math.floor(time * p.edgeBoil) : 0;
        u.uEdgeOn.value = !!p.edgeOn;
        display(u.uEdgeColor.value, p.edgeColor);
        u.uEdgeWidth.value = p.edgeWidth;
        u.uEdgeOpacity.value = p.edgeOpacity;
        u.uSil.value = p.edgeSilhouette;
        u.uDepth.value = p.edgeDepth;
        u.uNormal.value = p.edgeNormal;
        u.uLuma.value = p.edgeLuma;
        u.uThreshold.value = p.edgeThreshold;
        u.uSoft.value = p.edgeSoft;
        u.uJitter.value = p.edgeJitter;
        u.uBreakup.value = p.edgeBreakup;
        u.uFill.value = FILLS[p.fillMode] || 0;
        display(u.uPaper.value, p.fillColor);
        display(u.uInk.value, p.inkColor);
        u.uInkThreshold.value = p.inkThreshold;
        u.uInkSoft.value = p.inkSoft;
        u.uLevels.value = p.toneLevels;
        u.uToneHue.value = p.toneHue;
        u.uFillMix.value = p.fillMix;

        const three = this.three;
        const prev = three.getRenderTarget();
        const prevAuto = three.autoClear;
        three.autoClear = false;
        three.setRenderTarget(target);
        three.render(this.scene, this.camera);
        three.setRenderTarget(prev);
        three.autoClear = prevAuto;
    }

    dispose() {
        this.material.dispose();
        this.quad.geometry.dispose();
    }
}
