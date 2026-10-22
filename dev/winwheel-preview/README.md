# Winwheel preview and regression checks

Start `npm run preview:winwheel`, then open http://127.0.0.1:4173/.
The game selector runs the actual extension module against a local Forge fixture.
A `?game=lotto&score=100` URL launches that game immediately.

- `/audit.html`: seven real game renderers, normal animation speed, initial score secrecy, changing coordinates, exact final results and finite SVG attributes.
- `/audit.html?reduced`: the same checks with the reduced-motion branch.
- `/integration.html`: actual module in alternating 390px/1280px frames. Checks the visible scene bounds, exact score and automatic closure around 1000ms after revelation.
- `node --experimental-strip-types --test dev/winwheel-preview/checks/*.test.mjs`: timing regression, abort/error cleanup, gravity and 200 seeded physical collector trajectories. Requires Node 24 or another Node version with TypeScript stripping support.
- `npx tsc --noEmit --jsx react-jsx`: type check.
- `npm run build` and `npm run build:firefox`: extension bundles.

## Motion contract

The recorded percentage is immutable. The animation reveals it on the winning object or collector. No score is shown in the new games' starting markup, except the rocket's explicitly changing gauge.

Marbles, pachinko, pinball and lotto render on HiDPI canvases (`arcadeGames.ts`, helpers in `canvasKit.ts`); the others use SVG viewBox units. Pachinko and pinball use a 120Hz gravity/collision solver with restitution, wall constraints and visible collector rails. A valid complete trajectory is computed before playback; the renderer interpolates that same trajectory, without moving the ball to an unrelated endpoint. Pinball also collides with the launch divider. Marble speeds use rolling gravity (5/7 g·sinθ) projected along each ramp, per-ramp friction, drag and drop losses. The actual first finisher wins. Pachinko simulates launches until a ball crosses the START chucker, then the LCD reels stop on the score digits. Lotto runs live 3D sphere physics (air jet, ball collisions), then outlet suction and the delivery tube carry the same visible ball. Cups retain the identity of the cup covering the ball across every permutation.

The first animation frame defines the clock origin. Negative progress is clamped and frame callback exceptions reject the promise, avoiding the former non-finite `getPointAtLength` error and permanently open overlay. Reduced motion uses shorter sequences; close/Escape aborts animation.

These are constrained 2D simulations rendered with material shading and depth cues. They do not use a full 3D rigid-body engine.

## Progressive scoring

Pinball, Pachinko and Plinko now start at 0%. Each physical contact has a precomputed integer award; their sum equals the recorded percentage. Repeated resting contacts are debounced. The live counter advances only when playback reaches that contact. Neutral contacts award zero. The final collector confirms the earned sum and never adjusts it. Pinball uses powered paddle contacts to return the ball at least three times, with at least five bumper contacts before draining. Plinko now accepts its physically reached slot instead of pulling the ball toward a score-dependent pocket.

`/scoring-audit.html` runs seven full module sessions, checking live progression, 0% and 1% edge cases, no final score jump and automatic closure. `scoring.test.mjs` checks every integer score 0–100 against 1–30 contacts.
