import { StageBase } from '../../engine/entities/stage-base.js';

class MapStage extends StageBase {
  #player;
  #stageNodes;
  #paths;
  #activeNode;

  constructor(mapConfig, player) {
    super(mapConfig);

    this.#player = player;
    this.#stageNodes = mapConfig['stage-nodes'] ?? [];
    this.#paths = mapConfig.paths ?? [];
    this.#activeNode = null;
  }

  get activeNode() { return this.#activeNode; }
  get stageNodes() { return [...this.#stageNodes]; }
  get paths() { return [...this.#paths]; }

  navigateTo(nodeName) {
    const node = this.#stageNodes.find((n) => n.name === nodeName);
    if (node) {
      this.#activeNode = nodeName;

      const pos = node.position ?? { x: 0, y: 0 };
      this.#player.x = pos.x;
      this.#player.y = pos.y;
    }
  }

  selectNode() {
    if (!this.#activeNode) {
      return false;
    }

    const node = this.#stageNodes.find((n) => n.name === this.#activeNode);
    if (!node) {
      return false;
    }

    if (node.state === 'locked') {
      return false;
    }

    return true;
  }

  get unlockedStages() {
    return this.#stageNodes
      .filter((n) => n.state === 'available' || n.state === 'completed')
      .map((n) => n.name);
  }

  isStageUnlocked(stageName) {
    const node = this.#stageNodes.find((n) => n.name === stageName);
    return node ? node.state !== 'locked' : false;
  }

  update(dt, inputManager) {
    if (inputManager) {
      if (inputManager.isPressed('left') || inputManager.isPressed('up')) {
        const idx = this.#stageNodes.findIndex((n) => n.name === this.#activeNode);
        const prevIdx = (idx - 1 + this.#stageNodes.length) % this.#stageNodes.length;
        this.navigateTo(this.#stageNodes[prevIdx].name);
      }

      if (inputManager.isPressed('right') || inputManager.isPressed('down')) {
        const idx = this.#stageNodes.findIndex((n) => n.name === this.#activeNode);
        const nextIdx = (idx + 1) % this.#stageNodes.length;
        this.navigateTo(this.#stageNodes[nextIdx].name);
      }
    }
  }

  render(renderer) {
    for (const path of this.#paths) {
      const fromNode = this.#stageNodes.find((n) => n.name === path.from);
      const toNode = this.#stageNodes.find((n) => n.name === path.to);

      if (fromNode && toNode) {
        const fx = fromNode.position?.x ?? 0;
        const fy = fromNode.position?.y ?? 0;
        const tx = toNode.position?.x ?? 0;
        const ty = toNode.position?.y ?? 0;

        const color = (fromNode.state === 'completed' && toNode.state === 'completed') ? '#40BF40' : '#808080';
        renderer.drawLine(fx, fy, tx, ty, color, 0.05);
      }
    }

    for (const node of this.#stageNodes) {
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;

      const isActive = node.name === this.#activeNode;
      const fillColor = node.state === 'completed' ? '#40BF40' :
                        node.state === 'locked' ? '#800000' :
                        isActive ? '#BFBF40' : '#808080';

      renderer.drawCircle(x, y, isActive ? 0.8 : 0.5, fillColor, '#FFFFFF', 0.03);

      if (node.display) {
        renderer.drawText(node.display, x, y + 1.2, '0.4px \'Comic Sans MS\', \'Comic Sans\', monospace', '#FFFFFF', 'center');
      }
    }
  }
}

export { MapStage };
