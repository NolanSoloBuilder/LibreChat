import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChannelService, channelProducts, calculateDemand, calculateEconomics } from './channel.mjs';
import { renderChannelUI } from './channel-ui.mjs';

function evaluate(service, owner, brief) {
  const refs = { task_id: brief.task_id, brief_revision: brief.brief_revision };
  const candidates = service.candidates(owner, refs);
  return service.evaluate(owner, { ...refs, candidate_set_id: candidates.candidate_set_id });
}

test('seeded performance, demand and contribution are traceable and arithmetic is reproducible', () => {
  assert.equal(channelProducts.length, 6);
  const product = channelProducts[0];
  assert.equal(product.internal_performance.monthly.length, 12);
  assert.equal(product.internal_performance.monthly[0].month, '2025-09');
  assert.equal(product.internal_performance.monthly.at(-1).month, '2026-08');
  assert.equal(product.internal_performance.monthly.reduce((sum, row) => sum + row.orders, 0), product.internal_performance.sample_size);
  const e = calculateEconomics(product);
  assert.equal(e.assumed_marketplace_price_usd, 349.99);
  assert.equal(e.platform_commission_usd, 52.5);
  assert.equal(e.expected_return_loss_usd, 5.1);
  assert.equal(e.contribution_per_order_usd, 85.39);
  assert.equal(e.expected_return_rate, 0.06);
  assert.deepEqual(calculateDemand(product).pilot_orders_90d_range, [131, 244]);
});

test('recommend, conditional, hold, revision, save and owner isolation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'channel-'));
  const path = join(dir, 'trial.sqlite');
  let service = new ChannelService(path);
  try {
    const brief = service.brief('alice', { brief: {} });
    const first = evaluate(service, 'alice', brief);
    assert.ok(first.counts.recommend_pilot >= 1);
    assert.ok(first.counts.conditional_pilot >= 1);
    assert.ok(first.counts.hold >= 1);
    assert.equal(first.candidates.find((p) => p.sku === 'ASH-2430538').status, 'conditional_pilot');
    assert.ok(first.candidates.find((p) => p.sku === 'ASH-2170838').blockers.includes('CERTIFICATION_EVIDENCE_MISSING'));
    const selected = ['ASH-3100438', 'ASH-2430538'];
    const args = { task_id: brief.task_id, brief_revision: 1, validation_id: first.validation_id, selected_skus: selected, idempotency_key: 'alice-pilot-1' };
    const draft = service.save('alice', args);
    assert.equal(draft.status, 'draft');
    assert.equal(draft.no_purchase_order, true);
    assert.equal(service.save('alice', args).draft_id, draft.draft_id);
    assert.throws(() => service.save('alice', { ...args, selected_skus: ['ASH-2170838'], idempotency_key: 'new' }), /INVALID_SELECTION/);
    assert.throws(() => service.get('bob', { draft_id: draft.draft_id }), /DRAFT_NOT_FOUND/);
    assert.throws(() => service.candidates('bob', { task_id: brief.task_id, brief_revision: 1 }), /TASK_NOT_FOUND/);
    const next = service.brief('alice', { task_id: brief.task_id, expected_revision: 1, brief: { min_contribution_margin: 0.25 } });
    assert.throws(() => service.save('alice', { ...args, idempotency_key: 'stale' }), /STALE_VALIDATION/);
    assert.throws(() => service.evaluate('alice', { task_id: brief.task_id, brief_revision: 2, candidate_set_id: first.candidate_set_id }), /CANDIDATE_SET_REQUIRED_OR_STALE/);
    const second = evaluate(service, 'alice', next);
    assert.equal(second.counts.recommend_pilot, 0);
    service.close();
    service = new ChannelService(path);
    assert.equal(service.get('alice', { draft_id: draft.draft_id }).selected_skus[0], selected[0]);
  } finally {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('UI labels simulated evidence and escapes public text', () => {
  const service = new ChannelService(':memory:');
  try {
    const brief = service.brief('user', { brief: {} });
    const evaluation = evaluate(service, 'user', brief);
    const ui = renderChannelUI('evaluate_channel_launch', evaluation);
    assert.equal(ui.length, 1);
    assert.match(ui[0].resource.text, /DEMO DATA/);
    assert.match(ui[0].resource.text, /contribution/i);
    assert.match(ui[0].resource.text, /Ashley website snapshot/);
    assert.match(ui[0].resource.text, /Conditional pilot/);
  } finally {
    service.close();
  }
});
