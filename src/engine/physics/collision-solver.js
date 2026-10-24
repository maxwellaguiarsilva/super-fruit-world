import { boxesOverlap } from './aabb.js';

const EPSILON = 0.0001;
const SLOPE_STEP_TOLERANCE = 0.5;
const SLOPE_STEP_MARGIN = 0.05;

class CollisionSolver {
  constructor() {
  }

  checkAABB(a, b) {
    return boxesOverlap(a, b);
  }

  getOverlap(a, b) {
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

    if (overlapX <= 0 || overlapY <= 0) {
      return null;
    }

    return {
      x: overlapX,
      y: overlapY
    };
  }

  resolveCollision(movable, solid, dt) {
    const pos = movable.position;
    const vel = movable.velocity;
    const hb = movable.hitbox;

    const solidBox = {
      x: solid.x,
      y: solid.y,
      width: solid.width,
      height: solid.height
    };

    const movableBox = {
      x: pos.x + hb.x,
      y: pos.y + hb.y,
      width: hb.width,
      height: hb.height
    };

    if (!this.checkAABB(movableBox, solidBox)) {
      return {
        position: { x: pos.x, y: pos.y },
        velocity: { x: vel.x, y: vel.y },
        collided: false,
        onGround: movable.onGround
      };
    }

    const frameDt = dt;
    const dx = vel.x * frameDt;
    const dy = vel.y * frameDt;

    const prevMovableBox = {
      x: movableBox.x - dx,
      y: movableBox.y - dy,
      width: movableBox.width,
      height: movableBox.height
    };

    const prevOverlapX = Math.min(prevMovableBox.x + prevMovableBox.width, solidBox.x + solidBox.width) - Math.max(prevMovableBox.x, solidBox.x);
    const prevOverlapY = Math.min(prevMovableBox.y + prevMovableBox.height, solidBox.y + solidBox.height) - Math.max(prevMovableBox.y, solidBox.y);

    const overlapLeft = (movableBox.x + movableBox.width) - solidBox.x;
    const overlapRight = (solidBox.x + solidBox.width) - movableBox.x;
    const overlapTop = (movableBox.y + movableBox.height) - solidBox.y;
    const overlapBottom = (solidBox.y + solidBox.height) - movableBox.y;

    const eps = 0.0001;
    let side = null;

    if (prevOverlapX > eps && prevOverlapY <= eps) {
      if (vel.y >= 0) {
        side = 'top';
      } else {
        side = 'bottom';
      }
    } else if (prevOverlapY > eps && prevOverlapX <= eps) {
      if (vel.x >= 0) {
        side = 'left';
      } else {
        side = 'right';
      }
    } else {
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapTop && vel.y >= 0) {
        side = 'top';
      } else if (minOverlap === overlapBottom && vel.y <= 0) {
        side = 'bottom';
      } else if (minOverlap === overlapLeft && vel.x >= 0) {
        side = 'left';
      } else if (minOverlap === overlapRight && vel.x <= 0) {
        side = 'right';
      } else {
        if (minOverlap === overlapTop) side = 'top';
        else if (minOverlap === overlapBottom) side = 'bottom';
        else if (minOverlap === overlapLeft) side = 'left';
        else side = 'right';
      }
    }

    let newX = pos.x;
    let newY = pos.y;
    let newVelX = vel.x;
    let newVelY = vel.y;
    let onGround = false;

    if (side === 'top') {
      newY = solidBox.y - hb.height - hb.y;
      newVelY = 0;
      onGround = true;
    } else if (side === 'bottom') {
      newY = solidBox.y + solidBox.height - hb.y;
      newVelY = 0;
    } else if (side === 'left') {
      newX = solidBox.x - hb.width - hb.x;
      newVelX = 0;
    } else if (side === 'right') {
      newX = solidBox.x + solidBox.width - hb.x;
      newVelX = 0;
    }

    return {
      position: { x: newX, y: newY },
      velocity: { x: newVelX, y: newVelY },
      collided: true,
      onGround: onGround || movable.onGround
    };
  }

  resolveSlopeCollision(movable, slope, dt) {
    const surface = slope.slopeSurface;
    const pos = movable.position;
    const vel = movable.velocity;
    const hb = movable.hitbox;
    const frameDt = Number.isFinite(dt) ? dt : 0;

    const unchanged = {
      position: { x: pos.x, y: pos.y },
      velocity: { x: vel.x, y: vel.y },
      collided: false,
      onGround: movable.onGround
    };

    if (!surface) {
      return unchanged;
    }

    const tileBox = {
      x: slope.x,
      y: slope.y,
      width: slope.width,
      height: slope.height
    };
    const box = {
      x: pos.x + hb.x,
      y: pos.y + hb.y,
      width: hb.width,
      height: hb.height
    };
    const prevBox = {
      x: box.x - vel.x * frameDt,
      y: box.y - vel.y * frameDt,
      width: hb.width,
      height: hb.height
    };

    const overlapsX = (candidate) => (
      candidate.x < tileBox.x + tileBox.width &&
      candidate.x + candidate.width > tileBox.x
    );
    const overlapsY = (candidate) => (
      candidate.y < tileBox.y + tileBox.height &&
      candidate.y + candidate.height > tileBox.y
    );

    if (!overlapsX(box) && !overlapsX(prevBox)) {
      return unchanged;
    }

    const supportX = (candidate) => {
      const left = Math.max(candidate.x, tileBox.x);
      const right = Math.min(candidate.x + candidate.width, tileBox.x + tileBox.width);

      if (left < right) {
        return surface.inverted ? left : right;
      }

      return candidate.x + candidate.width <= tileBox.x
        ? tileBox.x
        : tileBox.x + tileBox.width;
    };

    const boxBottom = box.y + box.height;
    const prevBottom = prevBox.y + prevBox.height;
    const tileBottom = tileBox.y + tileBox.height;

    // The solid wedge fills to the tile bottom, so its underside is the flat bottom face.
    if (vel.y < 0 && prevBox.y >= tileBottom - EPSILON && box.y < tileBottom) {
      return {
        position: { x: pos.x, y: tileBottom - hb.y },
        velocity: { x: vel.x, y: 0 },
        collided: true,
        onGround: movable.onGround
      };
    }

    const floorX = supportX(box);
    const floorY = tileBox.y + surface.surfaceY(floorX - tileBox.x);
    const prevFloorX = supportX(prevBox);
    const prevFloorY = tileBox.y + surface.surfaceY(prevFloorX - tileBox.x);
    const penetration = boxBottom - floorY;
    const wasAbove = prevBottom <= prevFloorY + EPSILON;
    const stepTolerance = Math.max(
      SLOPE_STEP_TOLERANCE,
      surface.rise * (hb.width / surface.width) + SLOPE_STEP_MARGIN
    );

    if (penetration <= EPSILON) {
      const gap = -penetration;

      if (movable.onGround && vel.y >= 0 && gap <= stepTolerance) {
        return {
          position: { x: pos.x, y: floorY - hb.height - hb.y },
          velocity: { x: vel.x, y: 0 },
          collided: true,
          onGround: true
        };
      }

      return unchanged;
    }

    if (wasAbove || (overlapsY(box) && penetration <= stepTolerance)) {
      return {
        position: { x: pos.x, y: floorY - hb.height - hb.y },
        velocity: { x: vel.x, y: 0 },
        collided: true,
        onGround: true
      };
    }

    if (!overlapsY(box) && !overlapsY(prevBox)) {
      return unchanged;
    }

    const faceX = surface.inverted
      ? tileBox.x - hb.width - hb.x
      : tileBox.x + tileBox.width - hb.x;

    return {
      position: { x: faceX, y: pos.y },
      velocity: { x: 0, y: vel.y },
      collided: true,
      onGround: movable.onGround
    };
  }

  getNormal(movable, solid) {
    const midX = movable.position.x;
    const midY = movable.position.y;

    const solidBox = {
      x: solid.x,
      y: solid.y,
      width: solid.width,
      height: solid.height
    };

    const dx = midX - (solidBox.x + solidBox.width / 2);
    const dy = midY - (solidBox.y + solidBox.height / 2);
    const halfW = solidBox.width / 2;
    const halfH = solidBox.height / 2;

    const penetrationX = halfW - Math.abs(dx);
    const penetrationY = halfH - Math.abs(dy);

    if (penetrationX < penetrationY) {
      return { x: dx > 0 ? 1 : -1, y: 0 };
    }

    return { x: 0, y: dy > 0 ? 1 : -1 };
  }
}

export { CollisionSolver };
