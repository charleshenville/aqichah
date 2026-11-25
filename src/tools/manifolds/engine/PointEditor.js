// Editing defining points in the viewport: markers on every strand's points
// (the selected strand's large, with its control cage: the polygon through
// its points, or a Bézier's anchor-to-handle arms), a click to pick a strand
// (on its surface) or a point (on its marker), and a move gizmo on the
// picked point.
//
// Markers sit where the points are drawn now (moved by the wobble, placed,
// spun and breathing), in the overlay the Stage draws after the frame, so
// they are never in an export. A drag reports the point's new rest position
// (its position before the wobble) in the manifold's own space.

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { posePoints } from '../model/strands';
import { isHandle } from '../model/curves';

const MARKER_PX = { big: 11, small: 5 };
const COLORS = {
    anchor: new THREE.Color('#ffffff'),
    handle: new THREE.Color('#ffb648'),
    picked: new THREE.Color('#38e1ff'),
    dim: new THREE.Color('#9aa0a6'),
};

export default class PointEditor {
    /**
     * `onPick({ id, point })` when something is clicked (point -1: the strand);
     * `onMove(id, point, restPos, done)` while dragging and once more at the end.
     */
    constructor(stage, { onPick, onMove, onDragging }) {
        this.stage = stage;
        this.onPick = onPick;
        this.onMove = onMove;
        this.onDragging = onDragging;
        this.enabled = false;
        this.showAll = true;
        this.sel = { id: null, point: -1 };
        this.entries = []; // instance -> { id, point }

        this.group = new THREE.Group();
        this.group.matrixAutoUpdate = false;
        this.group.visible = false;
        stage.overlay.add(this.group);

        this.capacity = 0;
        this.markerGeo = new THREE.OctahedronGeometry(0.5, 0);
        this.markerMat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
        this.markers = null;
        this.ensure(256);

        this.cage = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                color: 0x38e1ff, depthTest: false, transparent: true, opacity: 0.7, toneMapped: false,
            }),
        );
        this.cage.frustumCulled = false;
        this.cage.renderOrder = 1;
        this.group.add(this.cage);

        this.proxy = new THREE.Object3D();
        this.group.add(this.proxy);
        this.gizmo = new TransformControls(stage.view, stage.renderer.domElement);
        this.gizmo.setSize(0.8);
        this.gizmo.addEventListener('dragging-changed', (e) => {
            this.dragging = e.value;
            this.onDragging?.(e.value);
            if (!e.value && this.drag) {
                this.report(true);
                this.drag = null;
            }
        });
        this.gizmo.addEventListener('mouseDown', () => {
            if (!this.current) return;
            this.drag = { start: this.proxy.position.clone(), rest: this.current.rest.slice() };
        });
        this.gizmo.addEventListener('objectChange', () => { if (this.drag) this.report(false); });
        stage.overlay.add(this.gizmo);
        this.raycaster = new THREE.Raycaster();
    }

    ensure(n) {
        if (n <= this.capacity) return;
        const cap = Math.max(n, this.capacity * 2);
        if (this.markers) {
            this.group.remove(this.markers);
            this.markers.dispose();
        }
        this.markers = new THREE.InstancedMesh(this.markerGeo, this.markerMat, cap);
        this.markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.markers.frustumCulled = false;
        this.markers.renderOrder = 2;
        this.markers.count = 0;
        this.group.add(this.markers);
        this.capacity = cap;
    }

    report(done) {
        const { drag } = this;
        if (!drag || !this.current) return;
        const d = this.proxy.position.clone().sub(drag.start);
        const pos = [drag.rest[0] + d.x, drag.rest[1] + d.y, drag.rest[2] + d.z];
        this.onMove?.(this.sel.id, this.sel.point, pos, done);
    }

    setEnabled(on) {
        this.enabled = on;
        this.group.visible = on;
        if (!on) this.gizmo.detach();
    }

    setSelection(sel) {
        this.sel = sel || { id: null, point: -1 };
    }

    /** Lay the markers out for this frame (after the Stage has synced and placed). */
    update(p, t) {
        if (!this.enabled) {
            this.gizmo.detach();
            return;
        }
        const { stage } = this;
        const mesh = stage.manifold.mesh;
        mesh.updateMatrixWorld(true);
        this.group.matrix.copy(mesh.matrixWorld);
        this.group.matrixWorld.copy(mesh.matrixWorld);
        this.group.updateMatrixWorld(true);
        const strands = stage.manifold.strands;
        const cam = stage.view;
        const H = stage.height;
        const worldScale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
        const pxToWorld = (dist, px) => ((dist * 2 * Math.tan((cam.fov * Math.PI) / 360)) / H) * px * (H / Math.max(1, this.cssHeight || H));

        const kind = p.curve;
        const entries = [];
        const posed = new Map();
        strands.forEach((st) => {
            const selected = st.id === this.sel.id;
            if (!selected && (!this.showAll || st.hidden)) return;
            const pts = posePoints(st.points, p, t);
            posed.set(st.id, pts);
            pts.forEach((q, k) => {
                if (!selected && isHandle(kind, k)) return;
                entries.push({
                    id: st.id, point: k, q, selected, handle: isHandle(kind, k),
                });
            });
        });
        this.ensure(entries.length);
        const m = new THREE.Matrix4();
        const v = new THREE.Vector3();
        entries.forEach((e, n) => {
            v.set(e.q[0], e.q[1], e.q[2]).applyMatrix4(mesh.matrixWorld);
            const dist = v.distanceTo(cam.position);
            const picked = e.selected && e.point === this.sel.point;
            const px = e.selected ? MARKER_PX.big * (picked ? 1.3 : 1) : MARKER_PX.small;
            const s = pxToWorld(dist, px) / worldScale;
            m.makeScale(s, s, s).setPosition(e.q[0], e.q[1], e.q[2]);
            this.markers.setMatrixAt(n, m);
            const c = picked ? COLORS.picked : e.handle ? COLORS.handle : e.selected ? COLORS.anchor : COLORS.dim;
            this.markers.setColorAt(n, c);
        });
        this.markers.count = entries.length;
        this.markers.instanceMatrix.needsUpdate = true;
        if (this.markers.instanceColor) this.markers.instanceColor.needsUpdate = true;
        this.entries = entries;

        // The selected strand's cage.
        const sp = posed.get(this.sel.id);
        const seg = [];
        if (sp) {
            if (kind === 'bezier' && sp.length >= 4) {
                for (let k = 0; k + 3 < sp.length; k += 3) seg.push(sp[k], sp[k + 1], sp[k + 2], sp[k + 3]);
            } else {
                for (let k = 0; k + 1 < sp.length; k++) seg.push(sp[k], sp[k + 1]);
            }
        }
        const arr = new Float32Array(seg.length * 3);
        seg.forEach((q, n) => { arr[n * 3] = q[0]; arr[n * 3 + 1] = q[1]; arr[n * 3 + 2] = q[2]; });
        this.cage.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        this.cage.geometry.setDrawRange(0, seg.length);

        // The gizmo on the picked point (left alone while it's being dragged).
        const st = strands.find((x) => x.id === this.sel.id);
        const rest = st && this.sel.point >= 0 ? st.points[this.sel.point] : null;
        if (!rest) {
            this.current = null;
            this.gizmo.detach();
            return;
        }
        this.current = { rest };
        if (!this.dragging) {
            const q = sp[this.sel.point];
            this.proxy.position.set(q[0], q[1], q[2]);
            this.proxy.updateMatrixWorld(true);
        }
        if (this.gizmo.object !== this.proxy) this.gizmo.attach(this.proxy);
    }

    /** Whether the pointer is over the gizmo (so a click there isn't a pick). */
    overGizmo() {
        return this.gizmo.object && this.gizmo.axis !== null;
    }

    /** Pick at normalised device coordinates: a marker first, then a strand's surface. */
    pick(ndc) {
        if (!this.enabled) return null;
        const rc = this.raycaster;
        rc.setFromCamera(ndc, this.stage.view);
        if (this.markers.count) {
            const hits = rc.intersectObject(this.markers, false);
            if (hits.length) {
                // Prefer the selected strand's markers when they overlap others.
                const sel = hits.find((h) => this.entries[h.instanceId]?.selected) || hits[0];
                const e = this.entries[sel.instanceId];
                if (e) return { id: e.id, point: e.point };
            }
        }
        const mesh = this.stage.manifold.mesh;
        const hits = rc.intersectObject(mesh, false);
        if (hits.length && hits[0].face) {
            const si = this.stage.manifold.geo.strandOfVertex(hits[0].face.a);
            const st = this.stage.manifold.strands[si];
            if (st) return { id: st.id, point: -1 };
        }
        return { id: null, point: -1 };
    }

    dispose() {
        this.gizmo.detach();
        this.gizmo.dispose();
        this.markers?.dispose();
        this.markerGeo.dispose();
        this.markerMat.dispose();
        this.cage.geometry.dispose();
        this.cage.material.dispose();
        this.group.removeFromParent();
        this.gizmo.removeFromParent();
    }
}
