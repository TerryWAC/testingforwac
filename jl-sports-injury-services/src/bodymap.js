/**
 * Interactive body map.
 *
 * People do not arrive thinking "I need soft tissue therapy". They arrive
 * thinking "my knee hurts". This lets them point at where it hurts and lands
 * them on the condition page for it — which is also the fastest route into the
 * booking flow.
 *
 * A stylised figure rather than an anatomical one: it reads instantly at small
 * sizes, matches the brand, and does not pretend to be a diagnostic tool. The
 * region list below the figure is not a fallback bolted on afterwards — it is
 * how keyboard and screen reader users navigate it, and it gives search engines
 * seven more internal links into the condition pages.
 */

const { conditions } = require('./conditions');

// Region → the condition page it opens. Several regions share a page, which is
// correct: a hamstring and a calf are the same conversation.
const REGIONS = [
  { id: 'neck', label: 'Neck', condition: 'neck-pain' },
  { id: 'shoulder-l', label: 'Left shoulder', condition: 'shoulder-pain', mirror: true },
  { id: 'shoulder-r', label: 'Right shoulder', condition: 'shoulder-pain', mirror: true },
  { id: 'elbow-l', label: 'Left elbow', condition: 'wrist-elbow-pain', mirror: true },
  { id: 'elbow-r', label: 'Right elbow', condition: 'wrist-elbow-pain', mirror: true },
  { id: 'wrist-l', label: 'Left wrist', condition: 'wrist-elbow-pain', mirror: true },
  { id: 'wrist-r', label: 'Right wrist', condition: 'wrist-elbow-pain', mirror: true },
  { id: 'back', label: 'Lower back', condition: 'back-pain' },
  { id: 'hip', label: 'Hip and glute', condition: 'sciatica-nerve-pain' },
  { id: 'thigh-l', label: 'Left thigh', condition: 'muscle-strains', mirror: true },
  { id: 'thigh-r', label: 'Right thigh', condition: 'muscle-strains', mirror: true },
  { id: 'knee-l', label: 'Left knee', condition: 'knee-pain', mirror: true },
  { id: 'knee-r', label: 'Right knee', condition: 'knee-pain', mirror: true },
  { id: 'calf-l', label: 'Left calf', condition: 'muscle-strains', mirror: true },
  { id: 'calf-r', label: 'Right calf', condition: 'muscle-strains', mirror: true },
];

// The named areas offered in the list, one per condition, in a sensible order.
const LIST = [
  { region: 'neck', label: 'Neck' },
  { region: 'shoulder-r', label: 'Shoulder' },
  { region: 'elbow-r', label: 'Elbow & wrist' },
  { region: 'back', label: 'Lower back' },
  { region: 'hip', label: 'Hip, glute & sciatica' },
  { region: 'thigh-r', label: 'Hamstring & quad' },
  { region: 'knee-r', label: 'Knee' },
  { region: 'calf-r', label: 'Calf' },
];

/**
 * The figure, built from anatomical segments rather than a solid silhouette
 * with hit boxes laid over it. That matters: because each region *is* a body
 * part, heating one fills the whole thigh or the whole calf, instead of
 * showing a red rectangle pasted onto a person.
 *
 * Symmetric about x=150 on a 300×520 canvas. Segments are listed torso first,
 * then arms, then legs, so the limbs overlap the trunk the way they should.
 * A null id means the segment is structural only — you cannot pick a forearm,
 * because there is no forearm page to send you to.
 */
const PARTS = [
  // Head and neck
  [null, 'M150 16a30 30 0 1 1 0 60 30 30 0 0 1 0-60Z'],
  ['neck', 'M138 70h24v26c-6-4-18-4-24 0Z'],

  // Trunk
  [null, 'M150 86c18 0 32 4 36 10l4 56h-80l4-56c4-6 18-10 36-10Z'],
  ['back', 'M110 152h80l-2 54h-76Z'],
  ['hip', 'M112 206h76l-2 48c-16 8-56 8-72 0Z'],

  // Left arm (viewer's left)
  ['shoulder-l', 'M116 94c-20 2-32 16-33 44l26 6c1-24 3-40 7-50Z'],
  [null, 'M83 138l26 6-6 68H78Z'],
  ['elbow-l', 'M78 212h25l-4 36H76Z'],
  [null, 'M76 248h23l-6 52H72Z'],
  ['wrist-l', 'M72 300h21l-4 32H70Z'],
  [null, 'M70 332h19c1 20-5 32-11 32-7 0-10-14-8-32Z'],

  // Right arm
  ['shoulder-r', 'M184 94c20 2 32 16 33 44l-26 6c-1-24-3-40-7-50Z'],
  [null, 'M217 138l-26 6 6 68h25Z'],
  ['elbow-r', 'M222 212h-25l4 36h23Z'],
  [null, 'M224 248h-23l6 52h21Z'],
  ['wrist-r', 'M228 300h-21l4 32h19Z'],
  [null, 'M230 332h-19c-1 20 5 32 11 32 7 0 10-14 8-32Z'],

  // Left leg
  ['thigh-l', 'M116 250h32l-2 86h-28Z'],
  ['knee-l', 'M118 336h28l-1 38h-26Z'],
  ['calf-l', 'M119 374h26l-3 78h-20Z'],
  [null, 'M122 452h20l-1 34h-21Z'],
  [null, 'M120 486h21l2 14c-6 4-20 4-26 0Z'],

  // Right leg
  ['thigh-r', 'M184 250h-32l2 86h28Z'],
  ['knee-r', 'M182 336h-28l1 38h26Z'],
  ['calf-r', 'M181 374h-26l3 78h20Z'],
  [null, 'M178 452h-20l1 34h21Z'],
  [null, 'M180 486h-21l-2 14c6 4 20 4 26 0Z'],
];

function figure() {
  const parts = PARTS.map(([id, d]) => {
    if (!id) return `<path class="bm-part" d="${d}"/>`;
    const r = REGIONS.find((x) => x.id === id);
    return `<path class="bm-part bm-region" data-region="${id}" data-condition="${r.condition}"
        d="${d}"><title>${r.label}</title></path>`;
  }).join('\n      ');

  return `<svg class="bm-figure" viewBox="0 0 300 520" role="img"
    aria-label="Diagram of the body. Use the list of areas below to choose where it hurts.">
    <g class="bm-body">
      ${parts}
    </g>
  </svg>`;
}

/** The whole section, for the home and conditions pages. */
function bodyMap(icon, esc, opts = {}) {
  const byCondition = Object.fromEntries(conditions.map((c) => [c.slug, c]));

  const areas = LIST.map(
    (a) => `<button class="bm-pick" type="button" data-region="${a.region}"
      data-condition="${byCondition[REGIONS.find((r) => r.id === a.region).condition].slug}">
      ${esc(a.label)}
    </button>`
  ).join('');

  // Every condition gets a panel; JS reveals the matching one.
  const panels = conditions
    .map(
      (c) => `<div class="bm-panel" data-panel="${c.slug}" hidden>
      <span class="bm-panel-tag">${icon(c.icon)} ${esc(c.name)}</span>
      <p>${esc(c.blurb)}</p>
      <div class="btn-row">
        <a class="btn btn-primary btn-sm" href="${c.slug}.html">
          What to do about it ${icon('arrow')}
        </a>
        <a class="btn btn-ghost btn-sm" href="book.html?treatment=injury-assessment">Book an assessment</a>
      </div>
    </div>`
    )
    .join('');

  return `<section class="section bodymap-section" id="${opts.id || 'where-does-it-hurt'}"${
    opts.style ? ` style="${opts.style}"` : ''
  }>
  <div class="shell">
    <div class="section-head" data-reveal>
      <span class="eyebrow">${icon('sparkle')} Where does it hurt?</span>
      <h2>${esc(opts.heading || 'Point at it.')}</h2>
      <p class="lead">
        Choose the area that is giving you trouble and you will get straight to what causes it,
        how it is assessed and what treatment actually changes it.
      </p>
    </div>

    <div class="bodymap" data-reveal>
      <div class="bm-stage">
        <span class="bm-cue" aria-hidden="true">${icon('tap')} Tap a body part</span>
        ${figure()}
      </div>

      <div class="bm-side">
        <!-- Fixed height so opening a panel never shunts the buttons around. -->
        <div class="bm-reveal">
          <!-- The resting state. It occupies exactly the space a panel will,
               so nothing jumps, and it earns that space by explaining what
               happens next rather than sitting there as a blank gap. -->
          <div class="bm-hint" data-bm-hint>
            <span class="bm-panel-tag">${icon('tap')} Where does it hurt?</span>
            <ol class="bm-steps">
              <li>Choose the area that is giving you trouble.</li>
              <li>See what actually causes it and how it is assessed.</li>
              <li>Book the treatment that fixes it — no referral needed.</li>
            </ol>
          </div>
          ${panels}
        </div>
        <div class="bm-picks" role="group" aria-label="Areas of the body">
          ${areas}
        </div>
        <p class="bm-foot">
          Not sure which it is? That is exactly what the assessment is for —
          <a class="btn-link" href="book.html?treatment=injury-assessment">book an initial assessment ${icon(
            'arrow'
          )}</a>
        </p>
      </div>
    </div>
  </div>
</section>`;
}

module.exports = { bodyMap, REGIONS };
