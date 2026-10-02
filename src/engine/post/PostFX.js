import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { FULLSCREEN_VERT, GODRAYS_FRAG, GRADE_FRAG, FINISH_FRAG, COPY_FRAG } from './shaders.js';

/**
 * Default look: deep Victorian blues in the shadows, warm candle highlights,
 * filmic roll-off, subtle grain + vignette. Rooms override via ctx.post.set().
 */
export const DEFAULT_GRADE = {
  exposure: 1.0,
  toneMapping: 'aces',            // 'aces' | 'agx' | 'agx-punchy' | 'none'
  contrast: 1.06,
  saturation: 0.95,
  shadowTint: [0.82, 0.96, 1.18],
  highlightTint: [1.12, 1.0, 0.84],
  splitBalance: 0.42,
  splitAmount: 0.55,
  lift: [0.004, 0.006, 0.012],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  blackPoint: 0.0,
  highlightRolloff: 1.0,
  vignette: 0.38,
  vignetteSoftness: 0.62,
  grain: 0.035,
  grainSize: 1.6,
  chromaticAberration: 0.0007,
  bloomStrength: 0.42,
  bloomRadius: 0.55,
  bloomThreshold: 0.92,
  aoIntensity: 1.0,
  aoRadius: 0.35,
  aoDistanceFallOff: 1.0,
  aoThickness: 1.0,
  godRayDensity: 0.92,
  godRayDecay: 0.965,
  godRayWeight: 0.55,
  godRayThreshold: 1.1,
  fogColor: [0.012, 0.016, 0.03],
  fogDensity: 0.0,
  dof: null,                      // { focus: metres, aperture: 0..2, maxBlur: px }
};

const TM = { aces: 0, agx: 1, 'agx-punchy': 2, none: 3 };

function makeMat(frag, uniforms, defines = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} preset quality preset
   */
  constructor(renderer, preset) {
    this.renderer = renderer;
    this.preset = preset;
    this.grade = structuredClone(DEFAULT_GRADE);
    this._target = structuredClone(DEFAULT_GRADE); // for smooth blends
    this._blend = 0;
    this.godRaySources = [];   // [{ position: Vector3, color: Color, strength }]
    this.resolutionScale = 1;
    this.fade = 0;
    this.fadeColor = new THREE.Color(0, 0, 0);
    this.dissolve = 0;
    this.flash = 0;
    this.time = 0;
    this.enabled = true;
    this.width = 1; this.height = 1;

    this.quad = new FullScreenQuad(null);
    this._build();
  }

  _rt(w, h, opts = {}) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      ...opts,
    });
  }

  _build() {
    const p = this.preset;
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = this._rt(1, 1, { depthBuffer: true, depthTexture, samples: p.msaa || 0 });
    this.sceneRT.texture.name = 'PostFX.scene';
    this.aoRT = this._rt(1, 1);
    this.raysRT = this._rt(1, 1);
    this.ldrRT = this._rt(1, 1, { type: THREE.UnsignedByteType });
    this.aaRT = this._rt(1, 1, { type: THREE.UnsignedByteType });
    this.captureRT = this._rt(1, 1, { type: THREE.UnsignedByteType });

    // AO: GTAO reconstructing normals from our shared depth buffer (no extra scene pass)
    this.ao = null;
    if (p.ao) {
      this.ao = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 2, 2);
      this.ao.setGBuffer(depthTexture);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    }

    this.bloom = p.bloom ? new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.92) : null;

    this.raysMat = makeMat(GODRAYS_FRAG, {
      tColor: { value: null },
      uLightPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector2()) },
      uLightColor: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(1, 1, 1)) },
      uLightStrength: { value: [1, 1, 1, 1] },
      uLightRadius: { value: [0.3, 0.3, 0.3, 0.3] },
      uLightCount: { value: 0 },
      uThreshold: { value: 1.1 },
      uDensity: { value: 0.92 },
      uDecay: { value: 0.965 },
      uWeight: { value: 0.55 },
      uAspect: { value: 1 },
      uJitter: { value: 0 },
    }, { SAMPLES: p.godRaySamples || 48 });

    this.gradeMat = makeMat(GRADE_FRAG, {
      tColor: { value: null },
      tRays: { value: this.raysRT.texture },
      tDepth: { value: depthTexture },
      uRaysOn: { value: 0 },
      uTexel: { value: new THREE.Vector2() },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uShadowTint: { value: new THREE.Vector3() },
      uHighlightTint: { value: new THREE.Vector3() },
      uSplitBalance: { value: 0.45 },
      uSplitAmount: { value: 0.5 },
      uLift: { value: new THREE.Vector3() },
      uGamma: { value: new THREE.Vector3(1, 1, 1) },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uToneMapping: { value: 0 },
      uBlackPoint: { value: 0 },
      uHighlightRolloff: { value: 1 },
      uCameraNear: { value: 0.05 },
      uCameraFar: { value: 100 },
      uDofOn: { value: 0 },
      uFocus: { value: 3 },
      uAperture: { value: 1 },
      uMaxBlur: { value: 8 },
      uFogColor: { value: new THREE.Vector3() },
      uFogDensity: { value: 0 },
    });

    if (p.aa === 'smaa') this.smaa = new SMAAPass();
    else if (p.aa === 'fxaa') {
      this.fxaaMat = new THREE.ShaderMaterial({ ...FXAAShader, uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms), depthTest: false, depthWrite: false });
    }

    this.finishMat = makeMat(FINISH_FRAG, {
      tColor: { value: null },
      tCapture: { value: this.captureRT.texture },
      uDissolve: { value: 0 },
      uDissolveSoft: { value: 0.12 },
      uFade: { value: 0 },
      uFadeColor: { value: new THREE.Color() },
      uTime: { value: 0 },
      uGrain: { value: 0.03 },
      uGrainSize: { value: 1.5 },
      uVignette: { value: 0.35 },
      uVignetteSoftness: { value: 0.6 },
      uCA: { value: 0.0015 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uFlash: { value: 0 },
    });
    this.copyMat = makeMat(COPY_FRAG, { tColor: { value: null } });
  }

  setPreset(preset) {
    this.dispose();
    this.preset = preset;
    this._build();
    this.setSize(this.width, this.height);
  }

  setSize(width, height) {
    this.width = width; this.height = height;
    const pr = this.renderer.getPixelRatio();
    const s = this.resolutionScale;
    const w = Math.max(1, Math.round(width * pr * s));
    const h = Math.max(1, Math.round(height * pr * s));
    this.iw = w; this.ih = h;
    this.sceneRT.setSize(w, h);
    this.aoRT.setSize(w, h);
    this.ldrRT.setSize(w, h);
    this.aaRT.setSize(w, h);
    this.captureRT.setSize(w, h);
    const rw = Math.max(1, Math.round(w * 0.5)), rh = Math.max(1, Math.round(h * 0.5));
    this.raysRT.setSize(rw, rh);
    if (this.ao) {
      const as = this.preset.aoScale || 0.5;
      this.ao.setSize(Math.max(1, Math.round(w * as)), Math.max(1, Math.round(h * as)));
    }
    if (this.bloom) this.bloom.setSize(Math.round(w * (this.preset.bloomScale || 0.5)), Math.round(h * (this.preset.bloomScale || 0.5)));
    if (this.smaa) this.smaa.setSize(w, h);
    if (this.fxaaMat) this.fxaaMat.uniforms.resolution.value.set(1 / w, 1 / h);
    this.gradeMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.finishMat.uniforms.uResolution.value.set(w, h);
  }

  setResolutionScale(s) {
    s = THREE.MathUtils.clamp(s, 0.4, 1);
    if (Math.abs(s - this.resolutionScale) < 0.02) return;
    this.resolutionScale = s;
    this.setSize(this.width, this.height);
  }

  /** Merge grade parameters. With `duration` > 0 the change is blended smoothly. */
  set(params = {}, duration = 0) {
    if (duration > 0) {
      this._from = structuredClone(this.grade);
      this._target = { ...structuredClone(this.grade), ...structuredClone(params) };
      this._blend = 0; this._blendDur = duration;
    } else {
      Object.assign(this.grade, structuredClone(params));
      this._target = structuredClone(this.grade);
      this._blendDur = 0;
    }
  }
  reset(duration = 0) { this.set(structuredClone(DEFAULT_GRADE), duration); }

  _tickBlend(dt) {
    if (!this._blendDur) return;
    this._blend = Math.min(1, this._blend + dt / this._blendDur);
    const k = this._blend * this._blend * (3 - 2 * this._blend);
    for (const key of Object.keys(this._target)) {
      const a = this._from[key], b = this._target[key];
      if (typeof b === 'number' && typeof a === 'number') this.grade[key] = a + (b - a) * k;
      else if (Array.isArray(b) && Array.isArray(a)) this.grade[key] = b.map((v, i) => a[i] + (v - a[i]) * k);
      else this.grade[key] = b;
    }
    if (this._blend >= 1) this._blendDur = 0;
  }

  /** Captures the current final image (pre-grain) for a dissolve transition. */
  capture() {
    if (!this._lastAA) return;
    this.copyMat.uniforms.tColor.value = this._lastAA.texture;
    this._pass(this.copyMat, this.captureRT);
  }

  _pass(material, target) {
    this.renderer.setRenderTarget(target);
    this.quad.material = material;
    this.quad.render(this.renderer);
  }

  /**
   * Render a full frame of `scene` through `camera` with the post stack.
   * @param {number} dt seconds
   */
  render(scene, camera, dt = 0.016) {
    const r = this.renderer;
    const g = this.grade;
    this._tickBlend(dt);

    // 1. scene -> HDR target with depth
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);
    this.sceneInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    let hdr = this.sceneRT;
    const off = this.disabled || {};

    // 2. ambient occlusion (multiplied into the HDR frame)
    if (this.ao && g.aoIntensity > 0.001 && !off.ao) {
      this.ao.camera = camera;
      this.ao.scene = scene;
      this.ao.blendIntensity = g.aoIntensity;
      const m = this.ao.gtaoMaterial.uniforms;
      m.radius.value = g.aoRadius;
      m.distanceFallOff.value = g.aoDistanceFallOff;
      m.thickness.value = g.aoThickness;
      this.ao.render(r, this.aoRT, this.sceneRT);
      hdr = this.aoRT;
    }

    // 3. god rays (half res, additive in grade)
    let raysOn = 0;
    if (this.preset.godRays && this.godRaySources.length && g.godRayWeight > 0 && !off.rays) {
      const u = this.raysMat.uniforms;
      let n = 0;
      const v = new THREE.Vector3();
      for (const src of this.godRaySources) {
        if (n >= 4) break;
        if (src.enabled === false) continue;
        v.copy(src.position).project(camera);
        if (v.z > 1 || v.z < -1) continue; // behind camera
        u.uLightPos.value[n].set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
        const c = src.color || new THREE.Color(0.75, 0.85, 1.0);
        u.uLightColor.value[n].set(c.r, c.g, c.b);
        u.uLightStrength.value[n] = src.strength ?? 1;
        u.uLightRadius.value[n] = src.radius ?? 0.3;
        n++;
      }
      if (n > 0) {
        u.uLightCount.value = n;
        u.tColor.value = hdr.texture;
        u.uThreshold.value = g.godRayThreshold;
        u.uDensity.value = g.godRayDensity;
        u.uDecay.value = g.godRayDecay;
        u.uWeight.value = g.godRayWeight;
        u.uAspect.value = this.iw / this.ih;
        u.uJitter.value = this.time % 1;
        this._pass(this.raysMat, this.raysRT);
        raysOn = 1;
      }
    }

    // 4. bloom (in place, additive)
    if (this.bloom && g.bloomStrength > 0.001 && !off.bloom) {
      this.bloom.strength = g.bloomStrength;
      this.bloom.radius = g.bloomRadius;
      this.bloom.threshold = g.bloomThreshold;
      this.bloom.render(r, null, hdr, dt, false);
    }

    // 5. grade + tonemap -> LDR
    const gu = this.gradeMat.uniforms;
    gu.tColor.value = hdr.texture;
    gu.uRaysOn.value = raysOn;
    gu.uExposure.value = g.exposure * (this.brightness ?? 1);
    gu.uContrast.value = g.contrast;
    gu.uSaturation.value = g.saturation;
    gu.uShadowTint.value.fromArray(g.shadowTint);
    gu.uHighlightTint.value.fromArray(g.highlightTint);
    gu.uSplitBalance.value = g.splitBalance;
    gu.uSplitAmount.value = g.splitAmount;
    gu.uLift.value.fromArray(g.lift);
    gu.uGamma.value.fromArray(g.gamma);
    gu.uGain.value.fromArray(g.gain);
    gu.uToneMapping.value = TM[g.toneMapping] ?? 0;
    gu.uBlackPoint.value = g.blackPoint;
    gu.uHighlightRolloff.value = g.highlightRolloff;
    gu.uCameraNear.value = camera.near;
    gu.uCameraFar.value = camera.far;
    gu.uFogColor.value.fromArray(g.fogColor);
    gu.uFogDensity.value = g.fogDensity;
    if (g.dof) {
      gu.uDofOn.value = 1;
      gu.uFocus.value = g.dof.focus ?? 3;
      gu.uAperture.value = g.dof.aperture ?? 1;
      gu.uMaxBlur.value = (g.dof.maxBlur ?? 8) * (this.iw / 1280);
    } else gu.uDofOn.value = 0;
    this._pass(this.gradeMat, this.ldrRT);

    // 6. anti-aliasing
    let ldr = this.ldrRT;
    if (this.smaa) {
      this.smaa.render(r, this.aaRT, this.ldrRT);
      ldr = this.aaRT;
    } else if (this.fxaaMat) {
      this.fxaaMat.uniforms.tDiffuse.value = this.ldrRT.texture;
      this._pass(this.fxaaMat, this.aaRT);
      ldr = this.aaRT;
    }
    this._lastAA = ldr;

    // 7. finish -> screen
    const fu = this.finishMat.uniforms;
    fu.tColor.value = ldr.texture;
    fu.uDissolve.value = this.dissolve;
    fu.uFade.value = this.fade;
    fu.uFadeColor.value.copy(this.fadeColor);
    fu.uTime.value = this.time;
    fu.uGrain.value = this.grainEnabled === false ? 0 : g.grain;
    fu.uGrainSize.value = g.grainSize;
    fu.uVignette.value = g.vignette;
    fu.uVignetteSoftness.value = g.vignetteSoftness;
    fu.uCA.value = g.chromaticAberration;
    fu.uFlash.value = this.flash;
    this._pass(this.finishMat, null);
  }

  dispose() {
    for (const rt of [this.sceneRT, this.aoRT, this.raysRT, this.ldrRT, this.aaRT, this.captureRT]) rt?.dispose();
    this.sceneRT?.depthTexture?.dispose();
    this.ao?.dispose(); this.bloom?.dispose(); this.smaa?.dispose();
    for (const m of [this.raysMat, this.gradeMat, this.finishMat, this.copyMat, this.fxaaMat]) m?.dispose();
  }
}
