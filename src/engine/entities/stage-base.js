import { Section } from './section.js';

function expandExtent(extent, box) {
  if (extent === null) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  const minX = Math.min(extent.x, box.x);
  const minY = Math.min(extent.y, box.y);
  const maxX = Math.max(extent.x + extent.width, box.x + box.width);
  const maxY = Math.max(extent.y + extent.height, box.y + box.height);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function entityExtent(entity) {
  return {
    x: entity.x,
    y: entity.y,
    width: entity.width || 1,
    height: entity.height || 1
  };
}

class StageBase {
  #name;
  #bgm;
  #entities;
  #sections;
  #sectionMap;
  #minX;
  #minY;
  #totalWidth;
  #totalHeight;

  constructor(stageData) {
    this.#name = stageData.name;
    this.#bgm = stageData.bgm ?? null;
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
    let extent = { x: 0, y: 0, width: 0, height: 0 };

    for (const section of this.#sections) {
      const worldPos = section.getWorldPosition(this.#sectionMap);
      extent = expandExtent(extent, {
        x: worldPos.x,
        y: worldPos.y,
        width: section.width,
        height: section.height
      });
    }

    for (const entity of this.#entities) {
      extent = expandExtent(extent, entityExtent(entity));
    }

    this.reconfigureBounds(extent.x, extent.y, extent.width, extent.height);
  }

  recomputeBounds() {
    this.#computeDimensions();
  }

  get name() { return this.#name; }
  get bgm() { return this.#bgm; }
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

  get entities() { return [...this.#entities]; }

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
