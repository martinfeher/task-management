type DisperseRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CalendarTaskCloseDisperseOptions = {
  source: DisperseRect;
  target: DisperseRect;
  sourceColor: string;
  targetColor: string;
  /** Duration of the main shrink animation; particles trail slightly behind it. */
  shrinkDurationMs: number;
};

const PARTICLE_COUNT = 26;
const PARTICLE_Z_INDEX = 10060;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Subtle "dust" effect for the modal -> calendar item close animation.
 * Small particles break off the modal's surface and drift toward the item,
 * fading as they go. Particles are appended to `document.body` and clean
 * themselves up, so they outlive the modal's unmount.
 */
export function playCalendarTaskCloseDisperse({
  source,
  target,
  sourceColor,
  targetColor,
  shrinkDurationMs,
}: CalendarTaskCloseDisperseOptions): void {
  if (typeof document === "undefined") return;

  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const size = randomBetween(2, 5);
    // Spawn anywhere on the modal surface so it looks like it's crumbling away.
    const startX = source.left + Math.random() * source.width;
    const startY = source.top + Math.random() * source.height;

    // Pull toward the item with some scatter around it.
    const pull = randomBetween(0.55, 0.95);
    const endX =
      startX +
      (targetCenterX - startX) * pull +
      randomBetween(-28, 28);
    const endY =
      startY +
      (targetCenterY - startY) * pull +
      randomBetween(-28, 28) -
      randomBetween(0, 14);

    const particle = document.createElement("div");
    particle.setAttribute("aria-hidden", "true");
    Object.assign(particle.style, {
      position: "fixed",
      zIndex: String(PARTICLE_Z_INDEX),
      pointerEvents: "none",
      left: "0px",
      top: "0px",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      backgroundColor: Math.random() < 0.65 ? targetColor : sourceColor,
      opacity: "0",
      willChange: "transform, opacity",
    });
    document.body.appendChild(particle);

    const delay = randomBetween(0, shrinkDurationMs * 0.6);
    const duration = randomBetween(260, 420);

    const animation = particle.animate(
      [
        {
          transform: `translate(${startX}px, ${startY}px) scale(1)`,
          opacity: 0,
        },
        {
          transform: `translate(${startX + (endX - startX) * 0.2}px, ${
            startY + (endY - startY) * 0.2
          }px) scale(1)`,
          opacity: 0.75,
          offset: 0.15,
        },
        {
          transform: `translate(${endX}px, ${endY}px) scale(0.2)`,
          opacity: 0,
        },
      ],
      {
        delay,
        duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );

    const cleanup = () => particle.remove();
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
}
