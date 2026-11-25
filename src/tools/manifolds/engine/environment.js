// What a manifold's metal reflects: a small scene rendered into a
// prefiltered environment map (PMREM), set on the material itself (not the
// scene), so the object brings its own reflections wherever it is placed.
//
//   studio   a dark room with hard strip lights (the classic chrome look)
//   sky      blue overhead, white at the horizon, soft clouds, a grey ground
//   stripes  hard bands of two colours by latitude (graphic, ink-friendly)
//   room     three's RoomEnvironment
//   image    any picture, as an equirectangular panorama
//
// Turn and tilt rotate the scene before it is captured. Maps are cached per
// renderer by their settings; a change builds a new one (a few ms).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';

export const ENV_KEYS = ['env', 'envRotate', 'envTilt', 'envBands', 'envColorA', 'envColorB'];

const linear = (hex) => new THREE.Color(hex);

const SKY_FRAG = /* glsl */`
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uBands;
uniform int uMode;
varying vec3 vDir;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

void main() {
    vec3 d = normalize(vDir);
    vec3 col;
    if (uMode == 0) {
        // Sky
        float h = d.y;
        vec3 sky = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
        float cl = smoothstep(0.48, 0.78, fbm(d * 3.2 + vec3(0.0, 0.0, 2.0))) * smoothstep(-0.02, 0.25, h);
        sky = mix(sky, vec3(1.25), cl);
        // A dark ground under a bright horizon: the contrast chrome reads by.
        vec3 ground = mix(uGround * 1.6, uGround * 0.35, clamp(-h * 4.0, 0.0, 1.0));
        col = h >= 0.0 ? sky : ground;
        // A sun, for a hard highlight.
        col += vec3(12.0) * pow(max(dot(d, normalize(vec3(0.4, 0.55, 0.3))), 0.0), 900.0);
    } else {
        // Bands by latitude, hard-edged.
        float lat = asin(clamp(d.y, -1.0, 1.0));
        float b = step(0.0, sin(lat * uBands * 2.0 + 0.3));
        col = mix(uTop * 0.15, uHorizon * 1.6, b);
    }
    gl_FragColor = vec4(col, 1.0);
}`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = (modelMatrix * vec4(position, 0.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function skyScene(p, mode) {
    const scene = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            uTop: { value: linear(p.envColorA) },
            uHorizon: { value: linear(p.envColorB) },
            uGround: { value: new THREE.Color(0.07, 0.07, 0.08) },
            uBands: { value: Math.max(1, p.envBands) },
            uMode: { value: mode },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), mat));
    return scene;
}

function studioScene(p) {
    // A grey cyclorama: lighter overhead, darker underfoot, with a horizon
    // line, hard strip lights round it and a big soft box above. Chrome
    // reads by the contrast between these, so none of them is black.
    const scene = new THREE.Scene();
    const room = new THREE.Mesh(
        new THREE.SphereGeometry(50, 48, 24),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            vertexShader: SKY_VERT,
            fragmentShader: /* glsl */`
                varying vec3 vDir;
                void main() {
                    float h = normalize(vDir).y;
                    vec3 up = vec3(0.42, 0.42, 0.44);
                    vec3 mid = vec3(0.16, 0.16, 0.17);
                    vec3 low = vec3(0.025, 0.025, 0.03);
                    vec3 c = h > 0.0 ? mix(mid, up, pow(h, 0.7)) : mix(mid * 0.5, low, clamp(-h * 3.0, 0.0, 1.0));
                    c += vec3(0.9) * smoothstep(0.035, 0.0, abs(h - 0.02));
                    gl_FragColor = vec4(c, 1.0);
                }`,
        }),
    );
    scene.add(room);
    const n = Math.max(1, Math.round(p.envBands));
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8, 8), side: THREE.DoubleSide });
    const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.5), side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        const tall = i % 2 === 0;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(tall ? 2.6 : 12, tall ? 22 : 2.2), i % 3 === 2 ? soft : strip);
        m.position.set(Math.cos(a) * 16, tall ? 2 : 5 + (i % 4) * 1.5, Math.sin(a) * 16);
        m.lookAt(0, m.position.y * 0.3, 0);
        scene.add(m);
    }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), soft);
    top.position.y = 16;
    top.rotation.x = Math.PI / 2;
    scene.add(top);
    return scene;
}

function imageScene(texture) {
    const scene = new THREE.Scene();
    const tex = texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.UVMapping;
    const m = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
    // An equirect seen from inside reads mirrored; flip it back.
    m.scale.x = -1;
    scene.add(m);
    return scene;
}

/** Environment maps for one renderer, cached by their settings. */
export default class Environments {
    constructor(renderer) {
        this.renderer = renderer;
        this.pmrem = new THREE.PMREMGenerator(renderer);
        this.cache = new Map();
        this.image = null; // a THREE.Texture for 'image'
        this.imageVersion = 0;
    }

    setImage(texture) {
        this.image?.dispose();
        this.image = texture;
        this.imageVersion += 1;
    }

    key(p) {
        const k = ENV_KEYS.map((x) => p[x]).join('|');
        return p.env === 'image' ? `${k}|${this.imageVersion}` : k;
    }

    /** The prefiltered map for these parameters. */
    get(p) {
        const key = this.key(p);
        if (this.cache.has(key)) return this.cache.get(key);
        let scene;
        if (p.env === 'room') scene = new RoomEnvironment();
        else if (p.env === 'sky') scene = skyScene(p, 0);
        else if (p.env === 'stripes') scene = skyScene(p, 1);
        else if (p.env === 'image' && this.image) scene = imageScene(this.image);
        else scene = studioScene(p);
        scene.rotation.set(((p.envTilt || 0) * Math.PI) / 180, ((p.envRotate || 0) * Math.PI) / 180, 0, 'YXZ');
        scene.updateMatrixWorld(true);
        const rt = this.pmrem.fromScene(scene, 0, 0.1, 100);
        scene.traverse((o) => {
            if (o.isMesh) {
                o.geometry.dispose();
                if (o.material.map !== this.image) o.material.map?.dispose();
                o.material.dispose();
            }
        });
        // Keep a few; drop the oldest.
        if (this.cache.size >= 6) {
            const [oldKey, old] = this.cache.entries().next().value;
            this.cache.delete(oldKey);
            old.dispose();
        }
        this.cache.set(key, rt);
        return rt;
    }

    dispose() {
        this.cache.forEach((rt) => rt.dispose());
        this.cache.clear();
        this.pmrem.dispose();
        this.image?.dispose();
    }
}
