import { DashAbility } from '../../game/abilities/dash-ability.js';
import { ShootAbility } from '../../game/abilities/shoot-ability.js';
import { FlightAbility } from '../../game/abilities/flight-ability.js';
import { DoubleJumpAbility } from '../../game/abilities/double-jump-ability.js';
import { AirSlideAbility } from '../../game/abilities/air-slide-ability.js';
import { CrouchAbility } from '../../game/abilities/crouch-ability.js';
import { SlideAttackAbility } from '../../game/abilities/slide-attack-ability.js';
import { ScreenClearAbility } from '../../game/abilities/screen-clear-ability.js';
import { InvincibilityAbility } from '../../game/abilities/invincibility-ability.js';
import { createKindRegistry } from '../content/kind-registry.js';

const ABILITY_KIND_ENTRIES = [
  ['dash', (config) => new DashAbility(config)],
  ['crouch', (config) => new CrouchAbility(config)],
  ['slide-attack', (config) => new SlideAttackAbility(config)],
  ['shoot', (config, deps) => new ShootAbility(config, deps)],
  ['flight', (config) => new FlightAbility(config)],
  ['double-jump', (config) => new DoubleJumpAbility(config)],
  ['air-slide', (config) => new AirSlideAbility(config)],
  ['screen-clear', (config) => new ScreenClearAbility(config)],
  ['invincibility', (config) => new InvincibilityAbility(config)]
];

function createAbilities(abilitiesConfig, deps = {}) {
  const registry = createKindRegistry('ability kind', ABILITY_KIND_ENTRIES);
  const abilities = [];
  const abilitiesData = abilitiesConfig.abilities ?? {};

  for (const [name, config] of Object.entries(abilitiesData)) {
    const type = config.type ?? name;
    const fullConfig = { name, ...config };
    const create = registry.resolve(type);
    abilities.push(create(fullConfig, deps));
  }

  return abilities;
}

export { createAbilities, ABILITY_KIND_ENTRIES };
