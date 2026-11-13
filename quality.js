// Graphics quality presets (Low / Medium / High). Stored locally and read by the renderer.
// The first launch picks a default from the device: phones and low-core CPUs start on Low.
import { storage } from './storage.js';

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

const PRESETS = {
  low: {
    antialias: false,
    maxPixelRatio: 1,
    shadowMapSize: 0,        // 0 = shadows off
    fogFar: 120,
    decorDensity: 0.3,       // share of decorative props kept (0..1)
    grassDensity: 0,
    particles: 60,
    pointLights: 0,
    foliageSway: false,
    waterDetail: false,
    treeSegments: 5
  },
  medium: {
    antialias: true,
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    fogFar: 180,
    decorDensity: 0.65,
    grassDensity: 0.5,
    particles: 150,
    pointLights: 1,
    foliageSway: true,
    waterDetail: true,
    treeSegments: 7
  },
  high: {
    antialias: true,
    maxPixelRatio: 2,
    shadowMapSize: 2048,
    fogFar: 250,
    decorDensity: 1,
    grassDensity: 1,
    particles: 300,
    pointLights: 3,
    foliageSway: true,
    waterDetail: true,
    treeSegments: 8
  }
};

function guessDefault() {
  try {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (mobile || cores <= 4 || memory <= 4) return 'low';
    return cores >= 8 && memory >= 8 ? 'high' : 'medium';
  } catch {
    return 'low';
  }
}

export function getQualityLevel() {
  const saved = storage.get('quality', null);
  return QUALITY_LEVELS.includes(saved) ? saved : guessDefault();
}

export function setQualityLevel(level) {
  if (QUALITY_LEVELS.includes(level)) storage.set('quality', level);
}

/** Returns the preset for the current level, with the device pixel ratio already capped. */
export function getQuality() {
  const level = getQualityLevel();
  const preset = { ...PRESETS[level], level };
  preset.pixelRatio = Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio);
  return preset;
}
