export { GameLoop } from './core/game-loop.js';
export { SceneManager } from './core/scene-manager.js';
export { Scene } from './core/scene.js';
export { requireDependencies } from './core/dependency-contract.js';
export { Renderer } from './renderer/renderer.js';
export { Camera } from './renderer/camera.js';
export { InputManager } from './input/input-manager.js';
export { PhysicsEngine } from './physics/physics-engine.js';
export { CollisionSolver } from './physics/collision-solver.js';
export { SlopeSurface } from './physics/slope-surface.js';
export { AudioEngine } from './audio/audio-engine.js';
export {
  SettingsStore,
  SETTINGS_SCHEMA_VERSION,
  restoreAudioSettings
} from './audio/audio-settings.js';
export { NoteFrequencyCalculator, NoteFrequencyError } from './audio/note-frequency-calculator.js';
export { DataDriven } from './data/data-driven.js';
export { TextResolver } from './data/text-resolver.js';
export { SaveSystem } from './data/save-system.js';
export { Entity } from './entities/entity.js';
export { StageBase } from './entities/stage-base.js';
export { Section } from './entities/section.js';
export { UIElement } from './ui/ui-element.js';
export { DialogueEngine } from './dialog/dialogue-engine.js';
