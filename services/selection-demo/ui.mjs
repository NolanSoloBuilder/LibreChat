import { createHash } from "node:crypto";
import { catalog } from "./domain.mjs";
import { thumbnailSource } from "./images.mjs";
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  v == null ? "Cost pending" : `¥${Number(v).toLocaleString("en-US")}`;
const pill = (s, cls = "") => `<span class="pill ${cls}">${escape(s)}</span>`;
const action = (label, prompt, displayText = label) =>
  `<button type="button" data-label="${escape(displayText)}" data-prompt="${escape(prompt)}">${escape(label)}</button>`;
const signedMoney = (v) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
const productImage = (sku) => {
  const p = catalog.find((p) => p.sku === sku);
  const url = p?.public_product?.images?.[0] ?? p?.illustration?.image;
  try {
    if (thumbnailSource(url))
      return `<img src="${escape(thumbnailSource(url))}" alt="${escape(p.name)} product image" loading="eager" decoding="async">`;
  } catch {}
  return "";
};
function document(title, subtitle, body, stage = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light dark;--bg:#fff;--ink:#252923;--muted:#677064;--line:#e3e7df;--surface:#f5f6f2;--accent:#315b43;--good:#e8f1e9;--warn:#fff0d7}*{box-sizing:border-box}body{margin:0;padding:8px 0;font:14px/1.5 system-ui,-apple-system,'Arial',sans-serif;color:var(--ink);background:transparent}section{background:var(--bg);border:1px solid var(--line);border-radius:16px;overflow:hidden}header{padding:20px 20px 16px}h2{font-size:18px;line-height:1.4;margin:8px 0}p{margin:5px 0;color:var(--muted);font-size:12px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:1.2px;font-weight:650}.status{float:right;font-size:11px;color:var(--accent)}.track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:20px;padding:0 20px 20px;scrollbar-width:thin}.card{flex:0 0 228px;scroll-snap-align:start;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg)}.content{padding:16px}.content>p:first-child{margin-top:0}.card h3{font-size:15px;line-height:1.5;margin:6px 0 10px}details{margin-top:12px}summary{cursor:pointer;line-height:1.6}.photo{height:156px;background-color:#f3f0e9;display:flex;align-items:center;justify-content:center;color:var(--muted)}.photo img{width:100%;height:100%;object-fit:contain}.image-label{font-size:10px;color:var(--muted);padding:4px 12px;background:var(--surface)}.price{margin:8px 0 12px;font-size:21px;font-weight:650;letter-spacing:-.6px}.meta{display:flex;justify-content:space-between;font-size:12px;padding:5px 0}.pill{display:inline-block;background:var(--surface);border-radius:5px;padding:3px 7px;font-size:11px;margin:4px 4px 0 0}.good{background:var(--good);color:var(--accent)}.warn{background:var(--warn);color:#8b591f}.note{padding:10px 20px;background:var(--surface);border-top:1px solid var(--line);font-size:11px;color:var(--muted)}.summary{display:flex;gap:26px;padding:4px 20px 14px}.summary strong{font-size:24px;display:block;color:var(--ink)}.rows{max-height:320px;overflow-y:auto;padding:0 20px 15px;display:grid;gap:8px}.row{padding:10px 12px;border:1px solid var(--line);border-radius:9px;display:flex;align-items:center;justify-content:space-between;gap:12px}.row small{display:block;color:var(--muted)}.buttons{display:flex;gap:8px;margin-top:10px}button{border:1px solid var(--line);border-radius:8px;padding:6px 12px;background:var(--bg);color:var(--ink);cursor:pointer}button:focus-visible,.track:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.empty{padding:12px 20px 24px}@media(prefers-color-scheme:dark){:root{--bg:#20231f;--ink:#eef1e9;--muted:#aab3a7;--line:#3d443b;--surface:#2c322a;--accent:#a5d5af;--good:#263f2e;--warn:#463827}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
.decision{padding:0 20px 20px;display:grid;gap:16px}.proposal{border:1px solid var(--line);border-radius:12px;padding:16px}.proposal h3{margin:0 0 12px}.metrics{display:flex;flex-wrap:wrap;gap:12px 24px;margin:12px 0}.metrics strong{display:block;font-size:20px}.store{border-top:1px solid var(--line);padding-top:12px;margin-top:16px}.selected{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.selected article{display:flex;gap:12px;align-items:center}.selected img{width:88px;height:72px;object-fit:contain;background:var(--surface);border-radius:8px}.stage{padding:0 20px 16px;color:var(--muted);font-size:12px;line-height:1.8}.stage strong{color:var(--accent)}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}label{display:grid;align-content:start;gap:6px;font-size:12px}input{height:40px;min-width:0;width:100%;font:inherit;padding:9px;border:1px solid var(--line);border-radius:8px;color:var(--ink);background:var(--bg)}button:disabled{opacity:.6;cursor:default}.change{background:var(--surface);padding:12px;border-radius:8px}.change p{font-size:13px}.proposal .warn{display:block;padding:8px;border-radius:6px}
</style></head><body><section aria-label="${escape(title)}"><header><span class="status">● Results ready</span><div class="eyebrow">ASHLEY · Assortment workflow</div><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></header>${stage ? `<nav class="stage" aria-label="Assortment workflow">${["Brief confirmed", "Customer research", "Product screening", "Supply check", "Proposal decision"].map((x) => (x === stage ? `<strong aria-current="step">${x} · complete</strong>` : escape(x))).join(" → ")}</nav>` : ""}${body}</section><script>const send=(prompt,button)=>{button.disabled=true;parent.postMessage({type:'prompt',payload:{prompt,displayText:button.dataset.label||button.textContent}},'*');button.textContent='Sent. See conversation';};document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.prompt,button)));document.querySelectorAll('form[data-task]').forEach(form=>form.querySelector('[data-update]').addEventListener('click',()=>{if(!form.reportValidity())return;const fields=new FormData(form);const preferences={};form.querySelectorAll('[data-store]').forEach(input=>{if(input.value!==input.defaultValue)preferences[input.dataset.store]=input.value.split(/[，,]/).map(s=>s.trim()).filter(Boolean);});send('Revise this assortment task and reevaluate using this brief; do not create a new task: '+JSON.stringify({task_id:form.dataset.task,expected_revision:Number(form.dataset.revision),brief:{budget:Number(fields.get('budget')),deadline_days:Number(fields.get('deadline_days')),preferences}}),form.querySelector('[data-update]'));}));document.querySelectorAll('.photo img,.selected img').forEach(img=>img.addEventListener('error',()=>{const fallback=document.createElement('span');fallback.textContent='No image';img.replaceWith(fallback);}));const reportSize=()=>parent.postMessage({type:'ui-size-change',payload:{height:Math.ceil(document.body.getBoundingClientRect().height)}},'*');new ResizeObserver(reportSize).observe(document.body);addEventListener('load',reportSize);setTimeout(reportSize,100);</script></body></html>`;
}
export function renderToolUI(name, data) {
  let html;
  if (name === "save_selection_draft" || name === "get_selection_draft") {
    html = document(
      "Assortment draft saved",
      `Brief revision ${data.brief_revision} · draft version ${data.draft_version}`,
      `<div class="decision"><div class="metrics"><div><small>Procurement + freight</small><strong>${money(data.selection.total_cost)}</strong></div><div><small>Budget remaining</small><strong>${money(data.selection.remaining_budget)}</strong></div></div><p>Draft ID: ${escape(data.draft_id)}</p><p>Status: saved draft · no purchase order created</p></div>`,
    );
  } else if (name === "upsert_selection_brief") {
    const b = data.brief;
    const source = (key) =>
      b.explicit_fields?.includes(key) ? "Specified by user" : "Default policy";
    html = document(
      "Assortment brief",
      `Brief revision ${data.brief_revision} · edit to recalculate`,
      `<div class="decision"><form data-task="${escape(data.task_id)}" data-revision="${data.brief_revision}"><div class="fields"><label>Procurement + freight budget (CNY) · ${source("budget")}<input name="budget" type="number" min="1" step="any" value="${b.budget}" required></label><label>Delivery deadline (days) · ${source("deadline_days")}<input name="deadline_days" type="number" min="1" step="1" value="${b.deadline_days}" required></label>${b.store_ids.map((id) => `<label>${escape(id)} store priorities (comma separated)<input data-store="${escape(id)}" value="${escape((b.preferences[id] ?? []).join(", "))}" placeholder="Leave blank to use customer research"><span>${escape((b.customer_needs[id] ?? []).join(", ") || "Use store research")}</span></label>`).join("")}</div><p>Two distinct sofas per store, one each · max 3 SKUs region-wide · margin at least 40% · width at most 220 cm · retail CNY 4,000–8,000</p><div class="buttons"><button type="button" data-update>Update brief and recalculate</button></div></form></div>`,
      "Brief confirmed",
    );
  } else if (name === "evaluate_selection") {
    const delta = data.revision_comparison;
    const change = delta
      ? `<div class="change"><strong>Compared with brief revision ${delta.previous_revision} primary proposal</strong><p>Procurement + freight ${signedMoney(delta.total_cost_delta)} · preference coverage change ${delta.preference_matches_delta > 0 ? "+" : ""}${delta.preference_matches_delta}</p>${delta.store_changes.map((c) => `<p>${escape(c.store_id)} store: ${c.removed.length ? `Removed: ${c.removed.map((r) => escape(r.name)).join(", ")}; added: ${c.added.map((r) => escape(r.name)).join(", ") || "none"}` : c.added.length ? `Added: ${c.added.map((r) => escape(r.name)).join(", ")}` : "Products unchanged"} · ${signedMoney(c.procurement_delta)}</p>`).join("")}</div>`
      : "";
    const cards = data.proposals
      .filter((p) => p.valid)
      .map(
        (p, i) =>
          `<article class="proposal"><h3>Proposal ${i + 1}${i === 0 ? " · Recommended" : " · Alternative"}</h3><div class="metrics"><div><small>Procurement + freight</small><strong>${money(p.total_cost)}</strong></div><div><small>Budget remaining</small><strong>${money(p.remaining_budget)}</strong></div><div><small>Latest delivery</small><strong>${Math.max(...p.rows.map((r) => r.lead_days))} days</strong></div></div>${data.research_profiles
            .map((profile) => {
              const rows = p.rows.filter(
                (r) => r.store_id === profile.store_id,
              );
              const matched = [
                ...new Set(rows.flatMap((r) => r.matched_preferences)),
              ];
              const unmet = profile.criteria
                .map((c) => c.tag)
                .filter((t) => !matched.includes(t));
              return `<div class="store"><strong>${escape(profile.store_id)} store · ${money(rows.reduce((n, r) => n + r.unit_cost, 0))}</strong><p>Needs: ${profile.criteria.map((c) => escape(c.tag)).join(", ")} → covered: ${matched.map(escape).join(", ") || "none"}</p><div class="selected">${rows.map((r) => `<article>${productImage(r.sku)}<div><strong>${escape(r.name)}</strong><p>${escape(r.sku)} · ${r.quantity} unit(s)</p><p>Procurement + freight ${money(r.unit_cost)} · Margin ${(r.margin * 100).toFixed(1)}%</p><p>Retail ${money(r.retail)} · ${r.lead_days} days to delivery</p><p>${r.matched_preferences.map(escape).join(", ")}</p></div></article>`).join("")}</div>${unmet.length ? `<p class="warn">Not yet covered: ${unmet.map(escape).join(", ")}</p>` : ""}</div>`;
            })
            .join(
              "",
            )}<div class="buttons">${action("Select this proposal and request save", `Save assortment task ${data.task_id} Brief revision ${data.brief_revision} proposal ${i + 1}, validation_id=${p.validation_id}, idempotency_key=${p.validation_id}. Call the save tool and wait for platform approval.`, `Select proposal ${i + 1} and request save`)}</div></article>`,
      )
      .join("");
    html = document(
      data.status === "proposed" ? "Assortment proposals and tradeoffs" : "No feasible proposal under current constraints",
      `Brief revision ${data.brief_revision} · assessed against ${data.candidate_count} candidates`,
      `<div class="decision">${change}${data.comparison ? `<p>Proposal 2 vs Proposal 1: Procurement + freight ${signedMoney(data.comparison.total_cost_delta)}</p>` : ""}${cards || `<div class="change"><strong>Current candidates cannot meet all constraints</strong><p>Budget ${money(data.brief.budget)} · ${data.brief.deadline_days} days to delivery. Adjust budget, lead time or candidate scope and reevaluate.</p><p>${data.diagnostics?.minimum_cost_with_other_constraints != null ? `Minimum procurement + freight cost under other constraints: ${money(data.diagnostics.minimum_cost_with_other_constraints)}; budget gap: ${money(data.diagnostics.over_budget_by)}.` : ""}</p><p>${[...new Set((data.diagnostics?.candidate_failures ?? []).flatMap((p) => p.reasons))].map((reason) => `${escape(reason)}: ${data.diagnostics.candidate_failures.filter((p) => p.reasons.includes(reason)).length} products`).join(" · ")}</p><p>Constraints were not relaxed automatically and no proposal was saved.</p></div>`}</div>`,
      "Proposal decision",
    );
  } else if (name === "search_catalog") {
    const items = data.items ?? [];
    const cards = items
      .map((p) => {
        const source = p.public_product;
        const url = (source?.images ?? [p.illustration?.image])
          .filter(Boolean)
          .find((u) => {
            try {
              return Boolean(thumbnailSource(u));
            } catch {
              return false;
            }
          });
        const official = source?.source_url?.startsWith(
          "https://www.ashleyfurniture.com/p/",
        )
          ? source.source_url
          : null;
        return `<article class="card"><div class="photo">${url ? `<img src="${escape(thumbnailSource(url))}" alt="${escape(p.name)} product image" loading="eager" decoding="async">` : "No image"}</div><div class="content"><p>${escape(p.sku)}</p><h3>${escape(p.name)}</h3><div class="price">${money(p.retail)} <small style="font-size:11px;font-weight:400">Retail price</small></div><div class="meta"><span>Width ${escape(p.width_cm)} cm</span></div><div class="meta"><span>Delivery lead time</span><span>${escape(p.lead_days)} days</span></div><div class="meta"><span>Procurement + freight</span><span>${money(p.cost == null ? null : p.cost + p.freight)}</span></div>${p.tags
          .filter((t) => !["Official website product", "Demo candidate"].includes(t))
          .map((t) => pill(t))
          .join(
            "",
          )}${p.cost == null ? pill("Cost pending · not eligible", "warn") : ""}${official || p.illustration?.source_url ? `<details><summary>View source</summary><p><a href="${escape(official ?? p.illustration.source_url)}" target="_blank" rel="noopener noreferrer">${source ? "Ashley product page" : "Image source"} ↗</a></p>${source ? `<p>Website list price ${escape(source.public_currency)} ${escape(source.public_price)} · ${escape(source.collected_at.slice(0, 10))}</p>` : ""}</details>` : ""}</div></article>`;
      })
      .join("");
    html = document(
      "Product candidates ready",
      `Found ${items.length} ${items.length === 1 ? "product" : "products"} · scroll horizontally`,
      items.length
        ? `<div class="track" tabindex="0" aria-label="Product image carousel">${cards}</div>`
        : '<div class="empty">No products match these filters. Adjust the criteria.</div>',
      "Product screening",
    );
  } else if (name === "research_customer_needs") {
    html = document(
      "Customer needs and matching criteria",
      `Brief revision ${data.brief_revision} · understand the customer before selecting products`,
      `<div class="track" tabindex="0" aria-label="Customer needs research">${data.profiles.map((p) => `<article class="card"><div class="content">${pill(p.store_id + " store", "good")}<h3>${escape(p.audience)}</h3><p>${p.assumption ? "Initial criteria from store interviews; editable" : "Includes explicit customer needs"}</p>${p.criteria.map((c) => `<div style="margin-top:12px"><strong>${escape(c.tag)}</strong><p>${escape(c.reason)}</p><small>Evidence ${escape(c.evidence_id)}</small></div>`).join("")}<details><summary>Research evidence</summary>${p.evidence.map((e) => `<p>${escape(e.observation)} · ${e.mentions}/${e.sample_size} respondents mentioned this</p>`).join("")}</details></div></article>`).join("")}</div>`,
      "Customer research",
    );
  } else if (name === "search_market_signals") {
    const signals = data.signals ?? [];
    const tags = [...new Set(signals.map((s) => s.tag))];
    html = document(
      "Market observations ready",
      "Interviews and store feedback",
      `<div class="summary"><div><strong>${signals.length}</strong><p>Observation records</p></div><div><strong>${tags.length}</strong><p>Preference themes</p></div></div><div class="track" tabindex="0" aria-label="Market observation cards">${tags
        .map((tag) => {
          const rows = signals.filter((s) => s.tag === tag);
          const s = rows[0];
          return `<article class="card"><div class="content">${pill(tag, "good")}<h3 style="margin-top:10px">${escape(s.observation.replace(/^Simulated /, ""))}</h3><p>${rows.length} observations</p><p>Sample ${s.sample_size} people · mentioned ${s.mentions} times</p><p>Source ${escape(s.id)}</p></div></article>`;
        })
        .join("")}</div>`,
    );
  } else if (name === "get_supply_availability") {
    const items = data.items ?? [];
    const ok = items.filter((p) => p.can_arrive).length;
    html = document(
      "Supply check ready",
      `Brief revision ${data.brief_revision} · regional stock is shared; validate totals across stores`,
      `<div class="summary"><div><strong>${ok}/${items.length}</strong><p>Products meeting deadline</p></div><div><strong>${items.length - ok}</strong><p>Beyond deadline</p></div></div><div class="rows">${items.map((p) => `<div class="row"><div>${escape(catalog.find((x) => x.sku === p.sku)?.name ?? p.sku)}<small>${escape(p.sku)} · Source ${escape(p.source_id)}</small></div><div>${pill(`Stock ${p.stock} unit(s)`)}${pill(`${p.lead_days} days`, p.can_arrive ? "good" : "warn")}</div></div>`).join("")}</div>`,
      "Supply check",
    );
  } else return [];
  const id = createHash("sha256").update(html).digest("hex").slice(0, 16);
  return [
    {
      type: "resource",
      resource: {
        uri: `ui://ashley-selection/${name}/${id}`,
        mimeType: "text/html",
        text: html,
      },
    },
  ];
}
