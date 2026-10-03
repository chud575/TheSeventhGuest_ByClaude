import * as THREE from 'three';
import { nameboardTexture, soundboardTexture, fretworkTexture, sheetMusicTexture } from './textures.js';

/**
 * A black concert grand, modelled from the classic outline: straight bass side,
 * S-curved bentside, round tail. Local frame: origin on the floor under the
 * centre of the keyboard front, the pianist sits at +Z looking -Z, bass at -X.
 *
 * Keys are two InstancedMeshes (52 white, 36 black) so the puzzle can press any
 * of the 88 keys for two draw calls. Returns helpers for key animation + glow.
 */

export const KEY = {
  whiteW: 0.0235, whiteL: 0.148, whiteH: 0.022, gap: 0.0012,
  blackW: 0.0128, blackL: 0.094, blackH: 0.012,
  top: 0.735,         // height of white key tops
  front: 0.17,        // z of white key fronts
  first: 21,          // MIDI of the lowest key (A0)
  count: 88,
};
const CASE = { halfW: 0.75, rimBottom: 0.6, rimTop: 0.99, len: 1.95 };
const LID_FRONT = 0.3;

/*
 * Piano wire: an anisotropic (Kajiya-Kay) highlight along each wire from the candelabrum and the
 * moon, and a screen-space width floor — a wire thinner than ~0.7 px is widened to that and its
 * alpha scaled by the true coverage, so hundreds of sub-pixel wires filter to a sheen without moire.
 */
function wireMaterial(base, U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uBase: { value: base } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uPx;
      varying vec3 vT; varying vec3 vW; varying float vCov;
      void main() {
        mat4 im = instanceMatrix;
        vec3 axis = (im * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
        float L = length(axis); vec3 T = axis / L;
        vec3 rx = (im * vec4(position.x, 0.0, position.z, 0.0)).xyz;
        float r = length((im * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 c = (im * vec4(0.0, 0.0, 0.0, 1.0)).xyz + T * position.y * L;
        vec4 wc = modelMatrix * vec4(c, 1.0);
        float w = (projectionMatrix * viewMatrix * wc).w;
        float re = max(r, w * uPx * 0.75);
        vCov = r / re;
        vec4 wp = modelMatrix * vec4(c + rx * (re / r), 1.0);
        vW = wp.xyz; vT = normalize(mat3(modelMatrix) * T);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase; uniform vec3 uL1Pos; uniform vec3 uL1Col; uniform vec3 uL2Dir; uniform vec3 uL2Col; uniform float uOpacity;
      varying vec3 vT; varying vec3 vW; varying float vCov;
      float kk(vec3 T, vec3 H, float p) { float th = dot(T, H); return pow(sqrt(max(0.0, 1.0 - th * th)), p); }
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        vec3 T = normalize(vT);
        vec3 d1 = uL1Pos - vW; float a1 = 1.6 / (0.3 + dot(d1, d1)); vec3 L1 = normalize(d1);
        vec3 H1 = normalize(L1 + V), H2 = normalize(uL2Dir + V);
        float dif1 = sqrt(max(0.0, 1.0 - pow(dot(T, L1), 2.0)));
        vec3 col = uBase * (0.03 + 0.12 * dif1 * a1 * uL1Col * 0.4 + 0.04 * uL2Col);
        col += uBase * (kk(T, H1, 320.0) * uL1Col * a1 * 0.75 + kk(T, H2, 320.0) * uL2Col * 0.35);
        gl_FragColor = vec4(col, clamp(vCov, 0.0, 1.0) * uOpacity * 0.9);
      }`,
  });
}

const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Outline polyline (x, y=back) sampled clockwise from the front-left corner. */
function outline() {
  const pts = [];
  const W = CASE.halfW;
  const cubic = (p0, p1, p2, p3, n, skipFirst = true) => {
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push(new THREE.Vector2(
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ));
    }
  };
  pts.push(new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(W, 0.3));
  cubic([W, 0.3], [W, 0.82], [0.12, 0.9], [0.0, 1.32], 26);
  cubic([0.0, 1.32], [-0.12, 1.78], [-0.5, CASE.len + 0.03], [-W + 0.09, CASE.len], 20);
  // rounded corner into the straight side
  cubic([-W + 0.09, CASE.len], [-W + 0.02, CASE.len - 0.005], [-W, CASE.len - 0.03], [-W, CASE.len - 0.1], 6);
  return pts; // closed implicitly back to (-W,0)
}

/** Offset a closed polygon inward by d (polygon is clockwise in (x, y) with y pointing back). */
function offsetPoly(pts, d) {
  const n = pts.length;
  // signed area to decide the inward side
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const sgn = area > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const e1 = new THREE.Vector2().subVectors(b, a).normalize();
    const e2 = new THREE.Vector2().subVectors(c, b).normalize();
    const n1 = new THREE.Vector2(-e1.y, e1.x).multiplyScalar(sgn);
    const n2 = new THREE.Vector2(-e2.y, e2.x).multiplyScalar(sgn);
    const nm = n1.clone().add(n2).normalize();
    const k = d / Math.max(0.3, nm.dot(n1));
    out.push(b.clone().addScaledVector(nm, k));
  }
  return out;
}

/** Clip a polygon to y >= y0 (simple Sutherland–Hodgman against one plane). */
function clipBelow(pts, y0) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ai = a.y >= y0, bi = b.y >= y0;
    if (ai) out.push(a.clone());
    if (ai !== bi) { const t = (y0 - a.y) / (b.y - a.y); out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, y0)); }
  }
  return out;
}

const shapeOf = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y); s.closePath(); return s; };
const pathOf = (pts) => { const s = new THREE.Path(); s.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y); s.closePath(); return s; };

/** Extrude a shape drawn in (x, back) so it lies horizontally: thickness grows +Y from y0. */
function flatExtrude(shape, thickness, y0, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);         // shape y -> world -z, extrude z -> world +y
  g.translate(0, y0, 0);
  return g;
}

/** Y of the bentside outline at a given x (the furthest-back point), used for string lengths. */
function backAt(pts, x) {
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { const t = (x - a.x) / (b.x - a.x); best = Math.max(best, a.y + (b.y - a.y) * t); }
  }
  return best;
}

export function buildPiano(ctx, { ebony, brass, gold }) {
  const wireU = {
    uPx: { value: 0.001 }, uOpacity: { value: 1 },
    uL1Pos: { value: new THREE.Vector3(0, 1.7, 0) }, uL1Col: { value: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(2.2) },
    uL2Dir: { value: new THREE.Vector3(0.45, 0.42, -0.79).normalize() }, uL2Col: { value: new THREE.Color(0.55, 0.66, 1.0).multiplyScalar(0.9) },
  };
  const { materials: M, geometry: G } = ctx;
  const piano = new THREE.Group();
  piano.name = 'piano';
  const add = (m, parent = piano) => { parent.add(m); return m; };
  const pts = outline();
  const inner = offsetPoly(pts, 0.035);

  // ---------------------------------------------------------------- case
  // the rim is a U open at the front: above the keybed a real grand has no front wall (the
  // keyboard, fallboard and desk fill it), so nothing black rises behind the keys
  const rimPts = [...pts.slice(1), pts[0], new THREE.Vector2(inner[0].x, 0), inner[0]];
  for (let i = inner.length - 1; i >= 1; i--) rimPts.push(inner[i]);
  rimPts.push(new THREE.Vector2(inner[1].x, 0));
  const rimShape = shapeOf(rimPts);
  const rimH = CASE.rimTop - CASE.rimBottom;
  const rim = add(new THREE.Mesh(flatExtrude(rimShape, rimH - 0.024, CASE.rimBottom + 0.012, 0.012), ebony));
  rim.name = 'piano-rim';
  // moulded bottom edge (slightly proud band)
  const band = add(new THREE.Mesh(flatExtrude(shapeOf(offsetPoly(pts, -0.008)), 0.035, CASE.rimBottom - 0.02, 0.004), ebony));
  band.name = 'piano-band';
  // keybed / bottom board inside
  add(new THREE.Mesh(flatExtrude(shapeOf(inner), 0.02, CASE.rimBottom + 0.02), ebony));
  // soundboard
  const sbTex = soundboardTexture(ctx.textures);
  const sbMat = new THREE.MeshStandardMaterial({ map: sbTex.map, normalMap: sbTex.normalMap, roughness: 0.45, metalness: 0, envMapIntensity: 0.6, color: new THREE.Color(1.25, 1.15, 0.95), emissive: new THREE.Color(0.11, 0.075, 0.04) });   // faint bounce under the plate
  const sbGeo = flatExtrude(shapeOf(clipBelow(inner, 0.2)), 0.01, 0.8);
  {
    // planar UVs in metres for the soundboard grain
    const p = sbGeo.attributes.position, uv = sbGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.6) * 0.5, -p.getZ(i) * 0.5);
  }
  add(new THREE.Mesh(sbGeo, sbMat));

  // cast-iron plate, gilt-bronze lacquer, with lightening holes
  {
    const plateOuter = clipBelow(offsetPoly(pts, 0.06), 0.06);
    const s = shapeOf(plateOuter);
    const holes = [
      [-0.42, 0.66, 0.07, 0.14], [-0.12, 0.64, 0.065, 0.12], [0.2, 0.58, 0.06, 0.1], [0.46, 0.5, 0.04, 0.07],
      [-0.42, 1.2, 0.08, 0.17], [-0.12, 1.1, 0.06, 0.13], [-0.45, 1.66, 0.06, 0.1],
    ];
    for (const [x, y, rx, ry] of holes) {   // lightening holes: the pale spruce soundboard shows through
      const h = new THREE.Path();
      h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, 0);
      s.holes.push(h);
    }
    const plate = add(new THREE.Mesh(flatExtrude(s, 0.018, 0.84, 0.006), gold));
    plate.name = 'piano-plate';
    // struts over the holes (radiating bars)
    const strutMat = gold;
    const bars = [[-0.6, 0.18, -0.55, 1.75], [-0.3, 0.18, -0.25, 1.5], [0.0, 0.18, -0.05, 1.25], [0.32, 0.18, 0.28, 0.85]];
    for (const [x0, y0, x1, y1] of bars) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const b = new THREE.Mesh(new G.RoundedBoxGeometry(0.035, 0.03, len, 2, 0.008), strutMat);
      b.position.set((x0 + x1) / 2, 0.875, -(y0 + y1) / 2);
      b.rotation.y = Math.atan2(-(x1 - x0), -(y1 - y0)) + Math.PI;
      add(b);
    }
  }

  // strings: drawn into one mip-mapped texture on a plane above the plate, so the
  // ~230 wires filter down to a soft sheen at a distance instead of shimmering into
  // moiré. Treble/tenor run straight back to the bridge; the copper-wound bass is
  // overstrung diagonally across them toward the tail, as in a real concert grand.
  {
    const X0 = -0.76, X1 = 0.76, Y0 = 0.08, Y1 = 2.0;
    const CW = 2048, CH = 2560;
    const toC = (x, y) => [((x - X0) / (X1 - X0)) * CW, ((y - Y0) / (Y1 - Y0)) * CH];
    const treble = [], bass = [];
    const NT = 168;
    for (let i = 0; i < NT; i++) {
      const t = i / (NT - 1);
      const x = -0.64 + t * 1.33;
      treble.push([x, 0.175, x + 0.01 * (1 - t), backAt(inner, x) - 0.075, i < 60 ? 2 : 3]);
    }
    for (let i = 0; i < 24; i++) {
      const xf = -0.47 + i * 0.0115, xb = -0.685 + i * 0.0098;
      bass.push([xf, 0.215, xb, backAt(inner, xb) - 0.07, i < 8 ? 1 : 2]);
    }
    // real wires: instanced thin steel cylinders (bright, anisotropic-looking in the probe) in three
    // groups — treble and tenor straight back to the long bridge, the copper-wound bass overstrung
    // across them toward the tail
    const wires = [];   // [x0, z0, x1, z1, radius, copper]
    for (const [x0, y0, x1, y1, n] of treble) {
      for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * 0.0017; wires.push([x0 + o, y0, x1 + o, y1, 0.00055 + 0.00025 * (n === 2 ? 1 : 0), 0]); }
    }
    for (const [x0, y0, x1, y1, n] of bass) {
      for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * 0.0042; wires.push([x0 + o, y0, x1 + o, y1, 0.0016 - 0.0005 * (n - 1), 1]); }
    }
    const wireGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    const steelW = wireMaterial(new THREE.Color(0.5, 0.5, 0.49), wireU);
    const copperW = wireMaterial(new THREE.Color(0.55, 0.28, 0.12), wireU);
    const nSteel = wires.filter((w) => !w[5]).length;
    const imS = new THREE.InstancedMesh(wireGeo, steelW, nSteel);
    const imC = new THREE.InstancedMesh(wireGeo, copperW, wires.length - nSteel);
    for (const im of [imS, imC]) {
      im.renderOrder = 2; im.userData.noBake = false; im.frustumCulled = false;
      im.onBeforeRender = (renderer, scene, camera) => {
        const rt = renderer.getRenderTarget();
        const h = rt ? rt.height : renderer.domElement.height;
        wireU.uPx.value = 2 / (camera.projectionMatrix.elements[5] * Math.max(1, h));
      };
    }
    let iS = 0, iC = 0;
    const wm = new THREE.Matrix4(), wq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (const [x0, y0, x1, y1, r, cu] of wires) {
      const yy = cu ? 0.912 : 0.904;            // the bass crosses over the top of the tenor
      const a = new THREE.Vector3(x0, yy, -y0), b2 = new THREE.Vector3(x1, yy - 0.006, -y1);
      const len = a.distanceTo(b2);
      wq.setFromUnitVectors(up, b2.clone().sub(a).normalize());
      wm.compose(a.clone().lerp(b2, 0.5), wq, new THREE.Vector3(r, len, r));
      if (cu) imC.setMatrixAt(iC++, wm); else imS.setMatrixAt(iS++, wm);
    }
    for (const im of [imS, imC]) { im.castShadow = false; im.userData.noShadow = true; add(im); }
    // hitch pins at the tail ends, agraffes at the front
    const hitch = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 1, roughness: 0.25, envMapIntensity: 1.6 }), wires.length);
    wires.forEach(([, , x1, y1, , cu], i) => { wm.compose(new THREE.Vector3(x1, 0.9, -y1 - 0.03), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); hitch.setMatrixAt(i, wm); void cu; });
    hitch.castShadow = false; add(hitch);
    // bridges: a long curved maple bridge for the treble/tenor, a short one for the bass
    const maple = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.55 });
    const bridgePts = treble.filter((_, i) => i % 6 === 0).map(([, , x1, y1]) => new THREE.Vector3(x1, 0.889, -y1 - 0.004));
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridgePts), 80, 0.009, 6), maple));
    const bb = bass.map(([, , x1, y1]) => new THREE.Vector3(x1, 0.902, -y1 - 0.004));
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bb[0], bb[Math.floor(bb.length / 2)], bb[bb.length - 1]]), 20, 0.011, 6), maple));
    // tuning pins: two staggered rows of steel pins across the pin block
    const steel = new THREE.MeshStandardMaterial({ color: 0xd0ccc2, roughness: 0.22, metalness: 1.0 });
    const m = new THREE.Matrix4();
    const NP = 460;
    const pin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.03, 8), steel, NP);
    steel.envMapIntensity = 2.0;
    for (let i = 0; i < NP; i++) {
      const x = -0.66 + (i / (NP - 1)) * 1.36;
      const row = i % 3;
      m.compose(new THREE.Vector3(x, 0.892, -(0.105 + row * 0.022)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      pin.setMatrixAt(i, m);
    }
    pin.castShadow = false;
    add(pin);
    // red understring felt along the pin block and the hitch-pin rim
    const felt = new THREE.MeshStandardMaterial({ color: 0x5c1216, roughness: 0.98 });
    const feltFront = add(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.006, 0.02), felt));
    feltFront.position.set(0.02, 0.896, -0.165);
    // dampers: ebonised heads on red felt, over the treble half, behind the strike line
    const damperMat = new THREE.MeshStandardMaterial({ color: 0x16100c, roughness: 0.55 });
    const NDm = 64;
    const dampers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0145, 0.026, 0.04), damperMat, NDm);
    const dfelt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0145, 0.006, 0.04), felt, NDm);
    for (let i = 0; i < NDm; i++) {
      const x = -0.42 + (i / (NDm - 1)) * 1.08;
      m.compose(new THREE.Vector3(x, 0.922, -0.34), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); dampers.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 0.907, -0.34), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); dfelt.setMatrixAt(i, m);
    }
    add(dampers); add(dfelt);
    // damper rail (ebonised, red felt lining)
    const rail = add(new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.016, 0.022), ebony));
    rail.position.set(0.12, 0.944, -0.34);
  }

  // ---------------------------------------------------------------- lid (raised on the long stick)
  const lidPivot = new THREE.Group();
  lidPivot.name = 'piano-lid';
  lidPivot.position.set(-CASE.halfW, CASE.rimTop, 0);
  {
    const lidPts = clipBelow(offsetPoly(pts, -0.006), LID_FRONT);
    const g = flatExtrude(shapeOf(lidPts), 0.012, 0.0065, 0.0065);   // ~25 mm with a rounded edge
    g.translate(CASE.halfW, 0, 0);
    // the lid gets its own lacquer so it can mirror the gilt plate and strings from a probe under it
    const lidMat = ebony.clone();
    const lid = new THREE.Mesh(g, lidMat);
    lidPivot.userData.lidMat = lidMat;
    lidPivot.add(lid);
    // folded front flap lying on top of the lid
    const flapPts = [new THREE.Vector2(-CASE.halfW, 0.0), new THREE.Vector2(CASE.halfW, 0.0), new THREE.Vector2(CASE.halfW, LID_FRONT - 0.005), new THREE.Vector2(-CASE.halfW, LID_FRONT - 0.005)];
    const fg = flatExtrude(shapeOf(flapPts), 0.018, 0.026, 0.003);
    fg.translate(CASE.halfW, 0, -LID_FRONT - 0.01);
    lidPivot.add(new THREE.Mesh(fg, lidMat));
    // continuous brass piano hinge along the straight side, with knuckle rings
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, CASE.len - LID_FRONT - 0.08, 14), brass);
    hinge.rotation.x = Math.PI / 2; hinge.position.set(-0.004, 0.004, -(LID_FRONT + CASE.len) / 2);
    lidPivot.add(hinge);
    const knG = new THREE.TorusGeometry(0.0068, 0.0012, 6, 14);
    for (let i = 0; i < 26; i++) { const k = new THREE.Mesh(knG, brass); k.position.set(-0.004, 0.004, -LID_FRONT - 0.06 - i * 0.06); lidPivot.add(k); }
  }
  const LID_ANGLE = 0.62;
  lidPivot.rotation.z = -LID_ANGLE;
  // note: rotation about +z, negative = the +x edge rises (pivot on the left, lifting the treble side)
  lidPivot.rotation.z = LID_ANGLE;
  add(lidPivot);
  // prop stick from the rim (treble side) up to the lid underside
  {
    const base = new THREE.Vector3(0.48, CASE.rimTop + 0.01, -0.95);
    // lid underside point above base: lid plane passes through pivot with angle
    const dx = base.x + CASE.halfW;
    const lidY = CASE.rimTop + Math.tan(LID_ANGLE) * dx;
    const top = new THREE.Vector3(base.x - 0.03, lidY - 0.02, base.z);
    const len = top.distanceTo(base);
    const stick = new THREE.Mesh(G.latheFromProfile([[0.009, 0], [0.012, 0.02], [0.01, len * 0.5], [0.012, len - 0.02], [0.008, len]], 12), ebony);
    stick.position.copy(base);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize());
    add(stick);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.012, 16), brass);
    cup.position.copy(base); add(cup);
  }

  // ---------------------------------------------------------------- keyboard
  const keys = buildKeys(ctx, piano);
  // key slip (the rail in front of the keys) + cheek blocks
  const slip = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.32, 0.05, 0.025, 2, 0.006), ebony));
  slip.position.set(0, KEY.top - 0.03, KEY.front + 0.014);
  const keybed = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.5, 0.075, 0.22, 2, 0.01), ebony));
  keybed.position.set(0, KEY.top - 0.07, 0.07);
  for (const s of [-1, 1]) {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0); cheekShape.lineTo(0.2, 0); cheekShape.lineTo(0.2, 0.06);
    cheekShape.bezierCurveTo(0.2, 0.1, 0.12, 0.1, 0.08, 0.13); cheekShape.lineTo(0, 0.17); cheekShape.lineTo(0, 0);
    const cg = new THREE.ExtrudeGeometry(cheekShape, { depth: 0.075, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    cg.rotateY(-Math.PI / 2);
    const cheek = new THREE.Mesh(G.applyBoxUVs(cg, 2), ebony);
    cheek.position.set(s < 0 ? -0.66 : 0.735, KEY.top - 0.06, 0.2);
    add(cheek);
  }
  // fallboard folded open: only its bevelled front edge shows, a thin band of mirror lacquer
  // behind the keys carrying the gilt maker's decal; felt strip along the key backs
  {
    // one moulded board, swept along the keyboard: a vertical lacquered face carrying the decal, a
    // rounded top edge and a small bead at its foot. A satin rather than mirror coat, so the candle
    // highlights spread into soft bands instead of streaking along every edge
    const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x060505, roughness: 0.42, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.26, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const prof = [[-0.045, 0.06], [-0.006, 0.06], [0.002, 0.058], [0.0065, 0.053], [0.008, 0.046], [0.008, 0.011], [0.0105, 0.008], [0.0105, 0.003], [0.007, 0.0], [-0.045, 0.0], [-0.045, 0.06]].map(([x, y]) => new THREE.Vector2(x, y));
    const fb = add(new THREE.Mesh(G.sweepProfile(prof, [new THREE.Vector3(-0.655, 0, 0), new THREE.Vector3(0.655, 0, 0)], { uvScale: 2 }), lacquer));
    fb.position.set(0, KEY.top + 0.016, 0.0);   // the key backs pass under it, clear of the black keys
    for (const sx of [-1, 1]) {   // end caps
      const cap = add(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(prof.map((p) => new THREE.Vector2(p.x, p.y)))), lacquer));
      cap.rotation.y = sx * Math.PI / 2; cap.position.set(sx * 0.655, KEY.top + 0.016, 0);
      cap.material = lacquer; cap.geometry.computeVertexNormals();
      if (sx < 0) cap.scale.x = -1;
    }
    const nt = nameboardTexture(ctx.textures);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.0446), new THREE.MeshStandardMaterial({ map: nt, transparent: true, metalness: 0.85, roughness: 0.3, color: 0xffffff, depthWrite: false, emissiveMap: nt, emissive: new THREE.Color(0.22, 0.16, 0.06), polygonOffset: true, polygonOffsetFactor: -2 }));
    name.position.set(0, KEY.top + 0.044, 0.0087);
    add(name);
    // red baize strip along the back of the keys (key-back felt), so the key ends don't float
    // red key-slip felt filling the slot under the fallboard, along the key backs
    const baize = add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.0165, 0.012), new THREE.MeshStandardMaterial({ color: 0x4a0e12, roughness: 1 })));
    baize.position.set(0, KEY.top + 0.0078, 0.004);
    // dark felt under the keys: the gaps between them read as shadow, not as lacquer reflections
    const under = add(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.2), new THREE.MeshBasicMaterial({ color: 0x020202 })));
    under.rotation.x = -Math.PI / 2; under.position.set(0, KEY.top - 0.021, KEY.front - 0.1);
  }
  // music desk with fretwork + a score
  const desk = new THREE.Group();
  desk.name = 'piano-desk';
  {
    const fret = fretworkTexture(ctx.textures);
    const fm = new THREE.MeshStandardMaterial({ map: fret.map, normalMap: fret.normalMap, alphaTest: 0.5, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, color: 0x7a7a7a });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.3), fm);
    panel.position.y = 0.17; desk.add(panel);
    const frameG = new THREE.Mesh(G.frameGeometry(0.78, 0.3, { width: 0.018, depth: 0.012, uvScale: 2 }), ebony);
    frameG.position.y = 0.17; desk.add(frameG);
    const ledge = new THREE.Mesh(new G.RoundedBoxGeometry(0.84, 0.014, 0.045, 2, 0.005), ebony);
    ledge.position.set(0, 0.01, 0.02); desk.add(ledge);
    const sheetMat = (seed, title) => new THREE.MeshStandardMaterial({ map: sheetMusicTexture(ctx.textures, { seed, title }), roughness: 0.85, side: THREE.DoubleSide });
    for (const [x, seed, ry, title] of [[-0.135, 3, 0.05, 'Nocturne for the Seventh Guest'], [0.135, 4, -0.05, '']]) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.33, 6, 1), sheetMat(seed, title));
      const p = page.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / 0.125; p.setZ(i, 0.012 * (1 - u * u) + (x < 0 ? -1 : 1) * u * 0.004); }
      page.geometry.computeVertexNormals();
      page.position.set(x, 0.19, 0.012); page.rotation.y = ry;
      desk.add(page);
    }
  }
  // a brass swing-arm candle sconce screwed to the case at the bass end of the desk: the warm key
  // light that falls off across the keyboard from left to right
  {
    const arm = new THREE.Group();
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.026, 0], [0.03, 0.006], [0.02, 0.012], [0.014, 0.03], [0.02, 0.034], [0.0, 0.035]], 18), brass);
    arm.add(cup);
    const pan = new THREE.Mesh(G.latheFromProfile([[0, -0.004], [0.042, -0.002], [0.045, 0.004], [0.0, 0.004]], 20), brass);
    arm.add(pan);
    const rod = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.004, 0), new THREE.Vector3(-0.03, -0.03, 0.02), new THREE.Vector3(-0.07, -0.05, 0.03), new THREE.Vector3(-0.09, -0.06, 0.03)]), 16, 0.005, 8), brass);
    arm.add(rod);
    const c = ctx.fx.candle({ height: 0.13, radius: 0.0105, light: true, lightIntensity: 0.45, lightDistance: 2.2, seed: 77, burn: 0.8 });
    c.position.y = 0.033; arm.add(c);
    arm.position.set(-0.6, KEY.top + 0.12, -0.03);
    add(arm);
  }
  desk.position.set(0, KEY.top + 0.07, -0.085);
  desk.rotation.x = -0.24;
  add(desk);

  // ---------------------------------------------------------------- legs, lyre, pedals
  const legProfile = [[0.0, 0], [0.034, 0], [0.04, 0.02], [0.036, 0.045], [0.05, 0.08], [0.062, 0.14], [0.058, 0.2], [0.045, 0.25], [0.04, 0.3], [0.05, 0.36], [0.058, 0.42], [0.055, 0.48], [0.075, 0.52], [0.075, 0.56], [0.0, 0.57]];
  const legGeo = G.latheFromProfile(legProfile, 28);
  const legPos = [[-0.6, 0.12], [0.62, 0.12], [-0.42, 1.72]];
  for (const [x, y] of legPos) {
    const leg = new THREE.Mesh(legGeo, ebony);
    leg.position.set(x, 0.035, -y);
    add(leg);
    const castor = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), brass);
    castor.rotation.z = Math.PI / 2; castor.position.set(x, 0.022, -y);
    add(castor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 28), brass);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.56, -y);
    add(ring);
  }
  // lyre
  {
    const lyre = new THREE.Group();
    const armProfile = [new THREE.Vector2(-0.015, -0.012), new THREE.Vector2(0.015, -0.012), new THREE.Vector2(0.015, 0.012), new THREE.Vector2(-0.015, 0.012), new THREE.Vector2(-0.015, -0.012)];
    for (const s of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; path.push(new THREE.Vector3(s * (0.05 + 0.06 * Math.sin(t * Math.PI) - 0.02 * t), 0.1 + t * 0.48, 0)); }
      const arm = new THREE.Mesh(G.sweepProfile(armProfile, path, { up: new THREE.Vector3(0, 0, 1) }), ebony);
      lyre.add(arm);
    }
    const box = new THREE.Mesh(new G.RoundedBoxGeometry(0.26, 0.07, 0.11, 2, 0.012), ebony);
    box.position.y = 0.07; lyre.add(box);
    for (const x of [-0.065, 0, 0.065]) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.1), brass);
      ped.position.set(x, 0.055, 0.09); ped.rotation.x = 0.12; lyre.add(ped);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), brass);
      tip.position.set(x, 0.05, 0.14); lyre.add(tip);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), brass);
    rod.position.set(0, 0.35, -0.03); lyre.add(rod);
    lyre.position.set(0, 0, -0.42);
    add(lyre);
  }

  piano.userData = { keys, lidPivot, desk, wireU };
  return piano;
}

/** 88 keys as two InstancedMeshes. Returns { white, black, keyOf(instanceHit), setPress(midi, amount), xOf(midi), glow } */
function buildKeys(ctx, piano) {
  const { geometry: G } = ctx;
  const whiteMidi = [], blackMidi = [];
  for (let k = 0; k < KEY.count; k++) { const m = KEY.first + k; (isBlack(m) ? blackMidi : whiteMidi).push(m); }
  const x0 = -(whiteMidi.length * KEY.whiteW) / 2;
  const xOf = new Map();
  whiteMidi.forEach((m, i) => xOf.set(m, x0 + (i + 0.5) * KEY.whiteW));
  // black keys sit between white neighbours, nudged like a real keyboard
  const nudge = { 1: -0.15, 3: 0.15, 6: -0.2, 8: 0, 10: 0.2 };
  for (const m of blackMidi) {
    const l = xOf.get(m - 1), r = xOf.get(m + 1);
    xOf.set(m, (l + r) / 2 + nudge[m % 12] * KEY.blackW * 0.6);
  }
  // white key geometry: bevelled top front edge; pivot at the back (z = 0 at the back end)
  const wg = new G.RoundedBoxGeometry(KEY.whiteW - KEY.gap, KEY.whiteH, KEY.whiteL + 0.25, 3, 0.0018);
  wg.translate(0, -KEY.whiteH / 2, -(KEY.whiteL + 0.25) / 2);
  const bgeo = new G.RoundedBoxGeometry(KEY.blackW, KEY.blackH + 0.012, KEY.blackL + 0.2, 3, 0.0028);
  bgeo.translate(0, (KEY.blackH + 0.012) / 2 - 0.012, -(KEY.blackL + 0.2) / 2);
  // taper the black key top (narrower at the top like real sharps)
  {
    const p = bgeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.004) p.setX(i, p.getX(i) * 0.8); }
    bgeo.computeVertexNormals();
  }
  // old ivory: warm cream with fine lengthwise grain (normal + albedo), a satin polish
  const ivTex = ctx.textures.generate('music:ivory', {
    size: 256, normalStrength: 0.08,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(vec2(uv.x * 2.0, uv.y * 24.0), vec2(2.0, 24.0), 4);
  float lines = sin((uv.y * 60.0 + n * 2.0) * 6.2831) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.93, 0.89, 0.8), vec3(0.88, 0.82, 0.7), 0.35 * lines + 0.4 * (fbm(uv * 3.0, vec2(3.0), 3) * 0.5 + 0.5));
  s.albedo = c; s.height = 0.5 + 0.05 * lines; s.rough = 0.33 + 0.06 * lines; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  const ivory = new THREE.MeshPhysicalMaterial({ map: ivTex.map, normalMap: ivTex.normalMap, roughnessMap: ivTex.roughnessMap, color: 0xf6eedc, roughness: 1.0, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.25, sheen: 0.1, sheenColor: new THREE.Color(0.95, 0.95, 1.0), emissive: new THREE.Color(0x000000) });
  const jet = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const white = new THREE.InstancedMesh(wg, ivory, whiteMidi.length);
  const black = new THREE.InstancedMesh(bgeo, jet, blackMidi.length);
  white.name = 'keys-white'; black.name = 'keys-black';
  // old ivory: each key yellowed a little differently
  {
    let sd = 17; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    const c = new THREE.Color();
    for (let i = 0; i < whiteMidi.length; i++) { const y = rnd(); c.setRGB(1.0, 0.99 - y * 0.025, 0.97 - y * 0.06); white.setColorAt(i, c); }
    white.instanceColor.needsUpdate = true;
  }
  white.userData.dynamic = true; black.userData.dynamic = true;
  const backZ = KEY.front - KEY.whiteL - 0.25;  // pivot line z for white keys
  const press = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), axis = new THREE.Vector3(1, 0, 0);
  const place = (midi) => {
    const blackKey = isBlack(midi);
    const list = blackKey ? blackMidi : whiteMidi;
    const idx = list.indexOf(midi);
    const a = (press.get(midi) || 0) * 0.045;
    q.setFromAxisAngle(axis, a);
    const z = blackKey ? KEY.front - 0.05 : KEY.front;
    const len = blackKey ? KEY.blackL + 0.2 : KEY.whiteL + 0.25;
    // geometry origin is at the key FRONT top; rotate around the back end
    const pivot = new THREE.Vector3(xOf.get(midi), KEY.top, z - len);
    const off = new THREE.Vector3(0, 0, len).applyQuaternion(q);
    m4.compose(pivot.clone().add(off), q, one);
    (blackKey ? black : white).setMatrixAt(idx, m4);
  };
  // the translate above put the origin at the back... fix: geometry spans z in [-(len), 0] from origin => origin = front.
  for (const m of whiteMidi) place(m);
  for (const m of blackMidi) place(m);
  white.instanceMatrix.needsUpdate = true; black.instanceMatrix.needsUpdate = true;
  piano.add(white, black);

  // glow overlays (pooled): additive quads hovering over a key top
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glows = [];
  for (let i = 0; i < 4; i++) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(new THREE.Color(0.5, 0.75, 1.6)));
    gm.rotation.x = -Math.PI / 2; gm.visible = false; gm.renderOrder = 5; gm.userData.noBake = true; gm.userData.noShadow = true;
    piano.add(gm);
    glows.push({ mesh: gm, life: 0, midi: -1 });
  }

  const api = {
    white, black, whiteMidi, blackMidi, xOf: (m) => xOf.get(m), isBlack,
    keyOf(hit) {
      if (!hit || hit.instanceId === undefined) return null;
      if (hit.object === white) return whiteMidi[hit.instanceId];
      if (hit.object === black) return blackMidi[hit.instanceId];
      return null;
    },
    setPress(midi, amount) { press.set(midi, amount); place(midi); (isBlack(midi) ? black : white).instanceMatrix.needsUpdate = true; },
    /** flash a key: ghost=true blue-white, otherwise warm */
    flash(midi, { ghost = true, dur = 0.6 } = {}) {
      const g = glows.find((x) => x.life <= 0) || glows[0];
      const bk = isBlack(midi);
      g.mesh.material.color.set(ghost ? new THREE.Color(0.45, 0.7, 1.7) : new THREE.Color(1.6, 0.9, 0.4));
      g.mesh.scale.set(bk ? KEY.blackW * 1.25 : KEY.whiteW * 0.95, bk ? KEY.blackL : KEY.whiteL * 0.98, 1);
      g.mesh.position.set(xOf.get(midi), KEY.top + (bk ? KEY.blackH + 0.002 : 0.0015), (bk ? KEY.front - 0.05 : KEY.front) - (bk ? KEY.blackL : KEY.whiteL) / 2);
      g.life = dur; g.dur = dur; g.midi = midi; g.mesh.visible = true;
    },
    update(dt) {
      for (const g of glows) {
        if (g.life <= 0) continue;
        g.life -= dt;
        const k = Math.max(0, g.life / g.dur);
        g.mesh.material.opacity = 0.9 * Math.pow(k, 0.7);
        if (g.life <= 0) g.mesh.visible = false;
      }
      for (const [m, a] of press) {
        if (a <= 0) continue;
        const na = Math.max(0, a - dt * 4.5);
        api.setPress(m, na);
      }
    },
    press(midi) { api.setPress(midi, 1); },
  };
  return api;
}
