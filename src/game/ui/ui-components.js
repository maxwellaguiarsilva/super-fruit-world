import { UIElement } from '../../engine/ui/ui-element.js';

class HUD extends UIElement {
  #player;
  #noteCollection;
  #dataDriven;
  #hudConfig;

  constructor(hudConfig, player, noteCollection, dataDriven) {
    super({ x: 0, y: 0, width: 40, height: 30 });
    this.#hudConfig = hudConfig;
    this.#player = player;
    this.#noteCollection = noteCollection;
    this.#dataDriven = dataDriven;
  }

  get player() { return this.#player; }
  get noteCollection() { return this.#noteCollection; }

  update(dt) {
    super.update(dt);
  }

  render(renderer) {
    if (!this.#player) {
      return;
    }

    const cfg = this.#hudConfig;
    const elements = cfg.elements;
    const textCfg = cfg.hud.text;
    const fontFamily = textCfg['font-family'];
    const defaultLabelSize = textCfg['label-size'];
    const defaultValueSize = textCfg['value-size'];

    const lifeCfg = elements['life-bar'];
    if (lifeCfg.enabled !== false) {
      const lbOffset = lifeCfg.offset;
      const lbSize = lifeCfg.size;
      const lbX = lbOffset.x;
      const lbY = lbOffset.y;
      const lifeRatio = this.#player.healthSystem.life / this.#player.healthSystem.maxLife;

      renderer.drawRect(lbX, lbY, lbSize.width, lbSize.height, lifeCfg['corner-radius'],
        lifeCfg['empty-color'], '#000000', 0.02);
      renderer.drawRect(lbX, lbY, lbSize.width * lifeRatio, lbSize.height, lifeCfg['corner-radius'],
        lifeCfg['fill-color'], null, 0);

      const levelCfg = elements['level-indicator'];
      if (levelCfg.enabled !== false) {
        const lvOffset = levelCfg.offset;
        const lvPrefix = this.#dataDriven['i18n.default.hud.level-prefix'];
        const lvText = `${lvPrefix}${this.#player.level}`;
        renderer.drawText(lvText, lvOffset.x, lvOffset.y + defaultValueSize,
          `${defaultValueSize}px ${fontFamily}`, levelCfg['label-color'], 'left');
      }
    }

    const ammoCfg = elements['ammo-counter'];
    if (ammoCfg.enabled !== false) {
      const amOffset = ammoCfg.offset;
      const amPrefix = this.#dataDriven['i18n.default.hud.ammo-prefix'];
      const ammoType = 'ammo';
      const amText = `${amPrefix}${this.#player.inventory.count(ammoType)}`;
      renderer.drawText(amText, amOffset.x, amOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, ammoCfg['icon-color'], 'left');
    }

    const coinCfg = elements['coin-counter'];
    if (coinCfg.enabled !== false) {
      const coOffset = coinCfg.offset;
      const coSize = coinCfg['icon-size'];
      const coPrefix = this.#dataDriven['i18n.default.hud.coins-prefix'];
      const coins = this.#player.scoreSystem ? this.#player.scoreSystem.coins : 0;
      const coinR = coSize.width / 2;
      renderer.drawCircle(coOffset.x, coOffset.y + coinR, coinR,
        coinCfg['icon-color'], '#000000', 0.02);
      renderer.drawText(`${coPrefix}${coins}`, coOffset.x + coSize.width + 0.2, coOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, coinCfg['label-color'], 'left');
    }

    const scoreCfg = elements['score-counter'];
    if (scoreCfg.enabled !== false) {
      const scOffset = scoreCfg.offset;
      const scPrefix = this.#dataDriven['i18n.default.hud.score-prefix'];
      const score = this.#player.scoreSystem ? this.#player.scoreSystem.score : 0;
      renderer.drawText(`${scPrefix}${score}`, renderer.viewportWidth - scOffset.x, scOffset.y + defaultValueSize,
        `${defaultValueSize}px ${fontFamily}`, scoreCfg['label-color'], 'right');
    }

    if (this.#noteCollection) {
      const ntCfg = elements['note-tracker'];
      if (ntCfg.enabled !== false) {
        const ntOffset = ntCfg.offset;
        const noteInfo = `${this.#noteCollection.collectedCount}/${this.#noteCollection.totalNotes}`;
        const ntPrefix = this.#dataDriven['i18n.default.hud.notes-prefix'];
        const ntX = renderer.viewportWidth + ntOffset.x;
        renderer.drawText(`${ntPrefix}${noteInfo}`, ntX, ntOffset.y + defaultValueSize,
          `${defaultValueSize}px ${fontFamily}`, ntCfg['filled-color'], 'left');

        const slotSize = ntCfg['slot-size'];
        const slotGap = ntCfg['slot-gap'];
        const noteY = ntOffset.y + slotSize.height + 0.15;
        for (let i = 0; i < this.#noteCollection.totalNotes; i++) {
          const isCollected = this.#noteCollection.isCollected(i + 1);
          const noteColor = isCollected
            ? ntCfg['filled-color']
            : ntCfg['empty-color'];
          renderer.drawCircle(ntX + i * (slotSize.width + slotGap), noteY, slotSize.width / 2,
            noteColor, '#000000', 0.01);
        }
      }
    }
  }
}

class Menu extends UIElement {
  #selectedIndex;
  #dataDriven;
  #items;
  #titleKey;
  #titleColor;
  #titleFontSize;
  #fontFamily;
  #startOffset;
  #onClose;
  #buttonConfig;

  constructor(menuConfig, dataDriven) {
    super(menuConfig);
    this.#dataDriven = dataDriven;
    this.#selectedIndex = 0;
    this.#items = menuConfig.items;
    this.#titleKey = menuConfig['title-key'];
    this.#titleColor = menuConfig['title-color'];
    this.#titleFontSize = menuConfig['title-font-size'];
    this.#fontFamily = menuConfig['font-family'];
    this.#startOffset = menuConfig['start-offset'];
    this.#buttonConfig = menuConfig.button;
    this.#onClose = null;
  }

  get selectedIndex() { return this.#selectedIndex; }

  navigateUp() {
    this.#selectedIndex = (this.#selectedIndex - 1 + this.#items.length) % this.#items.length;
  }

  navigateDown() {
    this.#selectedIndex = (this.#selectedIndex + 1) % this.#items.length;
  }

  confirm() {
  }

  back() {
    if (this.#onClose) {
      this.#onClose();
    }
  }

  get onClose() { return this.#onClose; }
  set onClose(fn) { this.#onClose = fn; }

  get items() { return [...this.#items]; }
  get dataDriven() { return this.#dataDriven; }
  get titleKey() { return this.#titleKey; }
  get titleColor() { return this.#titleColor; }
  get titleFontSize() { return this.#titleFontSize; }
  get fontFamily() { return this.#fontFamily; }
  get startOffset() { return this.#startOffset; }

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

    const btn = this.#buttonConfig;
    const gap = btn['gap'];
    const fontSize = btn['font-size'];
    const selectedColor = btn['selected-text-color'];
    const defaultColor = btn['text-color'];
    const itemHeight = btn['size'].height;

    const startY = (this.#startOffset && this.#startOffset.y > 0)
      ? this.#startOffset.y
      : (renderer.viewportHeight / 2 - this.#items.length * (itemHeight + gap) / 2);

    for (let i = 0; i < this.#items.length; i++) {
      const item = this.#items[i];
      const label = this.#dataDriven['i18n.default.' + item.label];
      const isSelected = i === this.#selectedIndex;
      const color = isSelected ? selectedColor : defaultColor;

      renderer.drawText(
        isSelected ? `> ${label} <` : label,
        renderer.viewportWidth / 2,
        startY + i * (itemHeight + gap),
        `${fontSize}px ${this.#fontFamily}`,
        color,
        'center'
      );
    }
  }
}

class TitleMenu extends Menu {
  constructor(menuConfig, dataDriven) {
    super(menuConfig, dataDriven);
  }

  confirm() {
    const item = this.items[this.selectedIndex];
    if (item && this.onConfirm) {
      this.onConfirm(item.action);
    }
  }
}

class PauseMenu extends Menu {
  #stage;

  constructor(menuConfig, dataDriven, stage) {
    super(menuConfig, dataDriven);
    this.#stage = stage;
  }

  confirm() {
    const item = this.items[this.selectedIndex];
    if (item && this.onConfirm) {
      this.onConfirm(item.action);
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, 'rgba(0,0,0,0.7)', null, 0);

    const titleKey = this.titleKey;
    const pauseLabel = this.dataDriven['i18n.default.' + titleKey];
    renderer.drawText(pauseLabel, renderer.viewportWidth / 2, 2.2, `${this.titleFontSize + 0.2}px ${this.fontFamily}`, this.titleColor, 'center');

    const gap = 0.15;
    const fontSize = 0.3;
    const startY = (this.startOffset && this.startOffset.y > 0) ? this.startOffset.y : 4.2;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const label = this.dataDriven['i18n.default.' + item.label];
      const isSelected = i === this.selectedIndex;
      const color = isSelected ? '#FFFF00' : '#888888';

      renderer.drawText(
        isSelected ? `> ${label}` : `  ${label}`,
        renderer.viewportWidth / 2,
        startY + i * (0.55 + gap),
        `${fontSize}px ${this.fontFamily}`,
        color,
        'center'
      );
    }
  }
}

class SettingsMenu extends Menu {
  #audioEngine;

  constructor(menuConfig, dataDriven, audioEngine) {
    super(menuConfig, dataDriven);
    this.#audioEngine = audioEngine;
  }

  get masterVolume() {
    return this.#audioEngine ? this.#audioEngine.masterVolume : 1;
  }

  set masterVolume(v) {
    if (this.#audioEngine) {
      this.#audioEngine.masterVolume = v;
    }
  }

  get bgmVolume() {
    return this.#audioEngine ? this.#audioEngine.bgmVolume : 1;
  }

  set bgmVolume(v) {
    if (this.#audioEngine) {
      this.#audioEngine.bgmVolume = v;
    }
  }

  get sfxVolume() {
    return this.#audioEngine ? this.#audioEngine.sfxVolume : 1;
  }

  set sfxVolume(v) {
    if (this.#audioEngine) {
      this.#audioEngine.sfxVolume = v;
    }
  }

  confirm() {
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, '#000000', null, 0);

    const settingsLabel = this.dataDriven['i18n.default.menu.settings.title'];
    renderer.drawText(settingsLabel, renderer.viewportWidth / 2, 2, `${this.titleFontSize + 0.1}px ${this.fontFamily}`, this.titleColor, 'center');
  }
}

class GameOverScreen extends Menu {
  #continuesAvailable;
  #livesRemaining;

  constructor(menuConfig, dataDriven, continuesAvailable, livesRemaining) {
    super(menuConfig, dataDriven);
    this.#continuesAvailable = continuesAvailable;
    this.#livesRemaining = livesRemaining;
  }

  confirm() {
    if (this.onConfirm) {
      this.onConfirm('continue');
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, '#000000', null, 0);

    const titleKey = this.titleKey;
    const gameOverLabel = this.dataDriven['i18n.default.' + titleKey];
    renderer.drawText(gameOverLabel, renderer.viewportWidth / 2, 2.5, `${this.titleFontSize + 0.2}px ${this.fontFamily}`, this.titleColor, 'center');

    const continuesPrefix = this.dataDriven['i18n.default.menu.game-over.continues-prefix'];
    const continuesText = `${continuesPrefix}${this.#continuesAvailable}`;
    renderer.drawText(continuesText, renderer.viewportWidth / 2, 4.5, `0.45px ${this.fontFamily}`, this.titleColor, 'center');

    if (this.#continuesAvailable > 0) {
      const hint = this.dataDriven['i18n.default.menu.game-over.continue-hint'];
      renderer.drawText(hint, renderer.viewportWidth / 2, 6.0, `0.45px ${this.fontFamily}`, this.titleColor, 'center');
    }
  }
}

class StageClearScreen extends Menu {
  #stageName;
  #collectibleCollected;
  #abilityGained;
  #score;

  constructor(menuConfig, dataDriven, stageName, collectibleCollected, abilityGained, score) {
    super(menuConfig, dataDriven);
    this.#stageName = stageName;
    this.#collectibleCollected = collectibleCollected;
    this.#abilityGained = abilityGained;
    this.#score = score;
  }

  confirm() {
    if (this.onConfirm) {
      this.onConfirm('next');
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, renderer.viewportWidth, renderer.viewportHeight, 0, '#000000', null, 0);

    const titleKey = this.titleKey;
    const clearLabel = this.dataDriven['i18n.default.' + titleKey];
    renderer.drawText(clearLabel, renderer.viewportWidth / 2, 2.0, `${this.titleFontSize + 0.2}px ${this.fontFamily}`, this.titleColor, 'center');

    renderer.drawText(this.#stageName, renderer.viewportWidth / 2, 3.5, `0.5px ${this.fontFamily}`, this.titleColor, 'center');

    if (this.#collectibleCollected) {
      const collectedPrefix = this.dataDriven['i18n.default.menu.stage-clear.collected-prefix'];
      renderer.drawText(`${collectedPrefix}${this.#collectibleCollected}`, renderer.viewportWidth / 2, 4.5, `0.4px ${this.fontFamily}`, this.titleColor, 'center');
    }

    if (this.#abilityGained) {
      const abilityPrefix = this.dataDriven['i18n.default.menu.stage-clear.ability-prefix'];
      renderer.drawText(`${abilityPrefix}${this.#abilityGained}`, renderer.viewportWidth / 2, 5.5, `0.4px ${this.fontFamily}`, this.titleColor, 'center');
    }

    if (this.#score > 0) {
      const scorePrefix = this.dataDriven['i18n.default.menu.stage-clear.score-prefix'];
      renderer.drawText(`${scorePrefix}${this.#score}`, renderer.viewportWidth / 2, 6.5, `0.4px ${this.fontFamily}`, this.titleColor, 'center');
    }

    const hint = this.dataDriven['i18n.default.menu.stage-clear.continue-hint'];
    renderer.drawText(hint, renderer.viewportWidth / 2, 8.0, `0.4px ${this.fontFamily}`, this.titleColor, 'center');
  }
}

class InventoryUI extends UIElement {
  #inventory;
  #dataDriven;
  #selectedSlot;
  #cols;
  #rows;
  #fontFamily;
  #invUIConfig;

  constructor(inventoryConfig, inventory, dataDriven) {
    super(inventoryConfig);
    this.#invUIConfig = inventoryConfig;
    this.#inventory = inventory;
    this.#dataDriven = dataDriven;
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

    const title = this.#dataDriven['i18n.default.' + titleCfg['label-key']];
    renderer.drawText(title, renderer.viewportWidth / 2, startY - 1,
      `${titleCfg['font-size']}px ${this.#fontFamily}`, titleCfg.color, 'center');

    const selectedBorderColor = slotCfg['selected-border-color'];
    const defaultBorderColor = slotCfg['border-color'];
    const slotFillColor = slotCfg['filled-fill-color'];
    const emptySlotLabel = this.#dataDriven['i18n.default.' + invCfg['empty-slot']['label-key']];
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
      const hintLabel = this.#dataDriven['i18n.default.' + hint['label-key']];
      const hintColor = hint.color;
      const hintFontSize = hint['font-size'];
      renderer.drawText(hintLabel, hintColWidth * (i + 0.5), footerY,
        `${hintFontSize}px ${this.#fontFamily}`, hintColor, 'center');
    }
  }
}

export { HUD, Menu, TitleMenu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen, InventoryUI };
