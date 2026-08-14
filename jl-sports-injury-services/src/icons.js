/** Inline SVG icon set — stroke-based, 24×24, inherits currentColor. */

const wrap = (body, opts = {}) =>
  `<svg class="icon${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const paths = {
  // Treatments
  clipboard:
    '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z"/><path d="M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/><path d="m8.5 13 2 2 4-4"/>',
  hands:
    '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 3 0"/>',
  wave: '<path d="M2 8c2.5-3 5-3 7.5 0S15 11 17.5 8"/><path d="M2 13c2.5-3 5-3 7.5 0s5.5 3 8-.5"/><path d="M2 18c2.5-3 5-3 7.5 0s5.5 3 8-.5"/>',
  pulse:
    '<path d="M2 12h4l2.5-7 4 14L15 12h7"/>',
  needle:
    '<path d="m20 4-9 9"/><path d="m14.5 6.5 3 3"/><path d="M11 13 5.5 18.5a2.5 2.5 0 0 1-3.5 0"/><path d="m8.5 15.5 2 2"/>',
  bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/>',
  sound:
    '<path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',

  // Trust
  shield:
    '<path d="M12 2.5 4.5 5.5v6c0 4.5 3 8.5 7.5 10 4.5-1.5 7.5-5.5 7.5-10v-6L12 2.5Z"/><path d="m9 12 2 2 4-4"/>',
  dumbbell:
    '<path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10v4"/><path d="M20.5 10v4"/><path d="M6.5 12h11"/>',
  tag: '<path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0l-6-6A2 2 0 0 1 3 12.6V5a2 2 0 0 1 2-2h7.6a2 2 0 0 1 1.4.6l6 6a2 2 0 0 1 0 2.9Z"/><circle cx="8" cy="8" r="1.2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 9.5l6.1-.9L12 3Z"/>',

  // UI
  phone:
    '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  pin: '<path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  sparkle:
    '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2.5 2.5"/><path d="M15.5 15.5 18 18"/><path d="m18 6-2.5 2.5"/><path d="M8.5 15.5 6 18"/>',
};

const brand = {
  facebook:
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M14 9V7.2c0-.8.2-1.2 1.4-1.2H17V3h-2.6C11.5 3 10.5 4.4 10.5 6.9V9H8.5v3h2V21h3.5v-9h2.4l.4-3H14Z"/></svg>',
  instagram:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/></svg>',
  google:
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M21.6 12.2c0-.7-.06-1.35-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.75 3-4.32 3-7.3Z"/><path d="M12 22c2.7 0 4.97-.9 6.6-2.43l-3.2-2.5c-.9.6-2.05.95-3.4.95-2.6 0-4.8-1.76-5.6-4.12H3.1v2.58A10 10 0 0 0 12 22Z"/><path d="M6.4 13.9a6 6 0 0 1 0-3.83V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.84-2.84C16.96 2.99 14.7 2 12 2A10 10 0 0 0 3.1 7.5l3.3 2.57C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>',
};

/** Render a named icon. */
function icon(name, cls) {
  if (brand[name]) return brand[name];
  const p = paths[name];
  if (!p) throw new Error(`Unknown icon: ${name}`);
  return wrap(p, { cls });
}

/** Row of `n` filled stars. */
function stars(n = 5) {
  return `<span class="stars" role="img" aria-label="${n} out of 5 stars">${
    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 9.5l6.1-.9L12 3Z"/></svg>`.repeat(
      n
    )
  }</span>`;
}

module.exports = { icon, stars };
