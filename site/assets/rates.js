/* ============================================================================
   STAMP DUTY RATES — the one file to edit when the Chancellor moves them.
   ============================================================================

   These are Stamp Duty Land Tax (SDLT) rates for ENGLAND and NORTHERN IRELAND.
   Scotland uses LBTT and Wales uses LTT — different bands, different thresholds.
   The calculator says so on screen and does not attempt those.

   ⚠️  VERIFY BEFORE PUBLISHING, AND RE-CHECK AFTER EVERY BUDGET.
       Source of truth: https://www.gov.uk/stamp-duty-land-tax
       Rates below reflect the thresholds that took effect 1 April 2025.
       Update EFFECTIVE_FROM whenever you change a band — it is shown to users
       so they can see how current the figures are.

   Bands are progressive: each rate applies only to the slice of the price
   within that band, not to the whole price.
*/
window.SDLT = {
  EFFECTIVE_FROM: '1 April 2025',
  REGION: 'England & Northern Ireland',

  // Standard residential purchase (you will own one property).
  standard: [
    { upTo: 125000,    rate: 0.00 },
    { upTo: 250000,    rate: 0.02 },
    { upTo: 925000,    rate: 0.05 },
    { upTo: 1500000,   rate: 0.10 },
    { upTo: Infinity,  rate: 0.12 }
  ],

  // First-time buyer relief. Only available up to firstTimeBuyerCap —
  // above that, standard rates apply with no relief at all.
  firstTimeBuyer: [
    { upTo: 300000,   rate: 0.00 },
    { upTo: 500000,   rate: 0.05 }
  ],
  firstTimeBuyerCap: 500000,

  // Additional property / second home / buy-to-let surcharge.
  // Added to every band. Applies where the price is at or above the threshold.
  additionalPropertySurcharge: 0.05,
  additionalPropertyThreshold: 40000
};
