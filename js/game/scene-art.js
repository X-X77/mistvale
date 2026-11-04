// Paint at the same pixel scale as the tools. Rebuild only when the layout or
// terrain changes. The procedural scenery also serves as the loading fallback.
export function scenePainter(name, terrainOpacity = 0) {
  const art = new Image();
  art.src = new URL(`../../assets/minigames/${name}.webp`, import.meta.url).href;
  let previous, surface;
  return (ctx, terrain, horizon) => {
    if (!art.naturalWidth) {
      ctx.drawImage(terrain, 0, 0);
      return;
    }
    if (terrain !== previous) {
      const { width, height } = terrain;
      surface = document.createElement('canvas');
      surface.width = width;
      surface.height = height;
      const paint = surface.getContext('2d');
      const sw = art.naturalWidth, sh = art.naturalHeight;
      // Keep the landing pier and worktop aligned with the interactive tools.
      // Crop horizontally in portrait, vertically at the horizon in landscape.
      const scale = Math.max(width / sw, height / sh);
      const split = name === 'pond' ? .75 : .5;
      const left = Math.round((width - sw * scale) / 2);
      const top = Math.round(Math.max(height - sh * scale, Math.min(0, (horizon ?? height / 2) - sh * scale * split)));
      paint.drawImage(art, left, top, Math.ceil(sw * scale), Math.ceil(sh * scale));
      if (terrainOpacity) {
        paint.globalAlpha = terrainOpacity;
        paint.drawImage(terrain, 0, 0);
      }
      previous = terrain;
    }
    ctx.drawImage(surface, 0, 0);
  };
}
