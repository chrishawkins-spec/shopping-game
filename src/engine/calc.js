/**
 * Trolley pricing engine — pure functions, no Firebase.
 *
 * These are independent of the final pricing data and independent of
 * Anita's still-open questions (real vs. anonymised brands, hidden vs.
 * visible running total, etc.) — everything here just reads whatever
 * config/selections it's given.
 *
 * PROVISIONAL quantity model — read before changing:
 * The pricing-data-template.xlsx stores ONE "In-store Price" per brand/
 * pack-size row, priced for the item's stated 2-person quantity (e.g.
 * Protein → 250g). Those "Quantity (for 2 people)" labels are free text
 * for display ("1 medium", "4 rolls (or half a loaf)", "6 salad tomatoes,
 * or 1 vine truss") — not clean enough to auto-parse into a pack-size
 * combination optimiser, which is what the spreadsheet's own "Quantity &
 * Pack Sizes" sheet actually asks for ("let the app calculate the
 * cheapest valid combination automatically"). Building that against
 * free-text labels would invent precision the data doesn't have, and
 * exactly how quantity maps to pack size is still an open item in the
 * spec ("Confirm pack sizes to price for each item, and how quantity
 * maps to pack-size choices").
 *
 * So for now: price scales linearly with quantity — a 4-person basket
 * costs double a 2-person one, an 8-person basket costs quadruple. This
 * is a known simplification, not the final pedagogical mechanic (it
 * loses the "bigger packs are better value" lesson) — swap
 * `priceForQuantity` below for real pack-size arithmetic once the
 * pack-size/quantity data question is resolved; nothing else in this
 * file needs to change.
 */

const FULFILMENT_METHODS = ['in-store', 'standard-delivery', 'whoosh'];
const BASE_QUANTITY = 2;

/** Find an outlet by id in a trolley config. */
export function getOutlet(config, outletId) {
  return config.outlets.find(o => o.id === outletId) ?? null;
}

/** All priced options for an item at a given outlet (flattens byType if present). */
export function getItemOptionsAtOutlet(item, outletId) {
  if (item.hasType) {
    return Object.values(item.byType ?? {}).flatMap(byOutlet => byOutlet[outletId] ?? []);
  }
  return item.brands?.[outletId] ?? [];
}

/**
 * The price of one chosen option, scaled for quantity. See the
 * PROVISIONAL note above — this is linear scaling of the 2-person price,
 * not real pack-size arithmetic.
 */
export function priceForQuantity(option, quantity) {
  if (option?.price == null) throw new Error(`No price on option ${option?.brand ?? '(unknown)'}`);
  return option.price * (quantity / BASE_QUANTITY);
}

/** The flat fulfilment-method fee/cost (not including any item markup). */
export function fulfilmentFee(config, outlet, fulfilment) {
  switch (fulfilment) {
    case 'in-store':          return outlet.travelCost ?? 0;
    case 'standard-delivery': return config.deliveryOptions?.standardFee ?? 0;
    case 'whoosh':            return config.deliveryOptions?.whooshFee ?? 0;
    default: throw new Error(`Unknown fulfilment method: ${fulfilment}`);
  }
}

/** The item-price multiplier for a fulfilment method — Whoosh's markup,
 *  applied silently to every item price, never shown as its own line. */
export function itemPriceMultiplier(config, fulfilment) {
  if (fulfilment !== 'whoosh') return 1;
  return 1 + (config.deliveryOptions?.whooshMarkup ?? 0);
}

/**
 * Compute a basket's totals from a student's actual selections.
 *
 * @param basket { [itemId]: { option, included? } } — `option` is the
 *   chosen priced option object (from getItemOptionsAtOutlet); optional
 *   items need included: true to count, required items always count.
 */
export function computeBasketTotals({ config, outletId, quantity, fulfilment, basket, items }) {
  const outlet = getOutlet(config, outletId);
  if (!outlet) throw new Error(`Unknown outlet: ${outletId}`);

  const multiplier = itemPriceMultiplier(config, fulfilment);

  let itemSubtotal = 0;
  const lineItems = [];
  for (const item of items) {
    const chosen = basket[item.id];
    if (!chosen) continue;
    if (!item.required && !chosen.included) continue;

    const basePrice = priceForQuantity(chosen.option, quantity);
    const price = basePrice * multiplier;
    itemSubtotal += price;
    lineItems.push({ itemId: item.id, brand: chosen.option.brand, packSize: chosen.option.packSize, price });
  }

  const fulfilmentCost = fulfilmentFee(config, outlet, fulfilment);
  const grandTotal = itemSubtotal + fulfilmentCost;

  // For the Whoosh reveal on the results screen: what the same basket
  // would have cost in-store, i.e. with the markup stripped back out.
  const itemSubtotalWithoutMarkup = multiplier === 1 ? itemSubtotal : itemSubtotal / multiplier;

  return {
    lineItems,
    itemSubtotal: round2(itemSubtotal),
    itemSubtotalWithoutMarkup: round2(itemSubtotalWithoutMarkup),
    fulfilmentCost: round2(fulfilmentCost),
    grandTotal: round2(grandTotal),
    costPerPortion: round2(grandTotal / quantity),
  };
}

/**
 * The theoretical cheapest and most expensive basket totals achievable at
 * a given outlet and quantity, across all three fulfilment methods —
 * picking the cheapest/priciest option for every required item, and
 * skipping/including every optional item accordingly. This is what the
 * Results Screen shows for comparison; it does not depend on what any
 * other student actually chose.
 */
export function theoreticalBasketBounds({ config, outletId, quantity, items }) {
  const outlet = getOutlet(config, outletId);
  if (!outlet) throw new Error(`Unknown outlet: ${outletId}`);

  let cheapest = Infinity;
  let priciest = -Infinity;

  for (const fulfilment of FULFILMENT_METHODS) {
    const multiplier = itemPriceMultiplier(config, fulfilment);
    const fee = fulfilmentFee(config, outlet, fulfilment);

    let minItems = 0;
    let maxItems = 0;
    for (const item of items) {
      const options = getItemOptionsAtOutlet(item, outletId);
      if (options.length === 0) continue;
      const prices = options.map(o => priceForQuantity(o, quantity));
      const min = Math.min(...prices);
      const max = Math.max(...prices);

      if (item.required) {
        minItems += min;
        maxItems += max;
      } else {
        // cheapest basket skips every optional item; priciest includes all of them
        maxItems += max;
      }
    }

    const totalMin = minItems * multiplier + fee;
    const totalMax = maxItems * multiplier + fee;
    cheapest = Math.min(cheapest, totalMin);
    priciest = Math.max(priciest, totalMax);
  }

  return { cheapest: round2(cheapest), priciest: round2(priciest) };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
