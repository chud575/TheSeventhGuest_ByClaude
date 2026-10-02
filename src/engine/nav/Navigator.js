import * as THREE from 'three';
import { Events } from '../core/Events.js';

const v3 = (a) => (a?.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function lookQuat(pos, target, roll = 0) {
  const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return q;
}

/**
 * Node-graph camera navigation in the spirit of the original's pre-rendered
 * flythroughs: cinematic spline glides between viewpoints with ease-in/out,
 * look-ahead orientation, gentle head-bob and sway; free-look at rest.
 *
 * Node: { position, target, fov?, look?: { yaw: [minDeg,maxDeg], pitch: [minDeg,maxDeg] }, label?, dof?, grade? }
 * Edge: [a, b, pathPoints?, options?] or { from, to, points?, oneWay?, duration?, hotspot? }
 */
export class Navigator extends Events {
  constructor(camera, settings) {
    super();
    this.camera = camera;
    this.settings = settings;
    this.nodes = {};
    this.edges = [];
    this.exits = [];
    this.current = null;
    this.previous = null;
    this.history = [];
    this.moving = false;
    this.locked = 0;
    this.baseFov = settings?.get('fov') ?? 55;
    this.yaw = 0; this.pitch = 0;           // free-look offsets (radians), smoothed
    this.yawTarget = 0; this.pitchTarget = 0;
    this.zoom = 1; this.zoomTarget = 1;
    this._tr = null;
    this._bobPhase = 0;
    this._idleT = 0;
    this.basePos = new THREE.Vector3();
    this.baseQuat = new THREE.Quaternion();
    this.baseFovCur = this.baseFov;
    this.override = null; // custom camera pose (puzzles / cinematics)
  }

  setGraph(nodes, edges = [], exits = []) {
    this.nodes = {};
    for (const [id, n] of Object.entries(nodes)) {
      this.nodes[id] = { id, ...n, position: v3(n.position), target: v3(n.target) };
    }
    this.edges = edges.map((e) => {
      if (Array.isArray(e)) {
        const [a, b, pts, opt] = e;
        return { from: a, to: b, points: (pts || []).map(v3), ...(opt || {}) };
      }
      return { ...e, from: e.from ?? e.a, to: e.to ?? e.b, points: (e.points || []).map(v3) };
    });
    this.exits = exits.slice();
    this.current = null; this.previous = null; this.history = [];
    this._tr = null; this.moving = false; this.override = null;
  }

  node(id) { return this.nodes[id]; }

  /** [{ to, edge, reverse }] reachable from node */
  neighbors(id = this.current) {
    const out = [];
    for (const e of this.edges) {
      if (e.from === id) out.push({ to: e.to, edge: e, reverse: false });
      else if (e.to === id && !e.oneWay) out.push({ to: e.from, edge: e, reverse: true });
    }
    return out;
  }

  fovFor(n) { return n?.fov ?? this.baseFov; }

  jumpTo(id) {
    const n = this.nodes[id];
    if (!n) throw new Error(`[nav] unknown node ${id}`);
    this.previous = this.current;
    this.current = id;
    this._tr = null; this.moving = false;
    this.basePos.copy(n.position);
    this.baseQuat.copy(lookQuat(n.position, n.target));
    this.baseFovCur = this.fovFor(n);
    this.yaw = this.yawTarget = 0; this.pitch = this.pitchTarget = 0;
    this.zoom = this.zoomTarget = 1;
    this._apply(0);
    this.emit('arrive', id, this.previous);
  }

  get busy() { return this.moving || this.locked > 0; }

  /** Glide to an adjacent node (or any node with explicit path). Resolves on arrival. */
  goTo(id, { duration, instant = false, viaEdge } = {}) {
    if (!this.nodes[id]) return Promise.reject(new Error(`[nav] unknown node ${id}`));
    if (id === this.current && !this.override) return Promise.resolve();
    const from = this.current;
    const A = this.nodes[from], B = this.nodes[id];
    const nb = viaEdge ? { edge: viaEdge, reverse: viaEdge.to === from } : this.neighbors(from).find((x) => x.to === id);
    let pts = [];
    if (nb) pts = nb.reverse ? nb.edge.points.slice().reverse() : nb.edge.points.slice();
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();
    const startFov = this.camera.fov;
    const endQuat = lookQuat(B.position, B.target);
    const curvePts = [startPos, ...pts, B.position.clone()];
    const dist = curvePts.reduce((s, p, i) => (i ? s + p.distanceTo(curvePts[i - 1]) : 0), 0);
    const angle = startQuat.angleTo(endQuat);
    const speed = this.settings?.get('transitionSpeed') ?? 1;
    const reduce = this.settings?.get('reduceMotion');
    let dur = duration ?? nb?.edge.duration ?? Math.max(0.65, Math.min(4.5, 0.55 + dist / 1.55 + angle * 0.35));
    dur /= speed;
    const mode = reduce || instant ? 'dissolve' : 'glide';
    const curve = curvePts.length >= 3 && dist > 0.05
      ? new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.5)
      : new THREE.LineCurve3(startPos, B.position.clone());
    this.override = null;
    this.previous = from;
    this.history.push(from);
    if (this.history.length > 64) this.history.shift();
    this.moving = true;
    this.emit('depart', from, id, { mode, duration: dur });
    return new Promise((resolve) => {
      this._tr = {
        kind: 'edge', to: id, curve, dist, t: 0, dur: mode === 'dissolve' ? Math.min(0.7, dur * 0.45) : dur,
        startQuat, endQuat, startFov, endFov: this.fovFor(B), mode, resolve,
        startYaw: this.yaw, startPitch: this.pitch,
      };
    });
  }

  /** Go back along history. */
  back() {
    const prev = this.history[this.history.length - 1];
    if (prev && this.neighbors().some((n) => n.to === prev)) {
      this.history.pop();
      return this.goTo(prev).then(() => this.history.pop());
    }
    return Promise.resolve();
  }

  /**
   * Fly the camera to an arbitrary pose (puzzle views, inspect close-ups,
   * cinematics). Navigation is suspended until returnToNode().
   */
  flyTo({ position, target, fov }, duration = 1.2) {
    const p = v3(position), tg = v3(target);
    this.moving = true;
    const startPos = this.camera.position.clone();
    const mid = startPos.clone().lerp(p, 0.5);
    const curve = new THREE.CatmullRomCurve3([startPos, mid, p]);
    return new Promise((resolve) => {
      this._tr = {
        kind: 'fly', curve, t: 0, dur: Math.max(0.05, duration / (this.settings?.get('transitionSpeed') ?? 1)),
        startQuat: this.camera.quaternion.clone(), endQuat: lookQuat(p, tg), startFov: this.camera.fov, endFov: fov ?? this.camera.fov,
        mode: this.settings?.get('reduceMotion') ? 'dissolve' : 'glide', resolve,
        pose: { position: p, target: tg, fov: fov ?? this.camera.fov },
        startYaw: this.yaw, startPitch: this.pitch,
      };
    });
  }

  returnToNode(duration = 1.0) {
    const n = this.nodes[this.current];
    if (!n) return Promise.resolve();
    const r = this.flyTo({ position: n.position, target: n.target, fov: this.fovFor(n) }, duration);
    return r.then(() => { this.override = null; this.emit('arrive', this.current, this.current); });
  }

  skip() {
    if (this._tr) {
      // compress the remaining time into a quick ease-out
      const left = this._tr.dur * (1 - this._tr.t);
      if (left > 0.25) { this._tr.skipFrom = this._tr.t; this._tr.skipT = 0; this._tr.skipDur = 0.2; }
    }
  }

  /** free-look input in radians (accumulates) */
  look(dYaw, dPitch) {
    if (this._tr || this.override?.lockLook) return;
    const n = this.nodes[this.current];
    const lim = n?.look || {};
    const yl = (lim.yaw || [-40, 40]).map(THREE.MathUtils.degToRad);
    const pl = (lim.pitch || [-24, 22]).map(THREE.MathUtils.degToRad);
    this.yawTarget = THREE.MathUtils.clamp(this.yawTarget + dYaw, yl[0], yl[1]);
    this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget + dPitch, pl[0], pl[1]);
  }
  resetLook() { this.yawTarget = 0; this.pitchTarget = 0; this.zoomTarget = 1; }
  setZoom(z) { this.zoomTarget = THREE.MathUtils.clamp(z, 0.45, 1); }

  update(dt, t) {
    const tr = this._tr;
    if (tr) {
      let p;
      if (tr.skipDur) {
        tr.skipT += dt;
        const k = Math.min(1, tr.skipT / tr.skipDur);
        tr.t = tr.skipFrom + (1 - tr.skipFrom) * (1 - (1 - k) * (1 - k));
      } else {
        tr.t = Math.min(1, tr.t + dt / tr.dur);
      }
      p = tr.t;
      this.emit('progress', p, tr);
      if (tr.mode === 'dissolve') {
        // jump at the midpoint under the dissolve (handled by the game via 'dissolve' event)
        if (!tr.cut && p >= 0.0) { tr.cut = true; this.emit('cut', tr); }
        this._setPoseFromTransition(tr, 1, 0);
      } else {
        const e = tr.kind === 'fly' ? easeInOutSine(p) : easeInOut(p);
        this._setPoseFromTransition(tr, e, p);
      }
      if (tr.t >= 1) {
        this._tr = null;
        this.moving = false;
        if (tr.kind === 'edge') {
          this.current = tr.to;
          this.yaw = this.yawTarget = 0; this.pitch = this.pitchTarget = 0;
          const n = this.nodes[tr.to];
          this.basePos.copy(n.position); this.baseQuat.copy(tr.endQuat); this.baseFovCur = tr.endFov;
          this.emit('arrive', tr.to, this.previous);
        } else {
          this.override = { ...tr.pose, quat: tr.endQuat.clone(), lockLook: false };
          this.basePos.copy(tr.pose.position); this.baseQuat.copy(tr.endQuat); this.baseFovCur = tr.endFov;
          this.yaw = this.yawTarget = 0; this.pitch = this.pitchTarget = 0;
        }
        tr.resolve();
      }
      return;
    }
    this._apply(dt, t);
  }

  _setPoseFromTransition(tr, e, rawP) {
    const cam = this.camera;
    const reduce = this.settings?.get('reduceMotion');
    const pos = tr.curve.getPointAt(Math.min(1, Math.max(0, e)));
    // orientation: start -> look-ahead along path -> end
    let q;
    if (tr.kind === 'edge' && tr.dist > 0.4) {
      const tan = tr.curve.getTangentAt(Math.min(0.999, Math.max(0.001, e)));
      const ahead = pos.clone().add(tan);
      // keep a little of the destination's pitch while moving
      const endDir = new THREE.Vector3(0, 0, -1).applyQuaternion(tr.endQuat);
      ahead.y += endDir.y * 0.35;
      const qt = lookQuat(pos, ahead);
      const q1 = tr.startQuat.clone().slerp(qt, smooth(0.0, 0.35, e));
      q = q1.slerp(tr.endQuat, smooth(0.55, 1.0, e));
    } else {
      q = tr.startQuat.clone().slerp(tr.endQuat, e);
    }
    // head-bob + sway (walk cadence tied to distance travelled)
    if (!reduce && tr.kind === 'edge' && tr.dist > 0.4 && tr.mode === 'glide') {
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, rawP)));
      const phase = e * tr.dist * 2.1 * Math.PI;
      pos.y += Math.sin(phase * 2) * 0.012 * env;
      pos.x += 0;
      const roll = Math.sin(phase) * 0.006 * env;
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    }
    cam.position.copy(pos);
    cam.quaternion.copy(q);
    cam.fov = THREE.MathUtils.lerp(tr.startFov, tr.endFov, e);
    cam.updateProjectionMatrix();
  }

  _apply(dt, t = 0) {
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 10);
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.pitch += (this.pitchTarget - this.pitch) * k;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 8));
    const q = this.baseQuat.clone();
    // yaw around world up, pitch around local right
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    q.premultiply(qy);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch));
    cam.position.copy(this.basePos);
    // idle "breathing" drift — very subtle; disabled with reduced motion
    if (!this.settings?.get('reduceMotion') && dt > 0) {
      this._idleT += dt;
      const s = this._idleT;
      cam.position.y += Math.sin(s * 0.9) * 0.0025;
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(s * 0.53) * 0.0012, Math.sin(s * 0.41) * 0.0016, 0)));
    }
    cam.quaternion.copy(q);
    const fov = this.baseFovCur * this.zoom;
    if (Math.abs(cam.fov - fov) > 1e-4) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  /** world-space forward direction of a node */
  nodeDirection(id) {
    const n = this.nodes[id];
    return new THREE.Vector3().subVectors(n.target, n.position).normalize();
  }
}
