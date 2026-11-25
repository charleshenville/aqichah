// The Manifolds tool's renderer: one manifold, a camera, a key light, and
// the passes that make a frame.
//
//   1. colour     the scene into a multisampled half-float target, cleared
//                 transparent (linear, premultiplied; alpha is coverage)
//   2. G-buffer   the same with the gbuffer material (normals, depth, coverage)
//   3. display    exposure, tone map, sRGB, laid over the backdrop (a colour,
//                 an image, or nothing for a transparent PNG)
//   4. Lines      EdgeFx: lines and fill, to the canvas
//   5. overlay    the point editor's handles and gizmo (never exported)
//
// In the compositor the manifold is placed in its scene instead and passes
// 3-4 are its own; this is only the tool's frame.

import * as THREE from 'three';
import ManifoldObject from './ManifoldObject';
import Environments from './environment';
import EdgeFx from './EdgeFx';

const DISPLAY_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBg;
uniform int uBgMode;     // 0 colour, 1 image, 2 none
uniform vec3 uBg;        // display colour
uniform vec2 uBgScale;
uniform vec2 uBgOffset;
uniform float uExposure;
uniform int uTone;       // 0 filmic, 1 clip
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}
vec3 aces(vec3 c) {
    const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c = I * (c / 0.6);
    c = RRTAndODTFit(c);
    return clamp(O * c, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
    vec4 c = texture2D(tColor, vUv);
    vec3 rgb = c.a > 1e-4 ? c.rgb / c.a : vec3(0.0);
    rgb *= exp2(uExposure);
    rgb = uTone == 0 ? aces(rgb) : clamp(rgb, 0.0, 1.0);
    rgb = toSRGB(rgb);
    float a = clamp(c.a, 0.0, 1.0);
    if (uBgMode == 2) {
        gl_FragColor = vec4(rgb, a);
        return;
    }
    vec3 bg = uBgMode == 1 ? texture2D(tBg, vUv * uBgScale + uBgOffset).rgb : uBg;
    gl_FragColor = vec4(mix(bg, rgb, a), 1.0);
}`;

const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const rad = (d) => (d * Math.PI) / 180;

export default class Stage {
    constructor(canvas) {
        const renderer = new THREE.WebGLRenderer({
            canvas, antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false,
        });
        if (!renderer.capabilities.isWebGL2) throw new Error('Manifolds needs WebGL 2.');
        renderer.setPixelRatio(1);
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.envs = new Environments(renderer);
        this.manifold = new ManifoldObject({ envs: this.envs });
        this.root.add(this.manifold.object);
        this.key = new THREE.DirectionalLight(0xffffff, 1);
        this.scene.add(this.key, this.key.target);

        // The camera the user moves, and the one drawn with (it plus the orbit).
        this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
        this.camera.position.set(0, 0.3, 5.2);
        this.target = new THREE.Vector3();
        this.view = new THREE.PerspectiveCamera(35, 1, 0.01, 500);

        const rt = (samples) => new THREE.WebGLRenderTarget(2, 2, {
            type: THREE.HalfFloatType, samples, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        });
        this.colorRT = rt(4);
        this.gRT = rt(4);
        this.dispRT = rt(0);
        this.dispRT.depthBuffer = false;

        this.display = new THREE.ShaderMaterial({
            vertexShader: QUAD_VERT,
            fragmentShader: DISPLAY_FRAG,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                tColor: { value: this.colorRT.texture },
                tBg: { value: null },
                uBgMode: { value: 0 },
                uBg: { value: new THREE.Color() },
                uBgScale: { value: new THREE.Vector2(1, 1) },
                uBgOffset: { value: new THREE.Vector2(0, 0) },
                uExposure: { value: 0 },
                uTone: { value: 0 },
            },
        });
        this.quadScene = new THREE.Scene();
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.display);
        quad.frustumCulled = false;
        this.quadScene.add(quad);
        this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.edge = new EdgeFx(renderer);
        this.overlay = new THREE.Scene();
        this.bgTexture = null;
        this.width = 2;
        this.height = 2;
        this.lost = false;
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
        canvas.addEventListener('webglcontextrestored', () => { this.lost = false; });
    }

    /** The drawing size in pixels (the canvas's buffer; CSS size is the page's). */
    setSize(w, h) {
        w = Math.max(2, Math.round(w));
        h = Math.max(2, Math.round(h));
        if (w === this.width && h === this.height) return;
        this.width = w;
        this.height = h;
        this.renderer.setSize(w, h, false);
        this.colorRT.setSize(w, h);
        this.gRT.setSize(w, h);
        this.dispRT.setSize(w, h);
    }

    setBackdrop(texture) {
        this.bgTexture?.dispose();
        this.bgTexture = texture;
        if (texture) {
            texture.colorSpace = THREE.NoColorSpace; // sampled as display colour
            texture.needsUpdate = true;
        }
    }

    /** Place the camera drawn with at time t (the user's, turned by the orbit about the target). */
    viewAt(p, t) {
        const v = this.view;
        v.copy(this.camera);
        v.fov = p.fov;
        v.aspect = this.width / this.height;
        if (p.orbit) {
            const off = v.position.clone().sub(this.target);
            off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad(p.orbit * t));
            v.position.copy(this.target).add(off);
            v.lookAt(this.target);
        }
        v.updateProjectionMatrix();
        v.updateMatrixWorld();
        return v;
    }

    /** The manifold's placement at time t: transform, then spin. */
    place(p, t) {
        const r = this.root;
        r.position.set(p.posX, p.posY, p.posZ);
        r.rotation.set(rad(p.rotX + p.spinX * t), rad(p.rotY + p.spinY * t), rad(p.rotZ + p.spinZ * t), 'XYZ');
        r.scale.setScalar(p.scale);
        r.updateMatrixWorld(true);
    }

    /**
     * Draw a frame. `outW` the frame's width in output pixels (line widths
     * are in those); `overlay` draws the editor on top.
     */
    render(p, t, { outW, overlay = true } = {}) {
        if (this.lost) return null;
        const r = this.renderer;
        const stats = this.manifold.sync(p, t);
        this.place(p, t);
        const cam = this.viewAt(p, t);

        const k = this.key;
        k.intensity = p.keyLight;
        k.position.set(
            Math.cos(rad(p.keyPitch)) * Math.sin(rad(p.keyYaw)),
            Math.sin(rad(p.keyPitch)),
            Math.cos(rad(p.keyPitch)) * Math.cos(rad(p.keyYaw)),
        ).multiplyScalar(10);

        r.autoClear = true;
        r.setClearColor(0x000000, 0);

        // 1. Colour
        this.manifold.setPass('color');
        k.visible = true;
        r.setRenderTarget(this.colorRT);
        r.clear(true, true, true);
        r.render(this.scene, cam);

        // 2. G-buffer
        this.manifold.setPass('gbuffer');
        r.setRenderTarget(this.gRT);
        r.clear(true, true, true);
        r.render(this.scene, cam);
        this.manifold.setPass('color');

        // 3. Display
        const d = this.display.uniforms;
        const bgImage = p.bgMode === 'image' && this.bgTexture?.image;
        d.uBgMode.value = p.bgMode === 'transparent' ? 2 : bgImage ? 1 : 0;
        d.uBg.value.setStyle(p.bgColor, THREE.NoColorSpace);
        d.tBg.value = bgImage ? this.bgTexture : null;
        if (bgImage) {
            // Cover: fill the frame, crop the overflow.
            const img = this.bgTexture.image;
            const ia = (img.videoWidth || img.width) / (img.videoHeight || img.height);
            const fa = this.width / this.height;
            if (ia > fa) { d.uBgScale.value.set(fa / ia, 1); d.uBgOffset.value.set((1 - fa / ia) / 2, 0); } else { d.uBgScale.value.set(1, ia / fa); d.uBgOffset.value.set(0, (1 - ia / fa) / 2); }
        }
        d.uExposure.value = p.exposure;
        d.uTone.value = p.toneMap === 'clip' ? 1 : 0;
        r.setRenderTarget(this.dispRT);
        r.render(this.quadScene, this.quadCam);

        // 4. Lines & fill, to the canvas
        this.edge.run({
            src: this.dispRT.texture,
            gbuffer: this.gRT.texture,
            params: p,
            width: this.width,
            height: this.height,
            outW: outW || this.width,
            time: t,
            target: null,
            premultiply: p.bgMode === 'transparent',
        });

        // 5. Overlay
        if (overlay) this.beforeOverlay?.(p, t);
        if (overlay && this.overlay.children.length) {
            r.autoClear = false;
            r.setRenderTarget(null);
            r.clearDepth();
            r.render(this.overlay, cam);
            r.autoClear = true;
        }
        return stats;
    }

    dispose() {
        this.manifold.dispose();
        this.envs.dispose();
        this.edge.dispose();
        this.display.dispose();
        this.colorRT.dispose();
        this.gRT.dispose();
        this.dispRT.dispose();
        this.bgTexture?.dispose();
        this.renderer.dispose();
    }
}
