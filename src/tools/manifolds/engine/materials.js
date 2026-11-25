// A manifold's two materials, which share their hole uniforms:
//
//   surface   MeshPhysicalMaterial (metal, clearcoat, iridescence, glass)
//             with vertex colours, and a cellular lattice of holes cut out
//   gbuffer   what the Lines effect reads: the view-space normal's x and y,
//             the view depth, and coverage 1 (cleared to 0), with the same
//             holes cut, so every hole gets its outline too
//
// Holes are worked out in uv, which is in world units (along the strand,
// across it), so cells are the same size on every strand. They slide a whole
// number of cells a loop (seamless): the cell pattern repeats on integers.

import * as THREE from 'three';

const HOLES_GLSL = /* glsl */`
uniform float uHoles;
uniform float uHoleScale;
uniform float uHoleJitter;
uniform float uHoleShift;
varying vec2 vMfUv;

vec2 mfHash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}
// Distance to the nearest cell wall (F2 - F1 of Worley noise).
float mfWall(vec2 x, float jitter) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = mfHash2(n + g) * jitter + 0.5 * (1.0 - jitter);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
        }
    }
    return sqrt(f2) - sqrt(f1);
}
void mfCutHoles() {
    if (uHoles <= 0.0) return;
    vec2 cell = vMfUv / max(uHoleScale, 1e-4) + vec2(uHoleShift, 0.0);
    float wall = mix(1.25, 0.035, uHoles);
    if (mfWall(cell, uHoleJitter) > wall) discard;
}
`;

export function makeHoleUniforms() {
    return {
        uHoles: { value: 0 },
        uHoleScale: { value: 0.06 },
        uHoleJitter: { value: 1 },
        uHoleShift: { value: 0 },
    };
}

/** The physical surface, with holes. */
export function makeSurface(holeUniforms) {
    const m = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        metalness: 1,
        roughness: 0.06,
        side: THREE.DoubleSide,
    });
    m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, holeUniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vMfUv;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMfUv = uv;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${HOLES_GLSL}`)
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nmfCutHoles();');
    };
    m.customProgramCacheKey = () => 'manifold-surface';
    return m;
}

/** Normals, depth and coverage, for the Lines effect. */
export function makeGBuffer(holeUniforms) {
    return new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { ...holeUniforms },
        vertexShader: /* glsl */`
            varying vec2 vMfUv;
            varying vec3 vNormalV;
            varying float vDepth;
            void main() {
                vMfUv = uv;
                vNormalV = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            ${HOLES_GLSL}
            varying vec3 vNormalV;
            varying float vDepth;
            void main() {
                mfCutHoles();
                vec3 n = normalize(vNormalV) * (gl_FrontFacing ? 1.0 : -1.0);
                gl_FragColor = vec4(n.xy, vDepth, 1.0);
            }`,
    });
}

/** Set the surface from resolved parameters. Returns nothing; cheap when nothing changed. */
export function applySurface(m, p, envMap) {
    m.metalness = p.metalness;
    m.roughness = p.roughness;
    m.clearcoat = p.clearcoat;
    m.clearcoatRoughness = Math.min(1, p.roughness * 0.5);
    m.iridescence = p.iridescence;
    m.iridescenceIOR = 1.6;
    m.transmission = p.transmission;
    m.thickness = p.transmission > 0 ? Math.max(0.05, p.width) : 0;
    m.ior = p.ior;
    m.envMap = envMap;
    m.envMapIntensity = p.envIntensity;
    m.emissive.set(p.emissive);
    m.emissiveIntensity = p.emissiveIntensity;
    const transparent = p.opacity < 1;
    if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
    }
    m.opacity = p.opacity;
}
