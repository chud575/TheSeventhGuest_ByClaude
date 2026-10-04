import * as THREE from 'three';

/**
 * Planar reflection for the polished marble floor.
 *
 * The floor mesh renders the scene from a camera mirrored in its plane (oblique near-plane clip, half
 * resolution, mip-mapped) just before it draws itself. The floor's own material then samples that
 * texture in screen-projected coordinates, perturbed by the tile normal map and blurred by roughness
 * (mip LOD), weighted by Fresnel -- so the chandelier, the candle flames and the columns streak in the
 * marble while the dusty, scuffed areas only give a dull smear.
 *
 * Usage: const refl = planarReflection(ctx, floorMesh, { scale: 0.5, hide: (o) => bool });
 *        refl.inject(shader)  -- call inside the onBeforeCompile of any material lying in that plane
 */
export function planarReflection(ctx, mesh, { scale = 0.5, strength = 1.0, hide = null, maxLod = 6 } = {}) {
  const r = ctx.renderer;
  const rt = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType, depthBuffer: true, samples: 0,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });
  rt.texture.name = 'foyer.floorReflection';
  const uniforms = {
    tReflect: { value: rt.texture },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflStrength: { value: strength },
    uReflMaxLod: { value: maxLod },
  };
  const reflCam = new THREE.PerspectiveCamera();
  const plane = new THREE.Plane(), normal = new THREE.Vector3(), wpos = new THREE.Vector3(), cpos = new THREE.Vector3();
  const rot = new THREE.Matrix4(), look = new THREE.Vector3(), view = new THREE.Vector3(), target = new THREE.Vector3();
  const clip = new THREE.Vector4(), q = new THREE.Vector4(), size = new THREE.Vector2();
  let hidden = null, busy = false;
  const disabled = ctx.params?.get?.('norefl');

  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (busy || disabled || camera !== ctx.camera) return;
    renderer.getDrawingBufferSize(size);
    const w = Math.max(4, Math.round(size.x * scale)), h = Math.max(4, Math.round(size.y * scale));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    if (!hidden) { hidden = []; scene.traverse((o) => { if (o !== mesh && hide?.(o)) hidden.push(o); }); }

    wpos.setFromMatrixPosition(mesh.matrixWorld);
    cpos.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rot);
    view.subVectors(wpos, cpos);
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(wpos);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(cpos);
    target.subVectors(wpos, look).reflect(normal).negate().add(wpos);
    reflCam.position.copy(view);
    reflCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    reflCam.lookAt(target);
    reflCam.near = camera.near; reflCam.far = camera.far;
    reflCam.updateMatrixWorld();
    reflCam.projectionMatrix.copy(camera.projectionMatrix);
    const tm = uniforms.uReflMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);   // world -> mirror texture
    // oblique near plane = the floor plane (Lengyel)
    plane.setFromNormalAndCoplanarPoint(normal, wpos).applyMatrix4(reflCam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = reflCam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + pm[8]) / pm[0], (Math.sign(clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;

    busy = true;
    mesh.visible = false;
    const vis = hidden.map((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    const prevXR = renderer.xr.enabled;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear(true, true, true);
    renderer.render(scene, reflCam);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.xr.enabled = prevXR;
    if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport);
    hidden.forEach((o, i) => { o.visible = vis[i]; });
    mesh.visible = true;
    busy = false;
  };

  /** patch a MeshPhysicalMaterial shader (inside onBeforeCompile). `dullExpr` = GLSL float 0..1 that kills the mirror (dust). */
  const inject = (sh, dullExpr = '0.0') => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflCoord;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvReflCoord = uReflMatrix * (modelMatrix * vec4(transformed, 1.0));');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tReflect;\nuniform float uReflStrength;\nuniform float uReflMaxLod;\nvarying vec4 vReflCoord;')
      .replace('#include <opaque_fragment>', `{
  // planar mirror: screen-projected, nudged by the slab normal map, blurred by roughness, Fresnel-weighted
  vec3 vN = normalize(normal);
  vec2 ruv = vReflCoord.xy / vReflCoord.w + vN.xy * 0.035;
  float rgh = clamp(material.roughness, 0.0, 1.0);
  float lod = clamp(rgh * 16.0, 0.0, uReflMaxLod);
  vec3 refl = textureLod(tReflect, ruv, lod).rgb;
  float NdV = clamp(dot(vN, normalize(vViewPosition)), 0.0, 1.0);
  float F = 0.05 + 0.95 * pow(1.0 - NdV, 5.0);
  float gloss = 1.0 - smoothstep(0.06, 0.45, rgh);
  float dull = clamp(${dullExpr}, 0.0, 1.0);
  outgoingLight += refl * F * gloss * (1.0 - dull * 0.85) * uReflStrength;
}
#include <opaque_fragment>`);
  };
  return { rt, uniforms, inject, camera: reflCam };
}
