/** Points belong to physical contacts, never to the end-of-game callback. */
export type Impact = { frame: number; target: number; x: number; y: number };
export type Award = Impact & { points: number; total: number };
export function impactAwards(impacts: Impact[], score: number): Award[] {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Invalid score');
  // Debounce resting contacts on the same obstacle (120Hz simulation).
  const last = new Map<number, number>();
  const contacts = impacts.filter(hit => {
    if (hit.frame - (last.get(hit.target) ?? -Infinity) < 22) return false;
    last.set(hit.target, hit.frame);
    return true;
  });
  if (!contacts.length && score > 0) throw new Error('Scoring requires a physical impact');
  let total = 0;
  return contacts.map((hit, index) => {
    const next = Math.floor(score * (index + 1) / contacts.length);
    const points = next - total;
    total = next;
    return { ...hit, points, total };
  });
}

export function scoreReadout() {
  return '<div class="impact-hud"><span>SCORE DE LA PARTIE</span><strong data-live-score>0%</strong><small data-impact-caption>Cibles allumées : points · grises : neutres</small></div>';
}

export function showImpact(svg: SVGSVGElement, award: Award) {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', String(award.x));
  text.setAttribute('y', String(award.y - 18));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('class', 'impact-points');
  text.textContent = award.points ? `+${award.points}%` : 'NEUTRE';
  text.addEventListener('animationend', () => text.remove(), { once: true });
  svg.append(text);
}
