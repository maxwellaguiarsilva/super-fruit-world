function clampLabelX(centerX, textWidth, viewBounds) {
  const minX = viewBounds?.minX ?? 0;
  const maxX = viewBounds?.maxX ?? 0;
  const availableWidth = maxX - minX;
  const width = Number.isFinite(textWidth) ? Math.max(0, textWidth) : 0;

  if (!(availableWidth > 0)) {
    return centerX;
  }

  const halfWidth = width / 2;

  if (width > availableWidth) {
    return minX + halfWidth;
  }

  return Math.min(Math.max(centerX, minX + halfWidth), maxX - halfWidth);
}

export { clampLabelX };
