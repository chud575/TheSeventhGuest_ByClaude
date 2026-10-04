import * as THREE from 'three';

/**
 * Participating media for the whole hall, lit only by the moon spot.
 *
 * A room-sized box drawn from the inside (BackSide, depth-tested like the engine's LightShaft, so
 * anything in front of the far wall correctly cuts the march). Each pixel marches the view ray through
 * the box; every sample is projected into the moon's cookie camera so the in-scattered light carries
 * the stained-glass colours of the window (the same texture that paints the pools on the floor), with a
 * forward-scattering phase, drifting density noise, an analytic shadow for the gallery slab, and a cool
 * haze whose extinction grows with height so the ceiling falls darker than the gallery.
 *
 * Output is premultiplied (rgb = in-scatter, a = 1 - transmittance) blended ONE / ONE_MINUS_SRC_ALPHA.
 */
const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform vec3 uBoxMin, uBoxMax;
uniform vec3 uMoonPos, uMoonAxis, uColor, uHaze;
uniform mat4 uMoonVP;
uniform sampler2D uCookie;
uniform float uCookieOn, uCosOuter, uCosInner, uMoonI, uDensity, uHeightK, uTopExt, uTopY, uTime, uSteps, uG;
uniform vec4 uOcc;      // gallery slab: x < uOcc.x, z < uOcc.y, at height uOcc.z
uniform float uFloorY;
uniform float uDebug;
varying vec3 vWorld;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv;
  vec3 tmn = min(t0, t1), tmx = max(t0, t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
  float tf = min(min(tmx.x, tmx.y), tmx.z);
  if (tf <= tn) discard;
  float steps = uSteps;
  float dt = (tf - tn) / steps;
  float jit = hash12(gl_FragCoord.xy + fract(uTime * 0.37) * 61.0);
  vec3 acc = vec3(0.0);
  vec3 dbg = vec3(0.0);
  float trans = 1.0;
  float g2 = uG * uG;
  for (int i = 0; i < 48; i++) {
    if (float(i) >= steps) break;
    vec3 p = ro + rd * (tn + (float(i) + jit) * dt);
    // density: a low, drifting haze, thickest near the floor, broken into slow wisps
    vec3 q = p * 0.55 + vec3(uTime * 0.02, -uTime * 0.01, uTime * 0.015);
    float n = vn(q) * 0.65 + vn(q * 2.3 + 7.1) * 0.35;
    float dens = uDensity * (0.35 + exp(-max(p.y - uFloorY, 0.0) * uHeightK)) * (0.45 + 1.1 * n);
    // moon in-scatter through the stained glass
    vec3 L = uMoonPos - p;
    float dist = length(L);
    vec3 l = L / dist;
    float cosA = dot(-l, uMoonAxis);
    float cone = smoothstep(uCosOuter, uCosInner, cosA);
    vec3 Li = vec3(0.0);
    if (cone > 0.0) {
      vec4 c = uMoonVP * vec4(p, 1.0);
      vec2 cuv = c.xy / c.w * 0.5 + 0.5;
      vec3 cook = uCookieOn > 0.5 ? textureLod(uCookie, clamp(cuv, 0.0, 1.0), 2.0).rgb   // explicit LOD: jittered march -> huge derivatives : vec3(1.0);
      // the gallery slab shades everything beneath it
      float occ = 1.0;
      if (p.y < uOcc.z) {
        float s = (uOcc.z - p.y) / max(l.y, 1e-3);
        vec2 hit = p.xz + l.xz * s;
        if (hit.x < uOcc.x && hit.y < uOcc.y) occ = 0.0;
      }
      float mu = dot(rd, l);   // forward scattering peaks looking towards the moon
      float phase = (1.0 - g2) / pow(1.0 + g2 - 2.0 * uG * mu, 1.5) * 0.0796;
      Li = uColor * cook * cone * occ * phase * uMoonI;
      dbg += vec3(cone * 0.1, length(cook) * 5.0, 0.0) * dt;
    }
    float ext = dens + uTopExt * smoothstep(uTopY, uBoxMax.y, p.y);
    acc += trans * (dens * Li + ext * uHaze) * dt;
    trans *= exp(-ext * dt);
  }
  gl_FragColor = vec4(acc, 1.0 - trans);
  if (uDebug > 0.5) gl_FragColor = vec4(dbg * 0.1, 0.5);
}`;

export function moonVolume(ctx, { moon, box, occ, color = 0xb4c4ff, intensity = 6, density = 0.03, heightK = 0.9, topExt = 0.06, topY = 5.2, haze = [0.004, 0.006, 0.012], steps = 28, g = 0.35 }) {
  const size = new THREE.Vector3(), c = new THREE.Vector3();
  box.getSize(size); box.getCenter(c);
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  geo.translate(c.x, c.y, c.z);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 80);
  const uniforms = {
    uBoxMin: { value: box.min.clone() }, uBoxMax: { value: box.max.clone() },
    uMoonPos: { value: new THREE.Vector3() }, uMoonAxis: { value: new THREE.Vector3() },
    uColor: { value: new THREE.Color(color) }, uHaze: { value: new THREE.Vector3(...haze) },
    uMoonVP: { value: new THREE.Matrix4() },
    uCookie: { value: null }, uCookieOn: { value: 0 },
    uCosOuter: { value: 0.9 }, uCosInner: { value: 0.95 },
    uMoonI: { value: intensity }, uDensity: { value: density }, uHeightK: { value: heightK },
    uTopExt: { value: topExt }, uTopY: { value: topY },
    uTime: ctx.time || { value: 0 }, uSteps: { value: steps }, uG: { value: g },
    uOcc: { value: new THREE.Vector4(...(occ || [-1e3, -1e3, -1e3, 0])) },
    uFloorY: { value: box.min.y },
    uDebug: { value: Number(ctx.params?.get?.('mdbg') || 0) },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, side: THREE.BackSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'MoonVolume';
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  mesh.userData.noBake = true;
  mesh.userData.noShadow = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  const sync = () => {
    moon.updateMatrixWorld(); moon.target.updateMatrixWorld();
    const mp = new THREE.Vector3().setFromMatrixPosition(moon.matrixWorld);
    const tp = new THREE.Vector3().setFromMatrixPosition(moon.target.matrixWorld);
    uniforms.uMoonPos.value.copy(mp);
    uniforms.uMoonAxis.value.subVectors(tp, mp).normalize();
    uniforms.uCosOuter.value = Math.cos(moon.angle);
    uniforms.uCosInner.value = Math.cos(moon.angle * (1 - (moon.penumbra ?? 0.2)));
    cam.fov = THREE.MathUtils.radToDeg(moon.angle) * 2;
    cam.position.copy(mp); cam.lookAt(tp); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    uniforms.uMoonVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    if (moon.map) { uniforms.uCookie.value = moon.map; uniforms.uCookieOn.value = 1; }
  };
  mesh.onBeforeRender = () => { if (!uniforms.uCookie.value) sync(); };
  return { mesh, uniforms, sync };
}
