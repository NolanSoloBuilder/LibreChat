import { createHash } from 'node:crypto';
import { thumbnailSource } from './images.mjs';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const usd = (value) => `$${Number(value).toFixed(2)}`;
const percent = (value) => `${(Number(value) * 100).toFixed(1)}%`;
const statusLabel = { recommend_pilot: 'Recommend pilot', conditional_pilot: 'Conditional pilot', hold: 'Hold' };
const badge = (label, status = '') => `<span class="badge ${escape(status)}">${escape(label)}</span>`;
const image = (product) => {
  const src = thumbnailSource(product?.image_url);
  return src ? `<img src="${escape(src)}" alt="${escape(product.name)}" loading="lazy">` : '<span class="placeholder">Image unavailable</span>';
};
const button = (label, prompt) => `<button type="button" data-prompt="${escape(prompt)}">${escape(label)}</button>`;
function page(title, subtitle, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{color-scheme:light dark;--bg:#fff;--fg:#262b27;--muted:#69736b;--line:#dfe5df;--soft:#f5f7f4;--accent:#315b43;--warn:#915a13}*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;color:var(--fg);background:transparent}section{border:1px solid var(--line);border-radius:14px;background:var(--bg);overflow:hidden}header{padding:18px 20px;border-bottom:1px solid var(--line)}h2{margin:4px 0;font-size:18px}h3{margin:0;font-size:15px}p{margin:6px 0;color:var(--muted)}small{color:var(--muted)}.eyebrow{font-size:11px;letter-spacing:.11em;color:var(--accent);font-weight:700}.body{padding:16px 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:10px;overflow:hidden}.card-content{padding:14px}.photo{height:150px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--soft)}.photo img{display:block;width:100%;height:100%;object-fit:contain}.placeholder{font-size:12px;color:var(--muted)}.badge{display:inline-block;background:var(--soft);border-radius:5px;padding:3px 7px;font-size:11px;margin:3px 5px 3px 0}.recommend_pilot{color:var(--accent)}.conditional_pilot,.hold{color:var(--warn)}.metric{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:5px 0}.metric strong{text-align:right}.reasons{margin:8px 0;padding-left:20px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}button{background:var(--soft);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:8px 10px;cursor:pointer}button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}a{color:var(--accent)}.note{background:var(--soft);padding:10px 20px;color:var(--muted);font-size:12px}@media(prefers-color-scheme:dark){:root{--bg:#20241f;--fg:#eef2ed;--muted:#aab6ab;--line:#414a40;--soft:#2b332c;--accent:#addbb5;--warn:#edbe83}}</style></head><body><section><header><div class="eyebrow">ASHLEY · CHANNEL SELECTION · DEMO DATA</div><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></header><div class="body">${body}</div><div class="note">Public website facts and simulated business data have separate source IDs. No purchase order is created.</div></section><script>document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{button.disabled=true;parent.postMessage({type:'prompt',payload:{prompt:button.dataset.prompt,displayText:button.textContent}},'*');button.textContent='Sent to chat';}));const size=()=>parent.postMessage({type:'ui-size-change',payload:{height:Math.ceil(document.body.getBoundingClientRect().height)}},'*');new ResizeObserver(size).observe(document.body);addEventListener('load',size);</script></body></html>`;
}
const metric = (label, value) => `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
const reasons = (items) => items.length ? `<ul class="reasons">${items.map((item) => `<li>${escape(item.replaceAll('_', ' ').toLowerCase())}</li>`).join('')}</ul>` : '<p>No blocking issue in the simulated dataset.</p>';
function decisionCard(row, data) {
  const { economics: e, demand: d, risk: r, public_product: p } = row;
  const save = row.status === 'hold' ? '' : button('Select for pilot draft', `Save a pilot draft for task ${data.task_id}, brief revision ${data.brief_revision}, validation ${data.validation_id}, selected_skus ["${row.sku}"], and idempotency_key "${data.validation_id}-${row.sku}". Request platform confirmation before calling save_pilot_draft.`);
  return `<article class="card"><div class="photo">${image(p)}</div><div class="card-content">${badge(statusLabel[row.status],row.status)}<h3>${escape(p.name)}</h3><p>${escape(row.sku)} · <a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">Ashley website snapshot ↗</a></p>${metric('Demand / supply', `${d.searches_per_competing_listing} searches per listing`)}${metric('90-day scenario', `${d.pilot_orders_90d_range[0]}–${d.pilot_orders_90d_range[1]} orders`)}${metric('Contribution / order', `${usd(e.contribution_per_order_usd)} · ${percent(e.contribution_margin)}`)}${metric('Lead time / on-time', `${r.lead_days} days · ${percent(r.supplier_on_time_rate)}`)}${metric('Return / negative reviews', `${percent(riskReturn(row))} · ${percent(r.negative_review_rate)}`)}${metric('Certification', r.certification_status)}${reasons([...row.blockers,...row.conditions])}<details><summary>Calculation and sources</summary><p>Price ${usd(e.assumed_marketplace_price_usd)} − procurement ${usd(e.procurement_usd)} − shipping ${usd(e.outbound_shipping_usd)} − commission ${usd(e.platform_commission_usd)} − platform fee ${usd(e.fixed_platform_fee_usd)} − expected return loss ${usd(e.expected_return_loss_usd)} = ${usd(e.contribution_per_order_usd)}.</p><p>Demand: ${escape(d.source_ids.join(', '))}. Economics: ${escape(e.source_ids.join(', '))}. Risk: ${escape(r.source_id)}. Snapshot date: ${escape(p.collected_at.slice(0,10))}.</p></details><div class="actions">${save}${button('Ask why', `Explain why ${row.sku} has status ${statusLabel[row.status]} using its current evaluation evidence.`)}</div></div></article>`;
}
function riskReturn(row) { return row.economics.expected_return_rate; }

export function renderChannelUI(name, data) {
  if (name === 'run_channel_workflow') {
    return [
      ...renderChannelUI('upsert_channel_brief', data.brief),
      ...renderChannelUI('list_channel_candidates', data.candidates),
      ...renderChannelUI('evaluate_channel_launch', data.evaluation),
    ];
  }
  let html;
  if (name === 'evaluate_channel_launch') {
    html = page('US marketplace pilot candidates', `Brief revision ${data.brief_revision} · ${data.counts.recommend_pilot} recommended · ${data.counts.conditional_pilot} conditional · ${data.counts.hold} on hold`, `<div class="grid">${data.candidates.map((row) => decisionCard(row,data)).join('')}</div>`);
  } else if (name === 'upsert_channel_brief') {
    const b = data.brief;
    html = page('Channel selection brief', `Revision ${data.brief_revision} · US third-party marketplace`, `${metric('Minimum contribution margin',percent(b.min_contribution_margin))}${metric('Maximum lead time',`${b.max_lead_days} days`)}${metric('Minimum pilot stock',`${b.min_pilot_stock} units`)}${metric('Pilot duration',`${b.pilot_days} days`)}<div class="actions">${button('Tighten net margin',`Revise channel task ${data.task_id} from expected_revision ${data.brief_revision}: min_contribution_margin 0.25, then discover and evaluate again.`)}${button('Tighten lead time',`Revise channel task ${data.task_id} from expected_revision ${data.brief_revision}: max_lead_days 20, then discover and evaluate again.`)}</div>`);
  } else if (name === 'list_channel_candidates') {
    html = page('Existing Ashley candidates', `${data.items.length} public product snapshots · candidate set ${data.candidate_set_id}`, `<div class="grid">${data.items.map(({ sku, public_product: p }) => `<article class="card"><div class="photo">${image(p)}</div><div class="card-content"><h3>${escape(p.name)}</h3><p>${escape(sku)} · ${usd(p.list_price_usd)} website list price</p><p><a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">Product source ↗</a></p></div></article>`).join('')}</div>`);
  } else if (name === 'save_pilot_draft' || name === 'get_pilot_draft') {
    html = page('Pilot draft saved', `Draft ${data.draft_id} · revision ${data.brief_revision}`, `<p>Status: saved draft. No real marketplace listing or purchase order was created.</p><p>Selected SKUs: ${escape(data.selected_skus.join(', '))}</p><div class="grid">${data.selections.map((row) => decisionCard(row,{task_id:data.task_id,brief_revision:data.brief_revision,validation_id:data.validation_id})).join('')}</div>`);
  } else return [];
  const id = createHash('sha256').update(html).digest('hex').slice(0,16);
  return [{ type: 'resource', resource: { uri: `ui://ashley-channel/${name}/${id}`, mimeType: 'text/html', text: html } }];
}
