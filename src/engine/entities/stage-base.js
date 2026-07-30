import { Section } from './section.js';

class StageBase {
  #name;
  #entities;
  #sections;
  #sectionMap;
  #minX;
  #minY;
  #totalWidth;
  #totalHeight;

  constructor(stageData) {
    this.#name = stageData.name;
    this.#entities = [];
    this.#sections = [];
    this.#sectionMap = new Map();
    this.#minX = 0;
    this.#minY = 0;
    this.#totalWidth = 0;
    this.#totalHeight = 0;

    if (stageData.sections) {
      this.#buildSections(stageData.sections);
    }
  }

  #buildSections(sectionDataList) {
    for (const secData of sectionDataList) {
      const section = new Section(
        secData.name,
        secData.position.x,
        secData.position.y,
        secData['size']?.width ?? 0,
        secData['size']?.height ?? 0,
        secData['parent-section']
      );
      this.#sectionMap.set(section.name, section);
      this.#sections.push(section);
    }

    for (const secData of sectionDataList) {
      const section = this.#sectionMap.get(secData.name);
      const parentName = secData['parent-section'];
      if (parentName !== 'root' && this.#sectionMap.has(parentName)) {
        const parent = this.#sectionMap.get(parentName);
        parent.addChild(section);
      }
    }

    this.#computeDimensions();
  }

  #computeDimensions() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const section of this.#sections) {
      const worldPos = section.getWorldPosition(this.#sectionMap);
      const right = worldPos.x + section.width;
      const bottom = worldPos.y + section.height;

      if (worldPos.x < minX) minX = worldPos.x;
      if (worldPos.y < minY) minY = worldPos.y;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    if (this.#sections.length === 0) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }

    this.#minX = minX;
    this.#minY = minY;
    this.#totalWidth = maxX - minX;
    this.#totalHeight = maxY - minY;
  }

  get name() { return this.#name; }
  get minX() { return this.#minX; }
  get minY() { return this.#minY; }
  get width() { return this.#totalWidth; }
  get height() { return this.#totalHeight; }

  reconfigureBounds(a, b, c, d) {
    if (c === undefined) {
      this.#minX = 0;
      this.#minY = 0;
      this.#totalWidth = a;
      this.#totalHeight = b;
    } else {
      this.#minX = a;
      this.#minY = b;
      this.#totalWidth = c;
      this.#totalHeight = d;
    }
  }

  get bounds() {
    return {
      x: this.#minX,
      y: this.#minY,
      width: this.#totalWidth,
      height: this.#totalHeight
    };
  }

  get entities() { return this.#entities; }

  addEntity(entity) {
    this.#entities.push(entity);
  }

  removeEntity(entity) {
    const idx = this.#entities.indexOf(entity);
    if (idx !== -1) {
      this.#entities.splice(idx, 1);
    }
  }

  entitiesByType(type) {
    return this.#entities.filter((e) => {
      return e.type === type || e.tileType === type || e.constructor?.name === type;
    });
  }

  resolveWorldPosition(sectionName, localPos) {
    const section = this.#sectionMap.get(sectionName);
    if (!section) {
      return { x: localPos.x, y: localPos.y };
    }

    const worldPos = section.getWorldPosition(this.#sectionMap);
    return {
      x: worldPos.x + localPos.x,
      y: worldPos.y + localPos.y
    };
  }

  getSection(name) {
    return this.#sectionMap.get(name);
  }

  get sections() { return this.#sections; }

  get sectionMap() { return this.#sectionMap; }

  update(dt, inputManager) {
  }

  render(renderer) {
  }

  activate() {
  }

  deactivate() {
  }
}

export { StageBase };
