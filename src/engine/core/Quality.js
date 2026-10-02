// Quality presets. Every engine subsystem reads from the active preset object.
// Rooms can read ctx.quality to scale their own effort (e.g. particle counts).

export const PRESETS = {
  low: {
    name: 'low',
    pixelRatio: 0.75,
    maxPixelRatio: 1,
    textureSize: 512,
    shadows: true,
    shadowMapSize: 512,
    shadowRadius: 2,
    ao: false,
    aoScale: 0.5,
    bloom: true,
    bloomScale: 0.5,
    godRays: false,
    godRaySamples: 24,
    aa: 'fxaa',
    msaa: 0,
    envBake: false,
    envBakeSize: 64,
    particles: 0.4,
    volumetricSteps: 6,
    anisotropy: 2,
    dynamicResolution: true,
  },
  medium: {
    name: 'medium',
    pixelRatio: 1,
    maxPixelRatio: 1,
    textureSize: 1024,
    shadows: true,
    shadowMapSize: 1024,
    shadowRadius: 3,
    ao: true,
    aoScale: 0.5,
    bloom: true,
    bloomScale: 0.5,
    godRays: true,
    godRaySamples: 32,
    aa: 'smaa',
    msaa: 0,
    envBake: true,
    envBakeSize: 128,
    particles: 0.7,
    volumetricSteps: 10,
    anisotropy: 4,
    dynamicResolution: true,
  },
  high: {
    name: 'high',
    pixelRatio: 1,
    maxPixelRatio: 1.5,
    textureSize: 2048,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 4,
    ao: true,
    aoScale: 0.75,
    bloom: true,
    bloomScale: 0.5,
    godRays: true,
    godRaySamples: 48,
    aa: 'smaa',
    msaa: 0,
    envBake: true,
    envBakeSize: 256,
    particles: 1,
    volumetricSteps: 16,
    anisotropy: 8,
    dynamicResolution: true,
  },
  ultra: {
    name: 'ultra',
    pixelRatio: 1,
    maxPixelRatio: 2,
    textureSize: 2048,
    shadows: true,
    shadowMapSize: 4096,
    shadowRadius: 5,
    ao: true,
    aoScale: 1,
    bloom: true,
    bloomScale: 0.5,
    godRays: true,
    godRaySamples: 64,
    aa: 'smaa',
    msaa: 4,
    envBake: true,
    envBakeSize: 256,
    particles: 1,
    volumetricSteps: 24,
    anisotropy: 16,
    dynamicResolution: false,
  },
  // Deterministic screenshot preset (SwiftShader friendly, still "high" looking)
  shot: {
    name: 'shot',
    pixelRatio: 1,
    maxPixelRatio: 1,
    textureSize: 1024,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 4,
    ao: true,
    aoScale: 0.75,
    bloom: true,
    bloomScale: 0.5,
    godRays: true,
    godRaySamples: 48,
    aa: 'smaa',
    msaa: 0,
    envBake: true,
    envBakeSize: 128,
    particles: 1,
    volumetricSteps: 16,
    anisotropy: 8,
    dynamicResolution: false,
  },
};

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

/** Heuristic GPU tiering. */
export function detectQuality(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    if (/swiftshader|llvmpipe|software|basic render/.test(name)) return 'low';
    const mobile = /iphone|ipad|android|mobile/i.test(navigator.userAgent);
    if (mobile) return /apple gpu|adreno \(tm\) 7|mali-g7/.test(name) ? 'medium' : 'low';
    if (/rtx|radeon rx [67]|rx 7|rx 6|apple m[2-9]|apple m1 (pro|max|ultra)|arc a7/.test(name)) return 'ultra';
    if (/gtx|radeon|apple m1|apple gpu|iris xe|arc/.test(name)) return 'high';
    if (/intel/.test(name)) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}

export function resolvePreset(name, renderer) {
  const key = name === 'auto' ? detectQuality(renderer) : name;
  return { ...(PRESETS[key] || PRESETS.high) };
}
