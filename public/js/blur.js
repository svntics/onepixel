// Blur proporcional al ancho mostrado: misma dificultad en celular y computador.
//   px reales = nivel × anchoMostrado / anchoReferencia

export function blurPx(level, displayWidth, referenceWidth = 400) {
  return (level * displayWidth) / referenceWidth;
}

// Ampliación para que el borde difuminado (halo) quede fuera del marco.
export function edgeScale(px, displayWidth) {
  return displayWidth > 0 ? 1 + (4 * px) / displayWidth : 1;
}

// Aplica el blur a <img> y lo recalcula si cambia el tamaño (girar el celular, etc.)
export function attachBlur(img, referenceWidth) {
  let level = 0;
  const apply = () => {
    const w = img.offsetWidth; // ancho de diseño (sin el zoom del transform)
    const px = blurPx(level, w, referenceWidth);
    img.style.filter = px > 0 ? `blur(${px.toFixed(2)}px)` : "none";
    img.style.transform = `scale(${edgeScale(px, w).toFixed(3)})`;
  };
  new ResizeObserver(apply).observe(img);
  return {
    set(newLevel) {
      level = newLevel;
      apply();
    },
  };
}
