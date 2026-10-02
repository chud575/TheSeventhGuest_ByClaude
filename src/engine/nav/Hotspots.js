import * as THREE from 'three';

/**
 * Hotspot registry + picking.
 * Hotspot (normalised):
 *   { id, nodes: Set|null, cursor, label, onActivate(ctx, hs), enabled(): bool,
 *     object?: Object3D, box?: Box3, sphere?: Sphere, priority, kind: 'room'|'move'|'exit' }
 * Room authors pass: { id, node | nodes, object | bbox | box | sphere | position+radius,
 *                      cursor, label, onActivate, enabled?, priority? }
 */
export function normalizeHotspot(h, kind = 'room') {
  const nodes = h.nodes ? new Set([].concat(h.nodes)) : h.node ? new Set([].concat(h.node)) : null;
  let box = null, sphere = null;
  const bb = h.bbox || h.box;
  if (bb) box = bb.isBox3 ? bb.clone() : new THREE.Box3(new THREE.Vector3(...bb.min), new THREE.Vector3(...bb.max));
  if (h.sphere) sphere = h.sphere.isSphere ? h.sphere.clone() : new THREE.Sphere(new THREE.Vector3(...h.sphere.center), h.sphere.radius);
  if (h.position && !box && !sphere && !h.object) {
    const p = h.position.isVector3 ? h.position.clone() : new THREE.Vector3(...h.position);
    sphere = new THREE.Sphere(p, h.radius ?? 0.5);
  }
  return {
    ...h,
    kind,
    priority: h.priority ?? (kind === 'room' ? 1 : 0),
    cursor: h.cursor || (kind === 'room' ? 'examine' : 'move'),
    label: h.label || '',
    enabled: typeof h.enabled === 'function' ? h.enabled : () => h.enabled !== false,
    nodes, box, sphere,
  };
}

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _box = new THREE.Box3();

export class Hotspots {
  constructor(camera) {
    this.camera = camera;
    this.room = [];
    this.auto = [];
    this.temp = [];   // puzzle / cinematic scoped
  }
  setRoom(list = []) { this.room = list.map((h) => normalizeHotspot(h, 'room')); }
  setAuto(list = []) { this.auto = list; }
  add(h) { const n = normalizeHotspot(h, h.kind || 'room'); this.room.push(n); return n; }
  remove(id) { this.room = this.room.filter((h) => h.id !== id); }
  clear() { this.room = []; this.auto = []; this.temp = []; }

  active(nodeId) {
    const all = [...this.room, ...this.auto];
    return all.filter((h) => (!h.nodes || h.nodes.has(nodeId)) && safeEnabled(h));
  }

  /** @param {THREE.Vector2} ndc */
  pick(ndc, nodeId) {
    _ray.setFromCamera(ndc, this.camera);
    let best = null, bestScore = Infinity;
    for (const h of this.active(nodeId)) {
      const d = intersect(h, _ray);
      if (d == null) continue;
      const score = d - h.priority * 0.75;
      if (score < bestScore) { bestScore = score; best = h; }
    }
    return best;
  }

  /** World-space anchor for markers / gamepad snapping. */
  anchor(h, out = new THREE.Vector3()) {
    if (h.anchor) return out.copy(h.anchor.isVector3 ? h.anchor : _v.set(...h.anchor));
    if (h.sphere) return out.copy(h.sphere.center);
    if (h.box) return h.box.getCenter(out);
    if (h.object) { _box.setFromObject(h.object); return _box.getCenter(out); }
    return out.set(0, 0, 0);
  }

  /** Visible hotspots with screen positions (for Tab highlight / gamepad cycling). */
  screenList(nodeId, width, height) {
    const res = [];
    for (const h of this.active(nodeId)) {
      const p = this.anchor(h, new THREE.Vector3());
      const v = p.clone().project(this.camera);
      if (v.z < -1 || v.z > 1) continue;
      const inView = Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05;
      if (!inView) continue;
      res.push({ h, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, ndc: new THREE.Vector2(v.x, v.y), depth: p.distanceTo(this.camera.position) });
    }
    return res;
  }
}

function safeEnabled(h) { try { return h.enabled(); } catch { return false; } }

function intersect(h, ray) {
  if (h.object) {
    const hits = ray.intersectObject(h.object, true);
    if (hits.length) return hits[0].distance;
  }
  if (h.box) {
    const p = ray.ray.intersectBox(h.box, _v);
    if (p) return p.distanceTo(ray.ray.origin);
  }
  if (h.sphere) {
    const p = ray.ray.intersectSphere(h.sphere, _v);
    if (p) return p.distanceTo(ray.ray.origin);
  }
  return null;
}
