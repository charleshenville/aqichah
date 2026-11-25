// A manifold as a three.js object: one mesh of swept strands with its
// surface material, rebuilt from resolved parameters at a time.
//
// Shaped like the compositor's adapters (engine/adapters.js):
//   object          the THREE.Object3D to place (the host sets its position,
//                   rotation, scale and spin: those are the host's)
//   sync(p, t, o)   every frame, with resolved parameters and the time;
//                   rebuilds only what changed (the mesh when its parameters,
//                   edits or a moving time do; the environment when its
//                   settings do). `o.envMap` reflects that instead of its sky
//                   (the compositor's capture of the scene around it)
//   setPass(pass)   'color' or 'gbuffer' (normals and depth for Lines)
//   dispose()
//
// Everything is a function of (p, t), so any frame can be drawn in any order.

import * as THREE from 'three';
import StrandGeometry from './geometry';
import {
    makeHoleUniforms, makeSurface, makeGBuffer, applySurface,
} from './materials';
import {
    restStrands, makeCache, loopPhase, breatheScale, pointsMove,
} from '../model/strands';
import { OBJECT_GROUPS } from '../params';

// Parameters that shape the mesh: every object parameter but the material,
// reflections and holes (those are uniforms), plus the colours (vertex colours).
const NOT_MESH = new Set(['Material', 'Reflections', 'Holes']);
const MESH_KEYS = [
    ...OBJECT_GROUPS.filter((g) => !NOT_MESH.has(g.title)).flatMap((g) => g.params.map((d) => d.key)),
    'colorMode', 'colorA', 'colorB',
].filter((k) => k !== 'breathe' && k !== 'breatheCycles' && k !== 'holeFlow');

/** Whether the mesh changes with time at these parameters. */
const meshMoves = (p) => pointsMove(p) || (Math.round(p.twistFlow || 0) !== 0) || (p.swell > 0 && Math.round(p.swellFlow || 0) !== 0);

export default class ManifoldObject {
    /** `envs`: an Environments (engine/environment.js) for the renderer this is drawn with. */
    constructor({ envs }) {
        this.envs = envs;
        this.geo = new StrandGeometry();
        this.holes = makeHoleUniforms();
        this.surface = makeSurface(this.holes);
        this.gbuffer = makeGBuffer(this.holes);
        this.mesh = new THREE.Mesh(this.geo.geometry, this.surface);
        this.mesh.frustumCulled = false;
        // So a host drawing a G-buffer of its scene can find it and use its own (holes and all).
        this.mesh.userData.manifold = this;
        this.object = new THREE.Group();
        this.object.add(this.mesh);
        this.cache = makeCache();
        this.meshKey = '';
        this.colors = { a: new THREE.Color(), b: new THREE.Color() };
        this.stats = this.geo.stats;
        this.strands = [];
    }

    /**
     * The strands at rest (generated points with edits, then hand-drawn),
     * as the editor shows them. `coord` reads a coordinate (see model/strands).
     */
    rest(p, coord) {
        return restStrands(p, this.cache, coord);
    }

    sync(p, t, { coord, envMap = null } = {}) {
        const strands = this.rest(p, coord);
        this.strands = strands;
        const moving = meshMoves(p);
        const key = `${MESH_KEYS.map((k) => p[k]).join('|')}|${moving ? loopPhase(p, t) : ''}`;
        if (key !== this.meshKey || this.lastStrands !== strands) {
            this.meshKey = key;
            this.lastStrands = strands;
            this.colors.a.set(p.colorA);
            this.colors.b.set(p.colorMode === 'solid' ? p.colorA : p.colorB);
            this.stats = this.geo.build(strands, p, t, this.colors);
        }
        this.mesh.scale.setScalar(breatheScale(p, t));

        this.holes.uHoles.value = p.holes;
        this.holes.uHoleScale.value = p.holeScale;
        this.holes.uHoleJitter.value = p.holeJitter;
        this.holes.uHoleShift.value = Math.round(p.holeFlow || 0) * loopPhase(p, t) * 4;

        const env = envMap || (this.envs ? this.envs.get(p).texture : null);
        applySurface(this.surface, p, env);
        return this.stats;
    }

    setPass(pass) {
        this.mesh.material = pass === 'gbuffer' ? this.gbuffer : this.surface;
    }

    dispose() {
        this.geo.dispose();
        this.surface.dispose();
        this.gbuffer.dispose();
        this.object.removeFromParent();
    }
}
