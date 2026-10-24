import { requireDependencies } from '../../engine/index.js';
import { TitleMenu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen, InfoScreen, InventoryUI, HUD } from '../../game/ui/ui-components.js';
import { resolveColor, resolveConfig } from '../../game/utils/color-utils.js';

const UI_BUILDER_DEPENDENCIES = [
  'textResolver',
  'menuConfig',
  'hudConfig',
  'inventoryConfig',
  'colorsConfig',
  'bordersConfig',
  'inventory',
  'player',
  'scoreSystem',
  'progressionSystem',
  'healthSystem'
];

export class UiBuilder {
  #textResolver;
  #menus;
  #colors;
  #hudConfig;
  #inventoryUIConfig;
  #bordersConfig;
  #inventory;
  #player;
  #scoreSystem;
  #progressionSystem;
  #healthSystem;

  constructor(dependencies) {
    const {
      textResolver,
      menuConfig,
      hudConfig,
      inventoryConfig,
      colorsConfig,
      bordersConfig,
      inventory,
      player,
      scoreSystem,
      progressionSystem,
      healthSystem
    } = requireDependencies('UiBuilder', dependencies, UI_BUILDER_DEPENDENCIES);
    this.#textResolver = textResolver;
    this.#menus = menuConfig;
    this.#colors = colorsConfig;
    this.#hudConfig = resolveConfig(hudConfig, colorsConfig);
    this.#inventoryUIConfig = resolveConfig(inventoryConfig, colorsConfig);
    this.#bordersConfig = bordersConfig;
    this.#inventory = inventory;
    this.#player = player;
    this.#scoreSystem = scoreSystem;
    this.#progressionSystem = progressionSystem;
    this.#healthSystem = healthSystem;
  }

  static buildMenuSubConfig(menuConfig, screenKey, colorsConfig) {
    const defaults = menuConfig['menu-defaults'] ?? {};
    const screen = menuConfig.menus?.[screenKey] ?? {};

    const titleDefaults = defaults.title ?? {};
    const titleOverrides = screen.title ?? {};
    const titleConfig = { ...titleDefaults, ...titleOverrides };

    const buttons = screen.buttons ?? [];
    const buttonDefaults = defaults.button ?? {};

    const subtitleDefaults = defaults.subtitle ?? {};
    const hintDefaults = defaults.hint ?? {};
    const overlayDefaults = defaults.overlay ?? {};
    const layoutDefaults = defaults.layout ?? {};
    const layoutOverrides = screen['layout-overrides'] ?? {};

    return {
      items: buttons.map((b) => ({
        label: b['label-key'] ?? b.label ?? '',
        action: b.action ?? '',
        'visible-condition': b['visible-condition'] ?? null
      })),
      sliders: resolveConfig(screen.sliders ?? [], colorsConfig),
      visible: screen.visible !== false,
      'title-key': screen['title-key'] ?? null,
      'subtitle-key': screen['subtitle-key'] ?? null,
      'hint-key': screen['hint-key'] ?? null,
      'start-offset': screen['start-offset'] ?? { x: 0, y: 0 },
      'title-color': resolveColor(titleConfig.color, colorsConfig) ?? '#FFFFFF',
      'title-font-size': titleConfig['font-size'] ?? 0.6,
      'title-anchor': titleConfig.anchor ?? 'top-center',
      'font-family': defaults['font-family'] ?? 'monospace',
      overlay: resolveConfig(overlayDefaults, colorsConfig),
      'overlay-opacity': screen['overlay-opacity'] ?? overlayDefaults['background-opacity'] ?? 1,
      layout: resolveConfig({
        ...layoutDefaults,
        ...layoutOverrides,
        title: { ...(layoutDefaults.title ?? {}), ...(layoutOverrides.title ?? {}) },
        items: { ...(layoutDefaults.items ?? {}), ...(layoutOverrides.items ?? {}) },
        rows: { ...(layoutDefaults.rows ?? {}), ...(layoutOverrides.rows ?? {}) }
      }, colorsConfig),
      subtitle: resolveConfig(subtitleDefaults, colorsConfig),
      hint: resolveConfig(hintDefaults, colorsConfig),
      button: resolveConfig({ ...buttonDefaults, ...(screen.button ?? {}) }, colorsConfig)
    };
  }

  menuConfig(screenKey) {
    return UiBuilder.buildMenuSubConfig(this.#menus, screenKey, this.#colors);
  }

  titleMenu() {
    return new TitleMenu(this.menuConfig('title-screen'), this.#textResolver);
  }

  pauseMenu() {
    return new PauseMenu(this.menuConfig('pause-menu'), this.#textResolver);
  }

  settingsMenu(settings) {
    return new SettingsMenu(this.menuConfig('settings'), this.#textResolver, settings);
  }

  infoScreen(screenKey) {
    const defaults = this.#menus['menu-defaults'] ?? {};
    const screens = this.#menus['info-screens'] ?? {};
    const screen = screens[screenKey];
    if (!screen) {
      throw new Error(`Info screen "${screenKey}" is not declared in the UI menu configuration.`);
    }

    const titleDefaults = defaults.title ?? {};
    const lineDefaults = { ...(defaults.subtitle ?? {}), ...(screen.line ?? {}) };

    return new InfoScreen({
      'title-key': screen['title-key'],
      'title-color': resolveColor(titleDefaults.color, this.#colors) ?? '#FFFFFF',
      'title-font-size': titleDefaults['font-size'] ?? 0.6,
      'font-family': defaults['font-family'] ?? 'monospace',
      'start-offset': screen['start-offset'] ?? { x: 0, y: 2.8 },
      lines: screen.lines ?? [],
      line: resolveConfig(lineDefaults, this.#colors),
      'hint-key': screen['hint-key'] ?? null,
      hint: resolveConfig(defaults.hint ?? {}, this.#colors)
    }, this.#textResolver);
  }

  hud(player) {
    return new HUD(this.#hudConfig, player, this.#textResolver, this.#bordersConfig);
  }

  stageScreens({ stageName, stageNameKey = null, bigFruit = null }) {
    const clearScreen = new StageClearScreen(this.menuConfig('stage-clear'), this.#textResolver, {
      stageName: stageName ?? '',
      stageNameKey,
      fruit: () => bigFruit,
      abilities: () => this.#abilitiesForFruit(bigFruit),
      score: () => this.#scoreSystem?.score ?? this.#player?.scoreSystem?.score ?? 0
    });
    const gameOverScreen = new GameOverScreen(this.menuConfig('game-over'), this.#textResolver, this.#healthSystem);
    const pauseMenu = new PauseMenu(this.menuConfig('pause-menu'), this.#textResolver);
    const inventoryUI = new InventoryUI(this.#inventoryUIConfig, this.#inventory, this.#textResolver);
    return { clearScreen, gameOverScreen, pauseMenu, inventoryUI };
  }

  #abilitiesForFruit(fruit) {
    if (!fruit || !this.#progressionSystem) {
      return [];
    }

    const level = this.#progressionSystem.getLevelForCollectible(fruit);
    if (level < 0) {
      return [];
    }

    return this.#progressionSystem.getAbilitiesForLevel(level);
  }
}
