import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { publicSnapshot } from './domain.mjs';

export const channelDatasetVersion = 'us-marketplace-pilot-2026-09-20-v1';
const asOf = '2026-09-20';
const months = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(Date.UTC(2025, 8 + i, 1));
  return date.toISOString().slice(0, 7);
});
const samples = [
  { sku: '3100438', cost: 160, freight: 40, fee: 7, commission: 0.15, returnRate: 0.06, returnLoss: 85, searches: 24000, listings: 82, clickShare: 0.12, conversion: 0.065, baseUnits: 105, onTime: 0.96, lead: 25, stock: 170, certified: true, rating: 4.5, reviewCount: 560, negativeRate: 0.045 },
  { sku: '2430538', cost: 205, freight: 48, fee: 8, commission: 0.15, returnRate: 0.09, returnLoss: 95, searches: 19000, listings: 110, clickShare: 0.11, conversion: 0.055, baseUnits: 87, onTime: 0.84, lead: 38, stock: 105, certified: true, rating: 4.2, reviewCount: 320, negativeRate: 0.085 },
  { sku: '7780538', cost: 315, freight: 55, fee: 9, commission: 0.15, returnRate: 0.07, returnLoss: 120, searches: 18000, listings: 91, clickShare: 0.11, conversion: 0.058, baseUnits: 91, onTime: 0.94, lead: 30, stock: 94, certified: true, rating: 4.4, reviewCount: 410, negativeRate: 0.055 },
  { sku: '2170838', cost: 450, freight: 75, fee: 12, commission: 0.15, returnRate: 0.08, returnLoss: 160, searches: 21000, listings: 99, clickShare: 0.10, conversion: 0.05, baseUnits: 72, onTime: 0.93, lead: 32, stock: 62, certified: false, rating: 4.3, reviewCount: 250, negativeRate: 0.06 },
  { sku: '6330789', cost: 390, freight: 75, fee: 12, commission: 0.15, returnRate: 0.12, returnLoss: 140, searches: 13000, listings: 125, clickShare: 0.09, conversion: 0.044, baseUnits: 60, onTime: 0.91, lead: 42, stock: 76, certified: true, rating: 4.0, reviewCount: 275, negativeRate: 0.12 },
  { sku: '2420338', cost: 190, freight: 42, fee: 7, commission: 0.15, returnRate: 0.10, returnLoss: 90, searches: 7400, listings: 150, clickShare: 0.08, conversion: 0.045, baseUnits: 45, onTime: 0.95, lead: 24, stock: 125, certified: true, rating: 4.1, reviewCount: 180, negativeRate: 0.09 },
];
const byPublicSku = new Map(publicSnapshot.products.map((p) => [p.official_sku, p]));
const round = (n, digits = 2) => Number(n.toFixed(digits));
const fail = (code) => { throw new Error(code); };
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const channelProducts = samples.map((record, index) => {
  const publicProduct = byPublicSku.get(record.sku);
  if (!publicProduct) fail(`PUBLIC_SKU_MISSING:${record.sku}`);
  const monthly = months.map((month, i) => {
    const orders = record.baseUnits + ((i * 7 + index * 3) % 17) - 8;
    const returns = Math.round(orders * record.returnRate);
    return {
      month, orders, returns, net_units: orders - returns,
      revenue_usd: round(orders * Number(publicProduct.public_price)),
      source_id: `MOCK-OMS-${record.sku}-${month}`,
      data_mode: 'mock',
    };
  });
  return {
    sku: `ASH-${record.sku}`,
    public_product: {
      name: publicProduct.name,
      url: publicProduct.source_url,
      image_url: publicProduct.images?.[0] ?? null,
      list_price_usd: Number(publicProduct.public_price),
      collected_at: publicProduct.collected_at,
      source_id: `ASHLEY-WEB-${record.sku}`,
      data_mode: 'public_snapshot',
    },
    internal_performance: {
      channel: 'Existing US business, not the proposed marketplace',
      monthly,
      source_id: `MOCK-OMS-${record.sku}`,
      as_of: asOf,
      sample_size: monthly.reduce((sum, row) => sum + row.orders, 0),
      data_mode: 'mock',
    },
    marketplace: {
      window_days: 90,
      comparable_searches: record.searches,
      active_competing_listings: record.listings,
      estimated_click_share: record.clickShare,
      comparable_conversion: record.conversion,
      source_id: `MOCK-MKT-${record.sku}-90D`,
      as_of: asOf,
      sample_size: record.searches,
      data_mode: 'mock',
    },
    economics: {
      procurement_usd: record.cost,
      outbound_shipping_usd: record.freight,
      fixed_platform_fee_usd: record.fee,
      commission_rate: record.commission,
      expected_return_rate: record.returnRate,
      loss_per_return_usd: record.returnLoss,
      source_id: `MOCK-FIN-${record.sku}`,
      as_of: asOf,
      data_mode: 'mock',
    },
    risk: {
      supplier_on_time_rate: record.onTime,
      lead_days: record.lead,
      available_units: record.stock,
      certification_status: record.certified ? 'verified_for_demo' : 'missing_evidence',
      average_rating: record.rating,
      review_count: record.reviewCount,
      negative_review_rate: record.negativeRate,
      source_id: `MOCK-RISK-${record.sku}`,
      as_of: asOf,
      sample_size: record.reviewCount,
      data_mode: 'mock',
    },
  };
});
const bySku = new Map(channelProducts.map((p) => [p.sku, p]));
const meta = (data) => ({ data_mode: 'mock', dataset_version: channelDatasetVersion, as_of: asOf, currency: 'USD', ...data });
const requireProduct = (sku) => bySku.get(sku) ?? fail('SKU_NOT_FOUND');

export function calculateEconomics(product) {
  const price = product.public_product.list_price_usd;
  const e = product.economics;
  const commission = price * e.commission_rate;
  const expectedReturnLoss = e.expected_return_rate * e.loss_per_return_usd;
  const net = price - e.procurement_usd - e.outbound_shipping_usd - e.fixed_platform_fee_usd - commission - expectedReturnLoss;
  return {
    sku: product.sku,
    assumed_marketplace_price_usd: price,
    price_basis: 'Public website list-price snapshot used as a simulated marketplace price assumption',
    procurement_usd: e.procurement_usd,
    outbound_shipping_usd: e.outbound_shipping_usd,
    fixed_platform_fee_usd: e.fixed_platform_fee_usd,
    platform_commission_usd: round(commission),
    expected_return_loss_usd: round(expectedReturnLoss),
    expected_return_rate: e.expected_return_rate,
    contribution_per_order_usd: round(net),
    contribution_margin: round(net / price, 4),
    source_ids: [product.public_product.source_id, e.source_id],
    data_mode: 'mock',
  };
}

export function calculateDemand(product) {
  const m = product.marketplace;
  const observed = product.internal_performance.monthly;
  const ownMonthlyOrders = observed.reduce((sum, row) => sum + row.orders, 0) / observed.length;
  const ordersMid = m.comparable_searches * m.estimated_click_share * m.comparable_conversion;
  const searchesPerListing = m.comparable_searches / m.active_competing_listings;
  return {
    sku: product.sku,
    searches_per_competing_listing: round(searchesPerListing, 1),
    comparable_searches_90d: m.comparable_searches,
    competing_listings: m.active_competing_listings,
    own_existing_channel_orders_monthly: round(ownMonthlyOrders, 1),
    pilot_orders_90d_range: [Math.floor(ordersMid * 0.7), Math.ceil(ordersMid * 1.3)],
    estimate_method: 'Comparable searches × assumed click share × comparable conversion; ±30% scenario range, not a sales forecast',
    source_ids: [m.source_id, product.internal_performance.source_id],
    data_mode: 'mock',
  };
}

export function judgeProduct(product, brief) {
  const demand = calculateDemand(product);
  const economics = calculateEconomics(product);
  const risk = product.risk;
  const blockers = [];
  const conditions = [];
  if (demand.searches_per_competing_listing < brief.min_searches_per_listing) blockers.push('INSUFFICIENT_MARKET_DEMAND');
  if (economics.contribution_margin < brief.min_contribution_margin) blockers.push('BELOW_NET_MARGIN_FLOOR');
  if (risk.certification_status !== 'verified_for_demo') blockers.push('CERTIFICATION_EVIDENCE_MISSING');
  if (risk.lead_days > brief.max_lead_days) blockers.push('LEAD_TIME_EXCEEDS_LIMIT');
  if (risk.available_units < brief.min_pilot_stock) blockers.push('INSUFFICIENT_PILOT_STOCK');
  if (risk.supplier_on_time_rate < brief.min_supplier_on_time_rate) conditions.push('VERIFY_SUPPLIER_DELIVERY_RELIABILITY');
  if (product.economics.expected_return_rate > brief.max_return_rate) conditions.push('MITIGATE_RETURN_RATE');
  if (risk.negative_review_rate > brief.max_negative_review_rate) conditions.push('REVIEW_NEGATIVE_FEEDBACK');
  const status = blockers.length ? 'hold' : conditions.length ? 'conditional_pilot' : 'recommend_pilot';
  return { sku: product.sku, name: product.public_product.name, status, blockers, conditions, demand, economics, risk, public_product: product.public_product };
}
function rankCandidates(candidates) {
  const rank = { recommend_pilot: 0, conditional_pilot: 1, hold: 2 };
  return candidates.sort((a, b) => rank[a.status] - rank[b.status] || b.demand.searches_per_competing_listing - a.demand.searches_per_competing_listing || b.economics.contribution_margin - a.economics.contribution_margin);
}

export class ChannelService {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS channel_tasks(id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS channel_candidates(id TEXT PRIMARY KEY, task TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS channel_validations(id TEXT PRIMARY KEY, task TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS channel_drafts(id TEXT PRIMARY KEY, task TEXT NOT NULL, owner TEXT NOT NULL, revision INTEGER NOT NULL, idem TEXT NOT NULL, body TEXT NOT NULL, UNIQUE(owner, idem));`);
  }
  close() { this.db.close(); }
  task(owner, id) {
    const row = this.db.prepare('SELECT * FROM channel_tasks WHERE id=? AND owner=?').get(id, owner);
    if (!row) fail('TASK_NOT_FOUND');
    return { ...row, brief: JSON.parse(row.body) };
  }
  current(owner, args) {
    const task = this.task(owner, args.task_id);
    if (task.revision !== args.brief_revision) fail('STALE_REVISION');
    return task;
  }
  context() {
    return meta({
      market: 'United States', channel: 'Third-party online marketplace', category: 'Existing Ashley sofas',
      policy: { min_contribution_margin: 0.12, min_searches_per_listing: 150, max_lead_days: 45, min_pilot_stock: 50, min_supplier_on_time_rate: 0.9, max_return_rate: 0.1, max_negative_review_rate: 0.1, pilot_days: 60 },
      notice: 'All marketplace, performance, cost, supply, certification and review records are synthetic. No Ashley internal system is connected.',
    });
  }
  brief(owner, args) {
    const old = args.task_id ? this.task(owner, args.task_id) : null;
    if (old && args.expected_revision !== old.revision) fail('STALE_REVISION');
    const policy = this.context().policy;
    const brief = { ...policy, ...old?.brief, ...args.brief };
    for (const [key, value] of Object.entries(brief)) {
      if (!Object.hasOwn(policy, key) || typeof value !== 'number' || !Number.isFinite(value)) fail('INVALID_BRIEF');
    }
    if (brief.min_contribution_margin < 0 || brief.min_contribution_margin > 1 || brief.max_return_rate < 0 || brief.max_return_rate > 1 || brief.min_supplier_on_time_rate < 0 || brief.min_supplier_on_time_rate > 1 || brief.max_negative_review_rate < 0 || brief.max_negative_review_rate > 1 || brief.max_lead_days < 1 || brief.min_pilot_stock < 1 || brief.min_searches_per_listing < 1 || brief.pilot_days < 1) fail('INVALID_BRIEF');
    const taskId = old?.id ?? randomUUID();
    const revision = (old?.revision ?? 0) + 1;
    this.db.prepare('INSERT INTO channel_tasks VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(taskId, owner, revision, JSON.stringify(brief));
    return meta({ task_id: taskId, brief_revision: revision, brief, notice: 'Any validation from an earlier revision is stale.' });
  }
  opportunity(owner, args) {
    const task = this.current(owner, args);
    return meta({ task_id: task.id, brief_revision: task.revision, opportunities: channelProducts.map((p) => ({ ...calculateDemand(p), name: p.public_product.name, meets_demand_floor: calculateDemand(p).searches_per_competing_listing >= task.brief.min_searches_per_listing })) });
  }
  candidates(owner, args) {
    const task = this.current(owner, args);
    const skus = args.skus?.length ? args.skus : channelProducts.map((p) => p.sku);
    const unique = [...new Set(skus)];
    unique.forEach(requireProduct);
    const id = randomUUID();
    this.db.prepare('INSERT INTO channel_candidates VALUES(?,?,?,?)').run(id, task.id, task.revision, JSON.stringify(unique));
    return meta({ task_id: task.id, brief_revision: task.revision, candidate_set_id: id, items: unique.map((sku) => { const p = requireProduct(sku); return { sku, public_product: p.public_product, performance_source_id: p.internal_performance.source_id }; }) });
  }
  performance(owner, args) {
    this.current(owner, args);
    return meta({ items: args.skus.map((sku) => ({ sku, ...requireProduct(sku).internal_performance })) });
  }
  economics(owner, args) {
    this.current(owner, args);
    return meta({ items: args.skus.map((sku) => calculateEconomics(requireProduct(sku))) });
  }
  risks(owner, args) {
    const task = this.current(owner, args);
    return meta({ items: args.skus.map((sku) => { const p = requireProduct(sku); return { sku, ...p.risk, expected_return_rate: p.economics.expected_return_rate, meets_lead_limit: p.risk.lead_days <= task.brief.max_lead_days }; }) });
  }
  workflow(owner, args) {
    const brief = args.task_id
      ? (() => { const task = this.current(owner, args); return meta({ task_id: task.id, brief_revision: task.revision, brief: task.brief }); })()
      : this.brief(owner, { brief: {} });
    const ref = { task_id: brief.task_id, brief_revision: brief.brief_revision };
    const opportunities = this.opportunity(owner, ref);
    const candidates = this.candidates(owner, ref);
    const skus = candidates.items.map((item) => item.sku);
    const performance = this.performance(owner, { ...ref, skus });
    const economics = this.economics(owner, { ...ref, skus });
    const risks = this.risks(owner, { ...ref, skus });
    const evaluation = this.evaluate(owner, { ...ref, candidate_set_id: candidates.candidate_set_id });
    return meta({
      task_id: brief.task_id,
      brief_revision: brief.brief_revision,
      stages: ['brief', 'market_opportunity', 'existing_skus', 'monthly_performance', 'unit_economics', 'supply_and_risks', 'server_side_evaluation'],
      brief,
      opportunities,
      candidates,
      performance_summary: performance.items.map((item) => ({ sku: item.sku, source_id: item.source_id, sample_size: item.sample_size, orders_12m: item.monthly.reduce((sum, row) => sum + row.orders, 0), returns_12m: item.monthly.reduce((sum, row) => sum + row.returns, 0) })),
      economics,
      risks,
      evaluation,
    });
  }
  evaluate(owner, args) {
    const task = this.current(owner, args);
    const row = this.db.prepare('SELECT * FROM channel_candidates WHERE id=? AND task=? AND revision=?').get(args.candidate_set_id, task.id, task.revision);
    if (!row) fail('CANDIDATE_SET_REQUIRED_OR_STALE');
    const candidates = rankCandidates(JSON.parse(row.body).map((sku) => judgeProduct(requireProduct(sku), task.brief)));
    const validationId = randomUUID();
    const result = meta({ task_id: task.id, brief_revision: task.revision, candidate_set_id: args.candidate_set_id, validation_id: validationId, candidates, counts: { recommend_pilot: candidates.filter((c) => c.status === 'recommend_pilot').length, conditional_pilot: candidates.filter((c) => c.status === 'conditional_pilot').length, hold: candidates.filter((c) => c.status === 'hold').length }, notice: 'Decision support for a simulated 60-day pilot. Confirm costs, certifications, supplier terms and platform policies with Ashley before any actual launch.' });
    this.db.prepare('INSERT INTO channel_validations VALUES(?,?,?,?)').run(validationId, task.id, task.revision, JSON.stringify({ candidate_set_id: args.candidate_set_id, digest: digest(candidates) }));
    return result;
  }
  save(owner, args) {
    const task = this.task(owner, args.task_id);
    if (task.revision !== args.brief_revision) fail('STALE_VALIDATION');
    const validation = this.db.prepare('SELECT * FROM channel_validations WHERE id=? AND task=? AND revision=?').get(args.validation_id, task.id, task.revision);
    if (!validation) fail('STALE_VALIDATION');
    const earlier = this.db.prepare('SELECT * FROM channel_drafts WHERE owner=? AND idem=?').get(owner, args.idempotency_key);
    if (earlier) {
      const body = JSON.parse(earlier.body);
      if (body.task_id === task.id && body.validation_id === args.validation_id && digest(body.selected_skus) === digest(args.selected_skus)) return meta(body);
      fail('IDEMPOTENCY_CONFLICT');
    }
    const validated = JSON.parse(validation.body);
    const candidateRow = this.db.prepare('SELECT * FROM channel_candidates WHERE id=? AND task=? AND revision=?').get(validated.candidate_set_id, task.id, task.revision);
    if (!candidateRow) fail('STALE_VALIDATION');
    const selected = [...new Set(args.selected_skus)];
    if (!selected.length || selected.length !== args.selected_skus.length || selected.some((sku) => !JSON.parse(candidateRow.body).includes(sku))) fail('INVALID_SELECTION');
    const assessed = rankCandidates(JSON.parse(candidateRow.body).map((sku) => judgeProduct(requireProduct(sku), task.brief)));
    if (digest(assessed) !== validated.digest || selected.some((sku) => assessed.find((row) => row.sku === sku)?.status === 'hold')) fail('INVALID_SELECTION');
    const draftId = randomUUID();
    const body = { draft_id: draftId, draft_version: 1, status: 'draft', task_id: task.id, brief_revision: task.revision, validation_id: args.validation_id, selected_skus: selected, selections: selected.map((sku) => assessed.find((row) => row.sku === sku)), data_mode: 'mock', no_purchase_order: true };
    this.db.prepare('INSERT INTO channel_drafts VALUES(?,?,?,?,?,?)').run(draftId, task.id, owner, task.revision, args.idempotency_key, JSON.stringify(body));
    return meta(body);
  }
  get(owner, args) {
    const row = this.db.prepare('SELECT body FROM channel_drafts WHERE id=? AND owner=?').get(args.draft_id, owner);
    if (!row) fail('DRAFT_NOT_FOUND');
    return meta(JSON.parse(row.body));
  }
}
