import { UIElement, anchorPosition } from '../../engine/ui/ui-element.js';

function withOpacity(color, opacity) {
  if (typeof color !== 'string' || !color.startsWith('#')
    || opacity === undefined || opacity === null || opacity >= 1) {
    return color;
  }

  const hex = color.slice(1);
  if (hex.length !== 6) {
    return color;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

class HUD extends UIElement {
  #player;
  #textResolver;
  #hudConfig;
  #bordersConfig;

  constructor(hudConfig, player, textResolver, bordersConfig = null) {
    super({ x: 0, y: 0, width: 40, height: 30 });
    this.#hudConfig = hudConfig;
    this.#player = player;
    this.#textResolver = textResolver;
    this.#bordersConfig = bordersConfig;
  }

  get player() { return this.#player; }
  get noteCollection() { return this.#player ? this.#player.noteCollection : null; }

  update(dt) {
    super.update(dt);
  }

  #borderWidth(style) {
    const border = this.#bordersConfig?.borders?.[style];
    return typeof border?.width === 'number' ? border.width : 0;
  }

  #renderBackground(renderer, hudCfg) {
    const background = hudCfg.background;
    if (!background) {
      return;
    }

    const color = withOpacity(background.color, background.opacity);
    renderer.drawRect(0, 0, renderer.viewportWidth, hudCfg.height, 0, color, null, 0);
  }

  #renderBorder(renderer, hudCfg) {
    const border = hudCfg.border;
    if (!border) {
      return;
    }

    const width = this.#borderWidth(border.style);
    if (width <= 0 || !border.color) {
      return;
    }

    renderer.drawLine(0, hudCfg.height, renderer.viewportWidth, hudCfg.height, border.color, width);
  }

  render(renderer) {
    const cfg = this.#hudConfig;
    if (!cfg || cfg.hud?.enabled === false) {
      return;
    }

    if (!this.#player) {
      return;
    }

    const hudCfg = cfg.hud;
    const elements = cfg.elements;
    const textCfg = hudCfg.text;
    const fontFamily = textCfg['font-family'];
    const defaultLabelSize = textCfg['label-size'];
    const defaultValueSize = textCfg['value-size'];

    this.#renderBackground(renderer, hudCfg);
    this.#renderBorder(renderer, hudCfg);

    const lifeCfg = elements['life-bar'];
    if (lifeCfg && lifeCfg.enabled !== false) {
      const lbOffset = lifeCfg.offset;
      const lbSize = lifeCfg.size;
      const lbX = lbOffset.x;
      const lbY = lbOffset.y;
      const lifeRatio = this.#player.healthSystem.life / this.#player.healthSystem.maxLife;

      renderer.drawRect(lbX, lbY, lbSize.width, lbSize.height, lifeCfg['corner-radius'],
        lifeCfg['empty-color'], '#000000', 0.02);
      renderer.drawRect(lbX, lbY, lbSize.width * lifeRatio, lbSize.height, lifeCfg['corner-radius'],
        lifeCfg['fill-color'], null, 0);
    }

    const levelCfg = elements['level-indicator'];
    if (levelCfg && levelCfg.enabled !== false) {
      const lvOffset = levelCfg.offset;
      const lvPrefix = this.#textResolver.text('hud.level-prefix');
      const lvText = `${lvPrefix}${this.#player.level}`;
      renderer.drawText(lvText, lvOffset.x, lvOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, levelCfg['label-color'], 'left');
    }

    const ammoCfg = elements['ammo-counter'];
    if (ammoCfg && ammoCfg.enabled !== false) {
      const amOffset = ammoCfg.offset;
      const amPrefix = this.#textResolver.text('hud.ammo-prefix');
      const ammoType = 'ammo';
      const amText = `${amPrefix}${this.#player.inventory.count(ammoType)}`;
      renderer.drawText(amText, amOffset.x, amOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, ammoCfg['icon-color'], 'left');
    }

    const coinCfg = elements['coin-counter'];
    if (coinCfg && coinCfg.enabled !== false) {
      const coOffset = coinCfg.offset;
      const coSize = coinCfg['icon-size'];
      const coPrefix = this.#textResolver.text('hud.coins-prefix');
      const coins = this.#player.scoreSystem ? this.#player.scoreSystem.coins : 0;
      const coinR = coSize.width / 2;
      renderer.drawCircle(coOffset.x, coOffset.y + coinR, coinR,
        coinCfg['icon-color'], '#000000', 0.02);
      renderer.drawText(`${coPrefix}${coins}`, coOffset.x + coSize.width + 0.2, coOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, coinCfg['label-color'], 'left');
    }

    const scoreCfg = elements['score-counter'];
    if (scoreCfg && scoreCfg.enabled !== false) {
      const scOffset = scoreCfg.offset;
      const scPrefix = this.#textResolver.text('hud.score-prefix');
      const score = this.#player.scoreSystem ? this.#player.scoreSystem.score : 0;
      renderer.drawText(`${scPrefix}${score}`, renderer.viewportWidth - scOffset.x, scOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, scoreCfg['label-color'], 'right');
    }

    const noteCollection = this.#player.noteCollection;
    const ntCfg = elements['note-tracker'];
    if (noteCollection && ntCfg && ntCfg.enabled !== false) {
      const ntOffset = ntCfg.offset;
      const noteInfo = `${noteCollection.collectedCount}/${noteCollection.totalNotes}`;
      const ntPrefix = this.#textResolver.text('hud.notes-prefix');
      const ntX = renderer.viewportWidth + ntOffset.x;
      renderer.drawText(`${ntPrefix}${noteInfo}`, ntX, ntOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, ntCfg['filled-color'], 'left');

      const slotSize = ntCfg['slot-size'];
      const slotGap = ntCfg['slot-gap'];
      const noteY = ntOffset.y + slotSize.height + 0.15;
      for (let i = 0; i < noteCollection.totalNotes; i++) {
        const isCollected = noteCollection.isCollected(i + 1);
        const noteColor = isCollected
          ? ntCfg['filled-color']
          : ntCfg['empty-color'];
        renderer.drawCircle(ntX + i * (slotSize.width + slotGap), noteY, slotSize.width / 2,
          noteColor, '#000000', 0.01);
      }
    }

    const inventoryCfg = elements['inventory-indicator'];
    if (inventoryCfg && inventoryCfg.enabled !== false) {
      const size = inventoryCfg.size;
      const position = anchorPosition(
        inventoryCfg.anchor,
        inventoryCfg.offset,
        size.width,
        size.height,
        renderer.viewportWidth,
        renderer.viewportHeight
      );
      const borderWidth = this.#borderWidth(inventoryCfg.border);

      renderer.drawRect(position.x, position.y, size.width, size.height,
        inventoryCfg['corner-radius'] ?? 0, inventoryCfg['fill-color'] ?? null,
        inventoryCfg['border-color'] ?? null, borderWidth);

      const labelOffset = inventoryCfg['label-offset'] ?? { x: 0, y: 0 };
      const label = this.#textResolver.text(inventoryCfg['label-key']);
      renderer.drawText(label, position.x + size.width / 2 + labelOffset.x,
        position.y + labelOffset.y + defaultLabelSize,
        `${defaultLabelSize}px ${fontFamily}`, inventoryCfg['label-color'], 'center');

      const inventory = this.#player.inventory;
      const selected = inventory?.defaultSelected ?? null;
      if (selected) {
        const count = typeof inventory.count === 'function' ? inventory.count(selected) : 0;
        renderer.drawText(selected, position.x + size.width / 2,
          position.y + size.height * 0.45,
          `${defaultLabelSize}px ${fontFamily}`, inventoryCfg['item-color'], 'center');
        renderer.drawText(`x${count}`, position.x + size.width / 2,
          position.y + size.height * 0.9,
          `${defaultLabelSize}px ${fontFamily}`, inventoryCfg['count-color'], 'center');
      }
    }
  }
}

class Menu extends UIElement {
  #selectedIndex;
  #textResolver;
  #items;
  #titleKey;
  #titleColor;
  #titleFontSize;
  #fontFamily;
  #startOffset;
  #onClose;
  #onConfirm;
  #buttonConfig;
  #subtitleKey;
  #subtitleConfig;
  #hintKey;
  #hintConfig;
  #overlay;
  #overlayOpacity;
  #layout;
  #conditions;

  constructor(menuConfig, textResolver, conditions = {}) {
    super(menuConfig);
    this.#textResolver = textResolver;
    this.#selectedIndex = 0;
    this.#items = menuConfig.items;
    this.#titleKey = menuConfig['title-key'];
    this.#titleColor = menuConfig['title-color'];
    this.#titleFontSize = menuConfig['title-font-size'];
    this.#fontFamily = menuConfig['font-family'];
    this.#startOffset = menuConfig['start-offset'];
    this.#buttonConfig = menuConfig.button;
    this.#subtitleKey = menuConfig['subtitle-key'];
    this.#subtitleConfig = menuConfig.subtitle;
    this.#hintKey = menuConfig['hint-key'];
    this.#hintConfig = menuConfig.hint;
    this.#overlay = menuConfig.overlay;
    this.#overlayOpacity = menuConfig['overlay-opacity'];
    this.#layout = menuConfig.layout ?? {};
    this.#conditions = conditions;
    this.#onClose = null;
    this.#onConfirm = null;
  }

  #conditionSatisfied(conditionName) {
    if (!conditionName) {
      return true;
    }

    const evaluator = this.#conditions[conditionName];
    if (typeof evaluator !== 'function') {
      return true;
    }

    return evaluator() !== false;
  }

  isItemVisible(item) {
    if (!item || item.visible === false) {
      return false;
    }

    return this.#conditionSatisfied(item['visible-condition'] ?? item.visibleCondition ?? null);
  }

  get visibleItemIndices() {
    const indices = [];
    for (let i = 0; i < this.#items.length; i++) {
      if (this.isItemVisible(this.#items[i])) {
        indices.push(i);
      }
    }
    return indices;
  }

  get visibleItems() {
    return this.visibleItemIndices.map((index) => this.#items[index]);
  }

  #syncSelection() {
    const indices = this.visibleItemIndices;
    if (indices.length === 0) {
      this.#selectedIndex = -1;
      return;
    }

    if (!indices.includes(this.#selectedIndex)) {
      this.#selectedIndex = indices[0];
    }
  }

  get selectedIndex() {
    this.#syncSelection();
    return this.#selectedIndex;
  }

  navigateUp() {
    this.#syncSelection();
    const indices = this.visibleItemIndices;
    if (indices.length === 0) {
      return;
    }

    const position = indices.indexOf(this.#selectedIndex);
    this.#selectedIndex = indices[(position - 1 + indices.length) % indices.length];
  }

  navigateDown() {
    this.#syncSelection();
    const indices = this.visibleItemIndices;
    if (indices.length === 0) {
      return;
    }

    const position = indices.indexOf(this.#selectedIndex);
    this.#selectedIndex = indices[(position + 1) % indices.length];
  }

  confirm() {
    this.#syncSelection();
    const item = this.#items[this.#selectedIndex];
    if (item && this.isItemVisible(item) && this.#onConfirm) {
      this.#onConfirm(item.action);
    }
  }

  back() {
    if (this.#onClose) {
      this.#onClose();
    }
  }

  get onClose() { return this.#onClose; }
  set onClose(fn) { this.#onClose = fn; }

  get onConfirm() { return this.#onConfirm; }
  set onConfirm(fn) { this.#onConfirm = fn; }

  get items() { return [...this.#items]; }
  get textResolver() { return this.#textResolver; }
  get titleKey() { return this.#titleKey; }
  get titleColor() { return this.#titleColor; }
  get titleFontSize() { return this.#titleFontSize; }
  get fontFamily() { return this.#fontFamily; }
  get startOffset() { return this.#startOffset; }
  get overlay() { return this.#overlay; }
  get overlayOpacity() { return this.#overlayOpacity; }
  get layout() { return this.#layout; }

  update(dt, inputManager) {
    super.update(dt);

    if (inputManager) {
      if (inputManager.isPressed('up')) {
        this.navigateUp();
      }
      if (inputManager.isPressed('down')) {
        this.navigateDown();
      }
      if (inputManager.isPressed('confirm')) {
        this.confirm();
      }
      if (inputManager.isPressed('back')) {
        this.back();
      }
    }
  }

  render(renderer) {
    if (!this.visible) {
      return;
    }

    this.renderSubtitle(renderer);
    this.renderItems(renderer);
    this.renderHint(renderer);
  }

  renderOverlay(renderer) {
    const background = this.#overlay;
    const color = withOpacity(background?.['background-color'] ?? '#000000', this.#overlayOpacity);
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, color, null, 0);
  }

  renderItems(renderer, startY = null) {
    const btn = this.#buttonConfig;
    const gap = btn['gap'];
    const fontSize = btn['font-size'];
    const selectedColor = btn['selected-text-color'];
    const defaultColor = btn['text-color'];
    const selectedPrefix = btn['selected-prefix'] ?? '> ';
    const selectedSuffix = btn['selected-suffix'] ?? ' <';
    const defaultPrefix = btn['default-prefix'] ?? '';
    const defaultSuffix = btn['default-suffix'] ?? '';
    const itemHeight = btn['size'].height;
    const visibleIndices = this.visibleItemIndices;

    this.#syncSelection();

    const firstY = startY ?? ((this.#startOffset && this.#startOffset.y > 0)
      ? this.#startOffset.y
      : (renderer.viewportHeight / 2 - visibleIndices.length * (itemHeight + gap) / 2));

    for (let row = 0; row < visibleIndices.length; row++) {
      const index = visibleIndices[row];
      const item = this.#items[index];
      const label = this.#textResolver.text(item.label);
      const isSelected = index === this.#selectedIndex;
      const color = isSelected ? selectedColor : defaultColor;

      renderer.drawText(
        isSelected
          ? `${selectedPrefix}${label}${selectedSuffix}`
          : `${defaultPrefix}${label}${defaultSuffix}`,
        renderer.viewportWidth / 2,
        firstY + row * (itemHeight + gap),
        `${fontSize}px ${this.#fontFamily}`,
        color,
        'center'
      );
    }
  }

  renderSubtitle(renderer) {
    this.#renderTextLine(renderer, this.#subtitleKey, this.#subtitleConfig);
  }

  renderHint(renderer) {
    this.#renderTextLine(renderer, this.#hintKey, this.#hintConfig);
  }

  #renderTextLine(renderer, textKey, config) {
    if (!textKey || !config) {
      return;
    }

    const label = this.#textResolver.text(textKey);
    const offset = config.offset;
    const x = renderer.viewportWidth / 2 + offset.x;
    const y = (config.anchor === 'bottom-center')
      ? renderer.viewportHeight + offset.y
      : offset.y;

    renderer.drawText(label, x, y, `${config['font-size']}px ${this.#fontFamily}`, config.color, 'center');
  }
}

class TitleMenu extends Menu {
  constructor(menuConfig, textResolver) {
    super(menuConfig, textResolver);
  }
}

class PauseMenu extends Menu {
  constructor(menuConfig, textResolver) {
    super(menuConfig, textResolver);
  }

  render(renderer) {
    this.renderOverlay(renderer);

    const layout = this.layout;
    const titleLayout = layout.title ?? {};
    const startY = layout.items?.['start-y'] ?? 4.2;

    const titleKey = this.titleKey;
    const pauseLabel = this.textResolver.text(titleKey);
    renderer.drawText(pauseLabel, renderer.viewportWidth / 2, titleLayout['offset-y'] ?? 2.2,
      `${this.titleFontSize + (titleLayout['font-size-offset'] ?? 0.2)}px ${this.fontFamily}`,
      this.titleColor, 'center');

    this.renderItems(renderer, startY);
    this.renderHint(renderer);
  }
}

class SettingsMenu extends Menu {
  #settings;
  #sliders;
  #buttonConfig;
  #selectedRow;

  constructor(menuConfig, textResolver, settings) {
    super(menuConfig, textResolver);
    this.#settings = settings;
    this.#sliders = menuConfig.sliders ?? [];
    this.#buttonConfig = menuConfig.button;
    this.#selectedRow = 0;
  }

  get settings() { return this.#settings; }

  get selectedRow() { return this.#selectedRow; }

  #rowCount() {
    return this.#sliders.length + this.visibleItems.length;
  }

  #visibleButtons() {
    return this.visibleItems;
  }

  #syncSelectedRow() {
    const count = this.#rowCount();
    if (count === 0) {
      this.#selectedRow = 0;
      return;
    }

    if (this.#selectedRow >= count) {
      this.#selectedRow = count - 1;
    }
  }

  #selectedSlider() {
    return this.#selectedRow < this.#sliders.length ? this.#sliders[this.#selectedRow] : null;
  }

  #selectedItem() {
    const index = this.#selectedRow - this.#sliders.length;
    if (index < 0) {
      return null;
    }
    return this.#visibleButtons()[index] ?? null;
  }

  #readSetting(settingKey) {
    return this.#settings ? this.#settings.get(settingKey) : 0;
  }

  #writeSetting(settingKey, value) {
    this.#settings?.set(settingKey, value);
  }

  #adjustSelected(delta) {
    const slider = this.#selectedSlider();
    if (!slider) {
      return;
    }

    const min = slider.min ?? 0;
    const max = slider.max ?? 1;
    const step = slider.step ?? 0.1;
    const current = this.#readSetting(slider['setting-key']);
    const next = Math.min(max, Math.max(min, Math.round((current + delta * step) * 100) / 100));
    this.#writeSetting(slider['setting-key'], next);
  }

  navigateUp() {
    const count = this.#rowCount();
    if (count === 0) {
      return;
    }
    this.#syncSelectedRow();
    this.#selectedRow = (this.#selectedRow - 1 + count) % count;
  }

  navigateDown() {
    const count = this.#rowCount();
    if (count === 0) {
      return;
    }
    this.#syncSelectedRow();
    this.#selectedRow = (this.#selectedRow + 1) % count;
  }

  confirm() {
    this.#syncSelectedRow();
    const item = this.#selectedItem();
    if (item && this.onConfirm) {
      this.onConfirm(item.action);
    }
  }

  back() {
    if (this.onClose) {
      this.onClose();
    }
  }

  update(dt, inputManager) {
    if (!inputManager) {
      return;
    }
    if (inputManager.isPressed('up')) {
      this.navigateUp();
    }
    if (inputManager.isPressed('down')) {
      this.navigateDown();
    }
    if (inputManager.isPressed('left')) {
      this.#adjustSelected(-1);
    }
    if (inputManager.isPressed('right')) {
      this.#adjustSelected(1);
    }
    if (inputManager.isPressed('confirm')) {
      this.confirm();
    }
    if (inputManager.isPressed('back')) {
      this.back();
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, '#000000', null, 0);

    const layout = this.layout;
    const titleLayout = layout.title ?? {};
    const itemsLayout = layout.items ?? {};
    const rowsLayout = layout.rows ?? {};
    const rowGap = rowsLayout.gap ?? 1.15;
    const firstRowY = itemsLayout['start-y'] ?? 3.0;
    const buttonGap = itemsLayout.gap ?? 0.6;
    const selectedPrefix = itemsLayout['selected-prefix'] ?? '> ';
    const selectedSuffix = itemsLayout['selected-suffix'] ?? ' <';
    const defaultPrefix = itemsLayout['default-prefix'] ?? '';
    const defaultSuffix = itemsLayout['default-suffix'] ?? '';

    const settingsLabel = this.textResolver.text(this.titleKey);
    renderer.drawText(settingsLabel, renderer.viewportWidth / 2, titleLayout['offset-y'] ?? 1.5,
      `${this.titleFontSize + (titleLayout['font-size-offset'] ?? 0.1)}px ${this.fontFamily}`,
      this.titleColor, 'center');

    const btn = this.#buttonConfig;
    const selectedColor = btn['selected-text-color'];
    const defaultColor = btn['text-color'];

    for (let i = 0; i < this.#sliders.length; i++) {
      this.#renderSlider(renderer, this.#sliders[i], i, firstRowY + i * rowGap, selectedColor, defaultColor,
        selectedPrefix, selectedSuffix, defaultPrefix, defaultSuffix);
    }

    const buttonsY = firstRowY + this.#sliders.length * rowGap;
    const visibleButtons = this.#visibleButtons();
    this.#syncSelectedRow();
    for (let i = 0; i < visibleButtons.length; i++) {
      const item = visibleButtons[i];
      const label = this.textResolver.text(item.label);
      const isSelected = this.#selectedRow === this.#sliders.length + i;
      renderer.drawText(
        isSelected
          ? `${selectedPrefix}${label}${selectedSuffix}`
          : `${defaultPrefix}${label}${defaultSuffix}`,
        renderer.viewportWidth / 2,
        buttonsY + i * buttonGap,
        `${btn['font-size']}px ${this.fontFamily}`,
        isSelected ? selectedColor : defaultColor,
        'center'
      );
    }

    this.renderHint(renderer);
  }

  #renderSlider(renderer, slider, index, y, selectedColor, defaultColor,
    selectedPrefix, selectedSuffix, defaultPrefix, defaultSuffix) {
    const isSelected = this.#selectedRow === index;
    const label = this.textResolver.text(slider['label-key']);
    const value = this.#readSetting(slider['setting-key']);
    const min = slider.min ?? 0;
    const max = slider.max ?? 1;
    const ratio = max > min ? (value - min) / (max - min) : 0;

    renderer.drawText(
      isSelected
        ? `${selectedPrefix}${label}${selectedSuffix}`
        : `${defaultPrefix}${label}${defaultSuffix}`,
      renderer.viewportWidth / 2,
      y,
      `${this.#buttonConfig['font-size']}px ${this.fontFamily}`,
      isSelected ? selectedColor : defaultColor,
      'center'
    );

    const trackSize = slider['track-size'] ?? { width: 4.0, height: 0.3 };
    const trackX = renderer.viewportWidth / 2 - trackSize.width / 2;
    const trackY = y + 0.3;

    renderer.drawRect(trackX, trackY, trackSize.width, trackSize.height, slider['corner-radius'] ?? 0.1,
      slider['track-color'], null, 0);
    renderer.drawRect(trackX, trackY, trackSize.width * ratio, trackSize.height, slider['corner-radius'] ?? 0.1,
      slider['fill-color'], null, 0);
    renderer.drawCircle(trackX + trackSize.width * ratio, trackY + trackSize.height / 2,
      slider['thumb-radius'] ?? 0.2, slider['thumb-color'], null, 0);

    const percent = `${Math.round(ratio * 100)}%`;
    renderer.drawText(percent, trackX + trackSize.width + 0.4, trackY + trackSize.height,
      `${this.#buttonConfig['font-size']}px ${this.fontFamily}`, defaultColor, 'left');
  }
}

class GameOverScreen extends Menu {
  #healthSystem;

  constructor(menuConfig, textResolver, healthSystem) {
    super(menuConfig, textResolver, {
      'has-continues': () => this.canContinue
    });
    this.#healthSystem = healthSystem;
  }

  get continues() {
    return this.#healthSystem ? this.#healthSystem.continues : 0;
  }

  get lives() {
    return this.#healthSystem ? this.#healthSystem.lives : 0;
  }

  get canContinue() {
    if (!this.#healthSystem) {
      return false;
    }
    if (typeof this.#healthSystem.canContinue === 'boolean') {
      return this.#healthSystem.canContinue;
    }
    return this.#healthSystem.continues > 0;
  }

  render(renderer) {
    this.renderOverlay(renderer);

    const layout = this.layout;
    const titleLayout = layout.title ?? {};
    const rows = layout.rows ?? {};
    const rowFontSize = rows['font-size'] ?? 0.45;

    const titleKey = this.titleKey;
    const gameOverLabel = this.textResolver.text(titleKey);
    renderer.drawText(gameOverLabel, renderer.viewportWidth / 2, titleLayout['offset-y'] ?? 2.5,
      `${this.titleFontSize + (titleLayout['font-size-offset'] ?? 0.2)}px ${this.fontFamily}`,
      this.titleColor, 'center');

    const continuesPrefix = this.textResolver.text('menu.game-over.continues-prefix');
    const continuesText = `${continuesPrefix}${this.continues}`;
    renderer.drawText(continuesText, renderer.viewportWidth / 2,
      rows.continues?.['offset-y'] ?? 4.5, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');

    const livesPrefix = this.textResolver.text('hud.lives-prefix');
    const livesText = `${livesPrefix}${this.lives}`;
    renderer.drawText(livesText, renderer.viewportWidth / 2,
      rows.lives?.['offset-y'] ?? 5.3, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');

    if (this.continues > 0) {
      const hint = this.textResolver.text('menu.game-over.continue-hint');
      renderer.drawText(hint, renderer.viewportWidth / 2,
        rows['continue-hint']?.['offset-y'] ?? 6.0, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');
    }

    this.renderItems(renderer, layout.items?.['start-y'] ?? 7.2);
  }
}

class StageClearScreen extends Menu {
  #stageName;
  #stageNameKey;
  #fruitProvider;
  #abilityProvider;
  #scoreProvider;

  constructor(menuConfig, textResolver, providers = {}) {
    super(menuConfig, textResolver);
    this.#stageName = providers.stageName ?? '';
    this.#stageNameKey = providers.stageNameKey ?? null;
    this.#fruitProvider = providers.fruit ?? (() => null);
    this.#abilityProvider = providers.abilities ?? (() => []);
    this.#scoreProvider = providers.score ?? (() => 0);
  }

  #stageDisplayName() {
    return this.#stageNameKey ? this.textResolver.text(this.#stageNameKey) : this.#stageName;
  }

  #fruitLabel() {
    const fruit = this.#fruitProvider();
    return fruit ? this.textResolver.text(`fruits.${fruit}`) : '';
  }

  #abilityLabel() {
    const abilities = this.#abilityProvider() ?? [];
    return abilities
      .filter((ability) => typeof ability === 'string' && ability.length > 0)
      .map((ability) => this.textResolver.text(`player.abilities.${ability}`))
      .join(', ');
  }

  render(renderer) {
    this.renderOverlay(renderer);

    const layout = this.layout;
    const titleLayout = layout.title ?? {};
    const rows = layout.rows ?? {};
    const rowFontSize = rows['font-size'] ?? 0.4;
    const stageNameRow = rows['stage-name'] ?? {};

    const titleKey = this.titleKey;
    const clearLabel = this.textResolver.text(titleKey);
    renderer.drawText(clearLabel, renderer.viewportWidth / 2, titleLayout['offset-y'] ?? 2.0,
      `${this.titleFontSize + (titleLayout['font-size-offset'] ?? 0.2)}px ${this.fontFamily}`,
      this.titleColor, 'center');

    renderer.drawText(this.#stageDisplayName(), renderer.viewportWidth / 2,
      stageNameRow['offset-y'] ?? 3.5, `${stageNameRow['font-size'] ?? 0.5}px ${this.fontFamily}`,
      this.titleColor, 'center');

    const fruitLabel = this.#fruitLabel();
    if (fruitLabel) {
      const collectedPrefix = this.textResolver.text('menu.stage-clear.collected-prefix');
      renderer.drawText(`${collectedPrefix}${fruitLabel}`, renderer.viewportWidth / 2,
        rows.fruit?.['offset-y'] ?? 4.5, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');
    }

    const abilityLabel = this.#abilityLabel();
    if (abilityLabel) {
      const abilityPrefix = this.textResolver.text('menu.stage-clear.ability-prefix');
      renderer.drawText(`${abilityPrefix}${abilityLabel}`, renderer.viewportWidth / 2,
        rows.ability?.['offset-y'] ?? 5.5, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');
    }

    const scorePrefix = this.textResolver.text('menu.stage-clear.score-prefix');
    const score = this.#scoreProvider() ?? 0;
    renderer.drawText(`${scorePrefix}${score}`, renderer.viewportWidth / 2,
      rows.score?.['offset-y'] ?? 6.5, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');

    const hint = this.textResolver.text('menu.stage-clear.continue-hint');
    renderer.drawText(hint, renderer.viewportWidth / 2,
      rows['continue-hint']?.['offset-y'] ?? 8.0, `${rowFontSize}px ${this.fontFamily}`, this.titleColor, 'center');

    this.renderItems(renderer, layout.items?.['start-y'] ?? 8.8);
  }
}

class InfoScreen extends UIElement {
  #textResolver;
  #titleKey;
  #titleColor;
  #titleFontSize;
  #fontFamily;
  #lineKeys;
  #lineConfig;
  #hintKey;
  #hintConfig;
  #startOffset;
  #onClose;

  constructor(infoConfig, textResolver) {
    super({ x: 0, y: 0, width: 40, height: 30 });
    this.#textResolver = textResolver;
    this.#titleKey = infoConfig['title-key'];
    this.#titleColor = infoConfig['title-color'];
    this.#titleFontSize = infoConfig['title-font-size'];
    this.#fontFamily = infoConfig['font-family'];
    this.#lineKeys = infoConfig.lines ?? [];
    this.#lineConfig = infoConfig.line;
    this.#hintKey = infoConfig['hint-key'];
    this.#hintConfig = infoConfig.hint;
    this.#startOffset = infoConfig['start-offset'] ?? { x: 0, y: 2.8 };
    this.#onClose = null;
  }

  get onClose() { return this.#onClose; }
  set onClose(fn) { this.#onClose = fn; }

  update(dt, inputManager) {
    super.update(dt);

    if (!inputManager) {
      return;
    }

    if (inputManager.isPressed('confirm')) {
      if (this.#onClose) {
        this.#onClose();
      }
    } else if (inputManager.isPressed('back')) {
      if (this.#onClose) {
        this.#onClose();
      }
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, '#000000', null, 0);

    const title = this.#textResolver.text(this.#titleKey);
    renderer.drawText(title, renderer.viewportWidth / 2, this.#startOffset.y,
      `${this.#titleFontSize}px ${this.#fontFamily}`, this.#titleColor, 'center');

    const fontSize = this.#lineConfig['font-size'] ?? 0.3;
    const lineColor = this.#lineConfig.color;
    const lineGap = this.#lineConfig.gap ?? 0.55;
    const lineStartY = this.#startOffset.y + 1.4;

    for (let i = 0; i < this.#lineKeys.length; i++) {
      const line = this.#textResolver.text(this.#lineKeys[i]);
      renderer.drawText(line, renderer.viewportWidth / 2, lineStartY + i * lineGap,
        `${fontSize}px ${this.#fontFamily}`, lineColor, 'center');
    }

    if (this.#hintKey && this.#hintConfig) {
      const hint = this.#textResolver.text(this.#hintKey);
      renderer.drawText(hint, renderer.viewportWidth / 2, renderer.viewportHeight - 0.5,
        `${this.#hintConfig['font-size']}px ${this.#fontFamily}`, this.#hintConfig.color, 'center');
    }
  }
}

class InventoryUI extends UIElement {
  #inventory;
  #textResolver;
  #selectedSlot;
  #cols;
  #rows;
  #fontFamily;
  #invUIConfig;

  constructor(inventoryConfig, inventory, textResolver) {
    super(inventoryConfig);
    this.#invUIConfig = inventoryConfig;
    this.#inventory = inventory;
    this.#textResolver = textResolver;
    this.#fontFamily = inventoryConfig.inventory['font-family'];
    this.#selectedSlot = 0;
    this.#cols = inventoryConfig.inventory.columns;
    this.#rows = inventoryConfig.inventory.rows;
  }

  get inventory() { return this.#inventory; }

  navigateLeft() {
    if (this.#selectedSlot % this.#cols > 0) {
      this.#selectedSlot--;
    }
  }

  navigateRight() {
    if (this.#selectedSlot % this.#cols < this.#cols - 1) {
      this.#selectedSlot++;
    }
  }

  navigateUp() {
    if (this.#selectedSlot >= this.#cols) {
      this.#selectedSlot -= this.#cols;
    }
  }

  navigateDown() {
    if (this.#selectedSlot + this.#cols < this.#cols * this.#rows) {
      this.#selectedSlot += this.#cols;
    }
  }

  useSelected() {
    const slots = this.#inventory.slots;
    if (this.#selectedSlot < slots.length) {
      const item = slots[this.#selectedSlot];
      this.#inventory.use(item.name);
    }
  }

  markSelectedAsDefault() {
    const slots = this.#inventory.slots;
    if (this.#selectedSlot < slots.length) {
      const item = slots[this.#selectedSlot];
      this.#inventory.defaultSelected = item.name;
    }
  }

  handleInput(inputManager) {
    if (inputManager.isPressed('left')) {
      this.navigateLeft();
    }
    if (inputManager.isPressed('right')) {
      this.navigateRight();
    }
    if (inputManager.isPressed('up')) {
      this.navigateUp();
    }
    if (inputManager.isPressed('down')) {
      this.navigateDown();
    }
    if (inputManager.isPressed('confirm')) {
      this.useSelected();
    }
    if (inputManager.isPressed('shoot')) {
      this.markSelectedAsDefault();
    }
  }

  render(renderer) {
    if (!this.#inventory.isOpen) {
      return;
    }

    const invCfg = this.#invUIConfig.inventory;
    const overlayCfg = invCfg.overlay;
    const slotCfg = invCfg.slot;
    const itemCfg = invCfg.item;
    const titleCfg = invCfg.title;
    const footerCfg = invCfg.footer;

    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0,
      overlayCfg['background-color'], null, 0);

    const slots = this.#inventory.slots;
    const slotSize = slotCfg.size.width;
    const gap = slotCfg.gap;
    const gridOffset = slotCfg['grid-offset'];
    const startX = (renderer.viewportWidth - (slotSize * this.#cols + gap.x * (this.#cols - 1))) / 2 + gridOffset.x;
    const startY = (renderer.viewportHeight - (slotSize * this.#rows + gap.y * (this.#rows - 1))) / 2 + gridOffset.y;

    const title = this.#textResolver.text(titleCfg['label-key']);
    renderer.drawText(title, renderer.viewportWidth / 2, startY - 1,
      `${titleCfg['font-size']}px ${this.#fontFamily}`, titleCfg.color, 'center');

    const selectedBorderColor = slotCfg['selected-border-color'];
    const defaultBorderColor = slotCfg['border-color'];
    const slotFillColor = slotCfg['filled-fill-color'];
    const emptySlotLabel = this.#textResolver.text(invCfg['empty-slot']['label-key']);
    const emptyTextColor = invCfg['empty-slot']['text-color'];

    for (let row = 0; row < this.#rows; row++) {
      for (let col = 0; col < this.#cols; col++) {
        const idx = row * this.#cols + col;
        const sx = startX + col * (slotSize + gap.x);
        const sy = startY + row * (slotSize + gap.y);

        const isSelected = idx === this.#selectedSlot;
        const borderColor = isSelected ? selectedBorderColor : defaultBorderColor;

        renderer.drawRect(sx, sy, slotSize, slotSize, slotCfg['corner-radius'],
          slotFillColor, borderColor, 0.05);

        if (idx < slots.length) {
          const item = slots[idx];
          const nameColor = itemCfg['name-color'];
          const countColor = itemCfg['count-color'];
          const nameFontSize = itemCfg['name-font-size'];
          const countFontSize = itemCfg['count-font-size'];
          const nameOffset = itemCfg['name-offset'];
          const countOffset = itemCfg['count-offset'];

          renderer.drawText(`${item.name}`, sx + slotSize / 2 + nameOffset.x,
            sy + slotSize / 2 + nameOffset.y,
            `${nameFontSize}px ${this.#fontFamily}`, nameColor, 'center');
          renderer.drawText(`x${item.count}`, sx + slotSize + countOffset.x,
            sy + countOffset.y,
            `${countFontSize}px ${this.#fontFamily}`, countColor, 'right');
        } else {
          renderer.drawText(emptySlotLabel, sx + slotSize / 2, sy + slotSize / 2,
            `${invCfg['empty-slot']['font-size']}px ${this.#fontFamily}`,
            emptyTextColor, 'center');
        }
      }
    }

    const hints = footerCfg.hints;
    const footerAnchor = footerCfg.anchor;
    const footerOffset = footerCfg.offset;
    const footerGap = footerCfg.gap;
    const footerY = renderer.viewportHeight + footerOffset.y - (hints.length > 0 ? hints.length * 0.3 : 0);
    const hintColWidth = renderer.viewportWidth / Math.max(hints.length, 1);

    for (let i = 0; i < hints.length; i++) {
      const hint = hints[i];
      if (!hint) {
        continue;
      }
      const hintLabel = this.#textResolver.text(hint['label-key']);
      const hintColor = hint.color;
      const hintFontSize = hint['font-size'];
      renderer.drawText(hintLabel, hintColWidth * (i + 0.5), footerY,
        `${hintFontSize}px ${this.#fontFamily}`, hintColor, 'center');
    }
  }
}

export { HUD, Menu, TitleMenu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen, InfoScreen, InventoryUI };
