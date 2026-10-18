#!/usr/bin/env node
/**
 * Import pricing-data-template.xlsx into a /trolleyConfigs document.
 *
 * This is the "import from a file, not manual entry" path agreed for
 * Trolley: Chris maintains prices in the spreadsheet and re-runs this
 * script to update the config Firestore reads from — no admin-screen
 * form for ~120 rows of brand/pricing data.
 *
 * Usage:
 *   node scripts/importPricingConfig.js \
 *     --file ./pricing-data-template.xlsx \
 *     --name "Spaghetti Bolognese v1" \
 *     --uid <superadmin-uid> \
 *     --service-account ./serviceAccountKey.json \
 *     [--dry-run]
 *
 * --dry-run prints the parsed config and any warnings without writing to
 * Firestore — use it first to sanity-check a spreadsheet edit.
 *
 * Expected workbook shape (see the Read Me / column headers in the
 * template itself for the authoritative version):
 *   Outlets            : Outlet | Tier | Travel Mode | Travel Cost (£, return)
 *   Items & Product Types : Item | Required? | Quantity (for 2 people) |
 *                           Has Product Type? | Product Type Options (comma-separated)
 *   Brands & Pricing   : Outlet | Item | Product Type | Brand Name |
 *                        Tier (internal) | Pack Size | In-store Price (£)
 *   Delivery Options   : rows containing Method | Cost structure | Value |
 *                        Shown to student? | Notes (header row detected by
 *                        finding the cell literally equal to "Method")
 */

import xlsx from 'xlsx';
import { readFileSync } from 'fs';

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--uid') out.uid = argv[++i];
    else if (a === '--service-account') out.serviceAccount = argv[++i];
  }
  return out;
}

function slugify(str) {
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Missing sheet: "${sheetName}"`);
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function parseOutlets(wb, warnings) {
  const rows = sheetRows(wb, 'Outlets');
  const header = rows[0];
  const idx = {
    name: header.indexOf('Outlet'),
    travelMode: header.indexOf('Travel Mode'),
    travelCost: header.findIndex(h => typeof h === 'string' && h.startsWith('Travel Cost')),
  };
  return rows.slice(1).filter(r => r[idx.name]).map(r => {
    const travelCost = r[idx.travelCost];
    if (travelCost == null) warnings.push(`Outlet "${r[idx.name]}" has no Travel Cost set — defaulting to 0.`);
    return {
      id: slugify(r[idx.name]),
      name: r[idx.name],
      travelMode: r[idx.travelMode] ?? null,
      travelCost: Number(travelCost ?? 0),
    };
  });
}

function parseItems(wb, warnings) {
  const rows = sheetRows(wb, 'Items & Product Types');
  const header = rows[0];
  const idx = {
    name: header.indexOf('Item'),
    required: header.indexOf('Required?'),
    quantity: header.findIndex(h => typeof h === 'string' && h.startsWith('Quantity')),
    hasType: header.indexOf('Has Product Type?'),
    types: header.findIndex(h => typeof h === 'string' && h.startsWith('Product Type Options')),
  };
  return rows.slice(1).filter(r => r[idx.name]).map(r => {
    const required = String(r[idx.required] ?? '').trim().toUpperCase().startsWith('Y');
    const hasType = String(r[idx.hasType] ?? '').trim().toUpperCase().startsWith('Y');
    const types = hasType && r[idx.types]
      ? String(r[idx.types]).split(',').map(t => t.trim()).filter(Boolean)
      : [];
    if (!r[idx.quantity]) warnings.push(`Item "${r[idx.name]}" has no quantity label set.`);
    return {
      id: slugify(r[idx.name]),
      name: r[idx.name],
      required,
      quantityLabel: r[idx.quantity] ?? '',
      hasType,
      types,
      brands: hasType ? undefined : {},
      byType: hasType ? {} : undefined,
    };
  });
}

function parseBrandsAndPricing(wb, items, outlets, warnings) {
  const rows = sheetRows(wb, 'Brands & Pricing');
  const header = rows[0];
  const idx = {
    outlet: header.indexOf('Outlet'),
    item: header.indexOf('Item'),
    productType: header.indexOf('Product Type'),
    brand: header.indexOf('Brand Name'),
    tier: header.findIndex(h => typeof h === 'string' && h.startsWith('Tier')),
    packSize: header.indexOf('Pack Size'),
    price: header.findIndex(h => typeof h === 'string' && h.startsWith('In-store Price')),
  };

  const itemsById = Object.fromEntries(items.map(it => [it.name.toLowerCase(), it]));
  const outletsByName = Object.fromEntries(outlets.map(o => [o.name.toLowerCase(), o]));

  let rowCount = 0;
  for (const r of rows.slice(1)) {
    if (!r[idx.outlet] || !r[idx.item] || !r[idx.brand]) continue;
    rowCount++;

    const item = itemsById[String(r[idx.item]).toLowerCase()];
    const outlet = outletsByName[String(r[idx.outlet]).toLowerCase()];
    if (!item) { warnings.push(`Brands & Pricing row ${rowCount + 1}: unknown item "${r[idx.item]}" — skipped.`); continue; }
    if (!outlet) { warnings.push(`Brands & Pricing row ${rowCount + 1}: unknown outlet "${r[idx.outlet]}" — skipped.`); continue; }
    if (r[idx.price] == null) { warnings.push(`Brands & Pricing row ${rowCount + 1}: "${r[idx.brand]}" at ${r[idx.outlet]} has no price — skipped.`); continue; }

    const option = {
      brand: r[idx.brand],
      tier: r[idx.tier] ?? null,
      packSize: r[idx.packSize] ?? null,
      price: Number(r[idx.price]),
    };

    if (item.hasType) {
      const type = r[idx.productType];
      if (!type) { warnings.push(`Brands & Pricing row ${rowCount + 1}: "${item.name}" needs a Product Type — skipped.`); continue; }
      item.byType[type] = item.byType[type] ?? {};
      item.byType[type][outlet.id] = item.byType[type][outlet.id] ?? [];
      item.byType[type][outlet.id].push(option);
    } else {
      item.brands[outlet.id] = item.brands[outlet.id] ?? [];
      item.brands[outlet.id].push(option);
    }
  }
}

function parseDeliveryOptions(wb, warnings) {
  const rows = sheetRows(wb, 'Delivery Options');
  const headerRowIdx = rows.findIndex(r => r.includes('Method'));
  if (headerRowIdx === -1) throw new Error('Could not find the "Method" header row in Delivery Options.');
  const header = rows[headerRowIdx];
  const idx = { method: header.indexOf('Method'), value: header.indexOf('Value') };

  const byMethod = {};
  for (const r of rows.slice(headerRowIdx + 1)) {
    if (!r[idx.method]) continue;
    byMethod[r[idx.method]] = r[idx.value];
  }

  const standardFee = byMethod['Standard delivery'];
  const whooshFee = byMethod['Whoosh — delivery fee'];
  const whooshMarkup = byMethod['Whoosh — item markup'];
  if (standardFee == null) warnings.push('Standard delivery fee not set in Delivery Options.');
  if (whooshFee == null) warnings.push('Whoosh delivery fee not set in Delivery Options.');
  if (whooshMarkup == null) warnings.push('Whoosh item markup not set in Delivery Options.');

  return {
    standardFee: Number(standardFee ?? 0),
    whooshFee: Number(whooshFee ?? 0),
    whooshMarkup: Number(whooshMarkup ?? 0),
  };
}

function buildConfig(filePath, name) {
  const wb = xlsx.readFile(filePath);
  const warnings = [];

  const outlets = parseOutlets(wb, warnings);
  const items = parseItems(wb, warnings);
  parseBrandsAndPricing(wb, items, outlets, warnings);
  const deliveryOptions = parseDeliveryOptions(wb, warnings);

  for (const item of items) {
    const optionGroups = item.hasType ? Object.values(item.byType) : [item.brands];
    const hasAnyOptions = optionGroups.some(g => Object.values(g).some(arr => arr.length > 0));
    if (!hasAnyOptions) warnings.push(`Item "${item.name}" has no priced options at any outlet yet.`);
  }

  const config = {
    name,
    recipeName: 'Spaghetti Bolognese',
    quantityOptions: [2, 4, 8],
    outlets,
    items,
    deliveryOptions,
  };

  return { config, warnings };
}

async function writeToFirestore({ config, uid, serviceAccountPath }) {
  // Dynamic imports so `--dry-run` works without firebase-admin installed/configured.
  const [{ initializeApp, cert }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const ref = db.collection('trolleyConfigs').doc();
  await ref.set({
    ...config,
    id: ref.id,
    createdBy: uid,
    updatedAt: new Date(),
  });
  return ref.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/importPricingConfig.js --file <xlsx> --name <name> --uid <uid> --service-account <json> [--dry-run]');
    process.exit(1);
  }

  const { config, warnings } = buildConfig(args.file, args.name ?? 'Spaghetti Bolognese');

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.warn('  - ' + w);
  }

  const outletCount = config.outlets.length;
  const itemCount = config.items.length;
  const optionCount = config.items.reduce((sum, it) => {
    const groups = it.hasType ? Object.values(it.byType) : [it.brands];
    return sum + groups.reduce((s, g) => s + Object.values(g).reduce((s2, arr) => s2 + arr.length, 0), 0);
  }, 0);
  console.log(`\nParsed: ${outletCount} outlets, ${itemCount} items, ${optionCount} priced options.`);

  if (args.dryRun) {
    console.log('\n--dry-run: nothing written. Config preview:\n');
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (!args.uid || !args.serviceAccount) {
    console.error('Writing to Firestore needs --uid and --service-account (or pass --dry-run to just preview).');
    process.exit(1);
  }

  const id = await writeToFirestore({ config, uid: args.uid, serviceAccountPath: args.serviceAccount });
  console.log(`\nWrote trolleyConfigs/${id}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
