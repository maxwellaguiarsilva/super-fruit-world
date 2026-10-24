import { StageBase } from '../../engine/entities/stage-base.js';
import { clampLabelX } from './label-layout.js';

const NODE_LABEL_FONT = '0.4px \'Comic Sans MS\', \'Comic Sans\', monospace';

const DIRECTIONS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 }
};

const NAVIGATION_DIRECTIONS = ['left', 'right', 'up', 'down'];

class MapStage extends StageBase {
  #player;
  #stageNodes;
  #paths;
  #areaLabels;
  #teleporterMarkers;
  #activeNode;

  constructor(mapConfig, player, options = {}) {
    super(mapConfig);

    const hasStageData = options.hasStageData ?? (() => true);
    const resolveText = options.resolveText ?? ((key) => key);
    const preferredStageId = options.preferredStageId ?? null;

    this.#player = player;
    this.#stageNodes = [];
    this.#paths = [];
    this.#areaLabels = [];
    this.#teleporterMarkers = [];
    this.#activeNode = null;

    for (const section of mapConfig.sections ?? []) {
      for (const object of section.objects ?? []) {
        const localPos = object.position ?? { x: 0, y: 0 };
        const position = this.resolveWorldPosition(section.name, localPos);
        this.#registerObject(object, position, hasStageData, resolveText);
      }
    }

    const preferred = this.#nodeById(preferredStageId);
    const initialNode = preferred && this.#isSelectable(preferred)
      ? preferred
      : this.#stageNodes.find((node) => this.#isSelectable(node));
    this.#activeNode = initialNode?.id ?? this.#stageNodes[0]?.id ?? null;
  }

  #displayText(object, resolveText, fallback) {
    if (object.display) {
      return object.display;
    }
    const textKey = object['display-name-key'];
    return textKey ? resolveText(textKey) : fallback;
  }

  #isSelectable(node) {
    return node.state !== 'locked' && node['data-available'];
  }

  #registerObject(object, position, hasStageData, resolveText) {
    switch (object.type) {
      case 'stage-node': {
        const stageId = object['stage-id'];
        if (!stageId) {
          return;
        }
        this.#stageNodes.push({
          id: stageId,
          display: this.#displayText(object, resolveText, stageId),
          state: object.state ?? 'available',
          'unlock-condition': object['unlock-condition'] ?? null,
          'data-available': hasStageData(stageId),
          position
        });
        return;
      }
      case 'path':
        this.#paths.push({
          from: object.from,
          to: object.to,
          visual: object.visual ?? {},
          position
        });
        return;
      case 'area-label':
        this.#areaLabels.push({
          name: object.name,
          display: this.#displayText(object, resolveText, object.name ?? ''),
          position
        });
        return;
      case 'teleporter-marker':
        this.#teleporterMarkers.push({
          name: object.name,
          position
        });
        return;
      case 'map-teleporter':
        console.warn(
          `[map] Map teleporter "${object.name ?? 'unnamed'}" is ignored: teleporters belong to stages.`
        );
        return;
      default:
        return;
    }
  }

  get activeNode() { return this.#activeNode; }
  get activeNodePosition() { return this.#nodeById(this.#activeNode)?.position ?? null; }
  get stageNodes() { return [...this.#stageNodes]; }
  get paths() { return [...this.#paths]; }
  get areaLabels() { return [...this.#areaLabels]; }
  get teleporterMarkers() { return [...this.#teleporterMarkers]; }

  #nodeById(nodeId) {
    return this.#stageNodes.find((node) => node.id === nodeId);
  }

  #neighborInDirection(direction) {
    const axis = DIRECTIONS[direction];
    const origin = this.#nodeById(this.#activeNode);
    if (!axis || !origin) {
      return null;
    }

    const candidates = [];
    for (const node of this.#stageNodes) {
      if (node.id === origin.id) {
        continue;
      }

      const dx = node.position.x - origin.position.x;
      const dy = node.position.y - origin.position.y;
      const along = dx * axis.x + dy * axis.y;
      if (along <= 0) {
        continue;
      }

      const across = Math.abs(dx * axis.y - dy * axis.x);
      candidates.push({ node, distance: Math.hypot(dx, dy), across });
    }

    candidates.sort((a, b) =>
      a.distance - b.distance ||
      a.across - b.across ||
      a.node.id.localeCompare(b.node.id)
    );

    return candidates[0]?.node ?? null;
  }

  navigate(direction) {
    const next = this.#neighborInDirection(direction);
    if (!next) {
      return false;
    }

    this.navigateTo(next.id);
    return true;
  }

  navigateTo(nodeId) {
    const node = this.#nodeById(nodeId);
    if (node) {
      this.#activeNode = node.id;
      this.#player.x = node.position.x;
      this.#player.y = node.position.y;
    }
  }

  selectNode() {
    const node = this.#nodeById(this.#activeNode);
    if (!node) {
      return false;
    }

    return this.#isSelectable(node);
  }

  get unlockedStages() {
    return this.#stageNodes
      .filter((node) => this.#isSelectable(node))
      .map((node) => node.id);
  }

  isStageUnlocked(stageId) {
    const node = this.#nodeById(stageId);
    return node ? this.#isSelectable(node) : false;
  }

  update(dt, inputManager) {
    if (!inputManager) {
      return;
    }

    for (const direction of NAVIGATION_DIRECTIONS) {
      if (inputManager.isPressed(direction)) {
        this.navigate(direction);
      }
    }
  }

  render(renderer, camera = null) {
    const viewBounds = camera
      ? { minX: camera.x, maxX: camera.x + camera.width }
      : null;

    for (const path of this.#paths) {
      const fromNode = this.#nodeById(path.from);
      const toNode = this.#nodeById(path.to);

      if (fromNode && toNode) {
        const color = (fromNode.state === 'completed' && toNode.state === 'completed') ? '#40BF40' : '#808080';
        renderer.drawLine(fromNode.position.x, fromNode.position.y, toNode.position.x, toNode.position.y, color, 0.05);
      }
    }

    for (const label of this.#areaLabels) {
      renderer.drawText(label.display, label.position.x, label.position.y, '0.3px \'Comic Sans MS\', \'Comic Sans\', monospace', '#BFBFBF', 'center');
    }

    for (const node of this.#stageNodes) {
      const { x, y } = node.position;
      const isActive = node.id === this.#activeNode;
      const isSelectable = this.#isSelectable(node);

      const fillColor = node.state === 'completed' ? '#40BF40' :
                        node.state === 'locked' ? '#800000' :
                        !node['data-available'] ? '#404040' :
                        isActive ? '#BFBF40' : '#808080';

      renderer.drawCircle(x, y, isActive ? 0.8 : 0.5, fillColor, '#FFFFFF', 0.03);

      const labelWidth = viewBounds ? renderer.measureText(node.display, NODE_LABEL_FONT) : 0;
      const labelX = viewBounds ? clampLabelX(x, labelWidth, viewBounds) : x;

      renderer.drawText(node.display, labelX, y + 1.2, NODE_LABEL_FONT, isSelectable ? '#FFFFFF' : '#808080', 'center');
    }
  }
}

export { MapStage };
