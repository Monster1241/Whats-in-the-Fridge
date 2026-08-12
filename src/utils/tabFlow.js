export function getStepDirection(order, prevId, nextId) {
  const prev = order.indexOf(prevId);
  const next = order.indexOf(nextId);
  if (prev < 0 || next < 0 || prev === next) return 0;
  return next > prev ? 1 : -1;
}

export function flowEnterClass(direction, base = 'animate-flow') {
  if (direction > 0) return `${base}-forward`;
  if (direction < 0) return `${base}-back`;
  return `${base}-neutral`;
}
