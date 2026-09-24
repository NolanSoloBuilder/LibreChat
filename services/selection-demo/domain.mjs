import { resolveNeeds, needScenarios } from "./research.mjs";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
export const version = "selection-demo-v1";
export const stores = [
  {
    id: "A",
    name: "Riverside Family Store",
    profile: "Young families",
    preferences: ["Easy to clean", "Durable"],
  },
  {
    id: "B",
    name: "University District Store",
    profile: "Young renters",
    preferences: ["Compact", "Good value"],
  },
  {
    id: "C",
    name: "New Town Living Store",
    profile: "Home upgraders",
    preferences: ["Comfortable", "Refined texture"],
  },
];
const bases = [
  ["Cloud", 210, 5990, 2650, 22, 12, ["Youthful", "Easy to clean", "Comfortable"]],
  ["Skiff", 185, 4590, 1950, 18, 10, ["Youthful", "Compact", "Good value"]],
  ["Woodland", 215, 7290, 3250, 40, 8, ["Refined texture", "Durable", "Comfortable"]],
  ["Arc", 240, 7990, 3500, 50, 20, ["Youthful", "Refined texture"]],
  ["Plain Weave", 205, 6290, null, 25, 6, ["Easy to clean", "Refined texture"]],
  ["Cozy Home", 200, 6490, 2800, 26, 8, ["Easy to clean", "Durable", "Comfortable"]],
  ["Daylight", 190, 4890, 2050, 28, 1, ["Youthful", "Compact", "Good value"]],
  ["Perch", 218, 7590, 3350, 43, 9, ["Refined texture", "Comfortable", "Durable"]],
  ["Stroll", 195, 5590, 2450, 20, 10, ["Youthful", "Compact", "Easy to clean"]],
  ["Clearview", 212, 7990, 3500, 29, 8, ["Refined texture", "Comfortable", "Easy to clean"]],
];
const syntheticCatalog = bases.flatMap((b, i) =>
  Array.from({ length: 3 }, (_, j) => ({
    sku: `SF-${String(i * 3 + j + 1).padStart(3, "0")}`,
    family: b[0],
    name: `${b[0]} ${["Ivory", "Light Gray", "Warm Brown"][j]}`,
    width_cm: b[1] + j * 2,
    retail: b[2] + j * 100,
    cost: b[3] === null ? null : b[3] + j * 100,
    freight: 200,
    lead_days: b[4] + j * 2,
    stock: b[5],
    tags: b[6],
    image_status: "No product photo",
    source_id: `pim-${i * 3 + j + 1}`,
  })),
);
// Public facts are kept separately from simulated enterprise economics.
export const publicSnapshot = JSON.parse(
  readFileSync(
    new URL("./fixtures/ashley-public-products.json", import.meta.url),
    "utf8",
  ),
);
export const catalog = [
  ...publicSnapshot.products.map((p) => ({
    sku: `ASH-${p.official_sku}`,
    family: p.name,
    name: p.name,
    width_cm: p.width_cm ?? 210,
    retail: 7990,
    cost: 3500,
    freight: 200,
    lead_days: 28,
    stock: 8,
    tags: ["Official website product", "Demo candidate"],
    source_id: p.official_sku,
    public_product: p,
    provenance: {
      public: [
        "name",
        "public_product",
        ...(p.width_cm == null ? [] : ["width_cm"]),
      ],
      simulated: [
        "retail",
        "cost",
        "freight",
        "lead_days",
        "stock",
        "tags",
        ...(p.width_cm == null ? ["width_cm"] : []),
      ],
    },
  })),
  ...syntheticCatalog.map((p, i) => ({
    ...p,
    illustration: {
      image:
        publicSnapshot.products[i % publicSnapshot.products.length].images[0],
      source_url:
        publicSnapshot.products[i % publicSnapshot.products.length].source_url,
    },
    provenance: { simulated: ["all"] },
  })),
];
export const signals = Array.from({ length: 40 }, (_, i) => ({
  id: `SIG-${i + 1}`,
  region: "East China",
  category: "Sofas",
  tag: ["Easy to clean", "Compact", "Comfortable", "Refined texture", "Youthful"][i % 5],
  observation: [
    "Easy cleaning was mentioned in simulated interviews",
    "Small-home interviewees favored compact dimensions",
    "Store feedback noted seat depth and comfort",
    "Home upgraders noted material quality",
    "Younger customers favored lighter silhouettes",
  ][i % 5],
  sample_size: 30 + i,
  mentions: 10 + (i % 15),
  source: "Synthetic interviews and store feedback; not real market research",
  as_of: "2026-09-20",
}));
function error(code) {
  throw new Error(code);
}
function hash(x) {
  return createHash("sha256").update(JSON.stringify(x)).digest("hex");
}
export class SelectionService {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS candidate_sets(id TEXT PRIMARY KEY, task TEXT, revision INTEGER, body TEXT); CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, owner TEXT, revision INTEGER, body TEXT); CREATE TABLE IF NOT EXISTS validations(id TEXT PRIMARY KEY, task TEXT, revision INTEGER, body TEXT); CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, task TEXT, revision INTEGER, idem TEXT UNIQUE, body TEXT);",
    );
  }
  close() {
    this.db.close();
  }
  meta(data) {
    return {
      data_mode: "mock",
      dataset_version: version,
      as_of: "2026-09-20",
      currency: "CNY",
      price_basis: "Pre-tax sample procurement cost including delivery freight",
      ...data,
    };
  }
  task(owner, id) {
    const t = this.db
      .prepare("SELECT * FROM tasks WHERE id=? AND owner=?")
      .get(id, owner);
    if (!t) error("TASK_NOT_FOUND");
    return { ...t, brief: JSON.parse(t.body) };
  }
  context() {
    return this.meta({
      stores,
      policy: {
        min_margin: 0.4,
        width_cm: 220,
        retail_min: 4000,
        retail_max: 8000,
        max_distinct_skus: 3,
        quantity_per_store: 2,
      },
      notice: "Enterprise demo data. Budget covers sample procurement and delivery freight, not total retail price.",
    });
  }
  brief(owner, a) {
    const old = a.task_id ? this.task(owner, a.task_id) : null;
    if (old && a.expected_revision !== old.revision) error("STALE_REVISION");
    const b = {
      budget: 24000,
      deadline_days: 45,
      store_ids: ["A", "B", "C"],
      preferences: {},
      customer_needs: {},
      ...old?.brief,
      ...a.brief,
      explicit_fields: [
        ...new Set([
          ...(old?.brief.explicit_fields ?? []),
          ...Object.keys(a.brief ?? {}),
        ]),
      ],
      preferences: { ...old?.brief.preferences, ...a.brief?.preferences },
      customer_needs: {
        ...old?.brief.customer_needs,
        ...a.brief?.customer_needs,
      },
    };
    if (
      !Number.isFinite(b.budget) ||
      b.budget <= 0 ||
      !Number.isInteger(b.deadline_days) ||
      b.deadline_days < 1 ||
      !Array.isArray(b.store_ids) ||
      b.store_ids.length < 1 ||
      new Set(b.store_ids).size !== b.store_ids.length ||
      b.store_ids.some((id) => !stores.some((s) => s.id === id))
    )
      error("INVALID_BRIEF");
    if (
      !b.preferences ||
      typeof b.preferences !== "object" ||
      Object.entries(b.preferences).some(
        ([k, v]) =>
          !b.store_ids.includes(k) ||
          !Array.isArray(v) ||
          v.some((x) => typeof x !== "string" || x.length > 40),
      )
    )
      error("INVALID_PREFERENCES");
    if (
      !b.customer_needs ||
      typeof b.customer_needs !== "object" ||
      Object.entries(b.customer_needs).some(
        ([id, answers]) =>
          !b.store_ids.includes(id) ||
          !Array.isArray(answers) ||
          answers.some((x) => !Object.hasOwn(needScenarios, x)),
      )
    )
      error("INVALID_CUSTOMER_NEEDS");
    const id = old?.id ?? randomUUID(),
      revision = (old?.revision ?? 0) + 1;
    this.db
      .prepare(
        "INSERT INTO tasks VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body",
      )
      .run(id, owner, revision, JSON.stringify(b));
    return this.meta({
      task_id: id,
      brief_revision: revision,
      brief: b,
      state: "collecting",
      notice: "Previous validation and save approval are invalid. Recheck supply and validate again.",
    });
  }
  research(owner, a) {
    const t = this.task(owner, a.task_id);
    if (t.revision !== a.brief_revision) error("STALE_REVISION");
    return this.meta({
      task_id: t.id,
      brief_revision: t.revision,
      profiles: resolveNeeds(t.brief),
      available_scenarios: Object.keys(needScenarios),
      notice: "Explicit customer needs take precedence over simulated interviews. The sample is for demonstration, not market forecasting.",
    });
  }
  search(a, owner) {
    const task = a.task_id ? this.task(owner, a.task_id) : null;
    if (task && task.revision !== a.brief_revision) error("STALE_REVISION");
    const items = catalog.filter(
      (p) =>
        (!a.max_width_cm || p.width_cm <= a.max_width_cm) &&
        (!a.max_price || p.retail <= a.max_price) &&
        (!a.tags?.length || a.tags.some((t) => p.tags.includes(t))),
    );
    const candidate_set_id = task ? randomUUID() : null;
    if (task)
      this.db
        .prepare("INSERT INTO candidate_sets VALUES(?,?,?,?)")
        .run(
          candidate_set_id,
          task.id,
          task.revision,
          JSON.stringify(items.map((p) => p.sku)),
        );
    return this.meta({
      items,
      total_catalog: catalog.length,
      candidate_set_id,
      task_id: task?.id,
      brief_revision: task?.revision,
    });
  }
  supply(owner, a) {
    const t = this.task(owner, a.task_id);
    if (a.brief_revision !== t.revision) error("STALE_REVISION");
    return this.meta({
      brief_revision: t.revision,
      stock_scope: "Regional shared stock; sum quantities across stores",
      items: catalog
        .filter((p) => a.skus.includes(p.sku))
        .map((p) => ({
          sku: p.sku,
          stock: p.stock,
          lead_days: p.lead_days,
          can_arrive: p.lead_days <= t.brief.deadline_days,
          source_id: `erp-${p.sku}`,
        })),
    });
  }
  assess(b, allocations, profiles = resolveNeeds(b)) {
    const reasons = [],
      quantities = {},
      byStore = {};
    let total = 0,
      matches = 0;
    const rows = [];
    for (const a of allocations) {
      const p = catalog.find((x) => x.sku === a.sku);
      if (!p || !b.store_ids.includes(a.store_id) || a.quantity !== 1) {
        reasons.push("INVALID_ALLOCATION");
        continue;
      }
      byStore[a.store_id] ??= [];
      byStore[a.store_id].push(a.sku);
      quantities[p.sku] = (quantities[p.sku] ?? 0) + 1;
      let cost = p.cost === null ? null : p.cost + p.freight,
        margin = cost === null ? null : (p.retail - cost) / p.retail;
      const failures = [];
      if (p.width_cm > 220) failures.push("WIDTH");
      if (p.retail < 4000 || p.retail > 8000) failures.push("RETAIL_RANGE");
      if (cost === null) failures.push("COST_MISSING");
      else total += cost;
      if (margin !== null && margin < 0.4) failures.push("MARGIN");
      if (p.lead_days > b.deadline_days) failures.push("DEADLINE");
      reasons.push(...failures.map((f) => `${p.sku}:${f}`));
      const criteria =
        profiles.find((s) => s.store_id === a.store_id)?.criteria ?? [];
      const matched = p.tags.filter((t) => criteria.some((c) => c.tag === t));

      rows.push({
        ...a,
        name: p.name,
        unit_cost: cost,
        retail: p.retail,
        margin,
        lead_days: p.lead_days,
        matched_preferences: matched,
        matched_evidence: criteria.filter((c) => matched.includes(c.tag)),
        unmet_preferences: criteria
          .filter((c) => !matched.includes(c.tag))
          .map((c) => c.tag),
        failures,
        source_ids: [p.source_id, `erp-${p.sku}`],
      });
    }
    for (const id of b.store_ids) {
      matches += new Set(
        rows
          .filter((r) => r.store_id === id)
          .flatMap((r) => r.matched_preferences),
      ).size;
      if (byStore[id]?.length !== 2 || new Set(byStore[id]).size !== 2)
        reasons.push(`${id}:REQUIRES_TWO_DISTINCT_SKUS`);
    }
    if (Object.keys(quantities).length > 3) reasons.push("MAX_THREE_SKUS");
    for (const [sku, n] of Object.entries(quantities)) {
      if (n > catalog.find((p) => p.sku === sku).stock)
        reasons.push(`${sku}:SHARED_STOCK`);
    }
    if (total > b.budget) reasons.push("BUDGET");
    return {
      valid: reasons.length === 0,
      reasons,
      total_cost: total,
      remaining_budget: b.budget - total,
      preference_matches: matches,
      rows,
      allocations,
    };
  }
  evaluate(owner, a) {
    const t = this.task(owner, a.task_id);
    if (t.revision !== a.brief_revision) error("STALE_REVISION");
    const snapshot = this.db
      .prepare(
        "SELECT * FROM candidate_sets WHERE id=? AND task=? AND revision=?",
      )
      .get(a.candidate_set_id ?? "", t.id, t.revision);
    if (!snapshot) error("CANDIDATE_SET_REQUIRED_OR_STALE");
    const candidateSkus = JSON.parse(snapshot.body);
    if (a.allocations?.some((r) => !candidateSkus.includes(r.sku)))
      error("SKU_OUTSIDE_CANDIDATE_SET");
    const previous = this.db
      .prepare(
        "SELECT revision, body FROM validations WHERE task=? AND revision<? ORDER BY revision DESC, rowid ASC",
      )
      .all(t.id, t.revision)
      .map((v) => ({ revision: v.revision, ...JSON.parse(v.body) }))
      .find((v) => v.valid);
    const profiles = resolveNeeds(t.brief);
    let minimumCost = null;
    let results = [];
    if (a.allocations)
      results = [this.assess(t.brief, a.allocations, profiles)];
    else {
      const eligible = catalog.filter(
        (p) =>
          candidateSkus.includes(p.sku) &&
          p.width_cm <= 220 &&
          p.cost !== null &&
          p.lead_days <= t.brief.deadline_days &&
          p.stock > 0 &&
          p.retail >= 4000 &&
          p.retail <= 8000 &&
          (p.retail - p.cost - p.freight) / p.retail >= 0.4,
      );
      const equivalent = new Map();
      const candidates = eligible.filter((p) => {
        if (!p.public_product || p.stock < 6) return true;
        const key = JSON.stringify([
          p.retail,
          p.cost,
          p.freight,
          p.lead_days,
          p.tags,
          p.stock,
        ]);
        const count = equivalent.get(key) ?? 0;
        equivalent.set(key, count + 1);
        return count < 3;
      });
      const checkSet = (set) => {
        const walk = (i, alloc) => {
          if (i === t.brief.store_ids.length) {
            const r = this.assess(t.brief, alloc, profiles);
            if (r.reasons.every((reason) => reason === "BUDGET"))
              minimumCost = Math.min(minimumCost ?? Infinity, r.total_cost);
            if (r.valid) results.push(r);
            return;
          }
          for (let x = 0; x < set.length; x++)
            for (let y = x + 1; y < set.length; y++)
              walk(i + 1, [
                ...alloc,
                {
                  store_id: t.brief.store_ids[i],
                  sku: set[x].sku,
                  quantity: 1,
                },
                {
                  store_id: t.brief.store_ids[i],
                  sku: set[y].sku,
                  quantity: 1,
                },
              ]);
        };
        walk(0, []);
      };
      for (let x = 0; x < candidates.length; x++)
        for (let y = x + 1; y < candidates.length; y++) {
          checkSet([candidates[x], candidates[y]]);
          for (let z = y + 1; z < candidates.length; z++)
            checkSet([candidates[x], candidates[y], candidates[z]]);
        }
      results.sort(
        (x, y) =>
          y.preference_matches - x.preference_matches ||
          x.total_cost - y.total_cost,
      );
      const selected = [];
      for (const r of results) {
        if (
          selected.every(
            (s) =>
              JSON.stringify(
                [
                  ...new Set(
                    s.allocations.map(
                      (a) => catalog.find((p) => p.sku === a.sku).family,
                    ),
                  ),
                ].sort(),
              ) !==
              JSON.stringify(
                [
                  ...new Set(
                    r.allocations.map(
                      (a) => catalog.find((p) => p.sku === a.sku).family,
                    ),
                  ),
                ].sort(),
              ),
          )
        )
          selected.push(r);
        if (selected.length === 2) break;
      }
      results = selected;
    }
    const proposals = results.map((r) => {
      const id = randomUUID();
      this.db
        .prepare("INSERT INTO validations VALUES(?,?,?,?)")
        .run(id, t.id, t.revision, JSON.stringify(r));
      return { validation_id: id, ...r };
    });
    return this.meta({
      task_id: t.id,
      brief_revision: t.revision,
      research_profiles: profiles,
      brief: t.brief,
      candidate_set_id: a.candidate_set_id,
      candidate_count: candidateSkus.length,
      diagnostics: {
        minimum_cost_with_other_constraints: minimumCost,
        over_budget_by:
          minimumCost === null
            ? null
            : Math.max(0, minimumCost - t.brief.budget),
        candidate_failures: candidateSkus
          .map((sku) => catalog.find((p) => p.sku === sku))
          .filter(Boolean)
          .map((p) => ({
            sku: p.sku,
            reasons: [
              ...(p.cost === null ? ["Cost missing"] : []),
              ...(p.lead_days > t.brief.deadline_days ? ["Lead time exceeded"] : []),
              ...(p.width_cm > 220 ? ["Width limit exceeded"] : []),
              ...(p.stock < 1 ? ["Out of stock"] : []),
              ...(p.retail < 4000 || p.retail > 8000 ? ["Retail price out of range"] : []),
              ...(p.cost !== null &&
              (p.retail - p.cost - p.freight) / p.retail < 0.4
                ? ["Margin below minimum"]
                : []),
            ],
          }))
          .filter((p) => p.reasons.length),
      },
      revision_comparison:
        previous && proposals[0]?.valid
          ? {
              baseline: "First feasible proposal from the previous brief revision",
              previous_revision: previous.revision,
              total_cost_delta: proposals[0].total_cost - previous.total_cost,
              preference_matches_delta:
                proposals[0].preference_matches - previous.preference_matches,
              store_changes: [
                ...new Set([
                  ...previous.rows.map((r) => r.store_id),
                  ...t.brief.store_ids,
                ]),
              ].map((store_id) => {
                const before = previous.rows.filter(
                  (r) => r.store_id === store_id,
                );
                const after = proposals[0].rows.filter(
                  (r) => r.store_id === store_id,
                );
                return {
                  store_id,
                  removed: before.filter(
                    (r) => !after.some((x) => x.sku === r.sku),
                  ),
                  added: after.filter(
                    (r) => !before.some((x) => x.sku === r.sku),
                  ),
                  procurement_delta:
                    after.reduce((n, r) => n + r.unit_cost, 0) -
                    before.reduce((n, r) => n + r.unit_cost, 0),
                };
              }),
            }
          : null,
      comparison:
        proposals.length === 2
          ? {
              total_cost_delta:
                proposals[1].total_cost - proposals[0].total_cost,
              store_changes: t.brief.store_ids.map((store_id) => {
                const before = proposals[0].rows.filter(
                  (r) => r.store_id === store_id,
                );
                const after = proposals[1].rows.filter(
                  (r) => r.store_id === store_id,
                );
                const removed = before.filter(
                  (r) => !after.some((x) => x.sku === r.sku),
                );
                const added = after.filter(
                  (r) => !before.some((x) => x.sku === r.sku),
                );
                return {
                  store_id,
                  removed_skus: removed.map((r) => r.sku),
                  added_skus: added.map((r) => r.sku),
                  procurement_delta:
                    after.reduce((n, r) => n + r.unit_cost, 0) -
                    before.reduce((n, r) => n + r.unit_cost, 0),
                  retail_delta:
                    after.reduce((n, r) => n + r.retail, 0) -
                    before.reduce((n, r) => n + r.retail, 0),
                };
              }),
            }
          : null,
      proposals,
      ranking:
        "Rank by distinct preference coverage per store, then procurement plus freight; the alternative uses a different product family. This is not a sales forecast.",
      search_scope: "Enumerate two- or three-SKU store allocations within the current candidate snapshot and hard constraints only",
      status: proposals.some((p) => p.valid)
        ? "proposed"
        : "no_feasible_candidate",
      next_action: proposals.length
        ? "Save after the user confirms the specific validation_id"
        : "Explain conflicts and ask whether to adjust constraints; do not relax policy automatically",
    });
  }
  save(owner, a) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const t = this.task(owner, a.task_id);
      const v = this.db
        .prepare("SELECT * FROM validations WHERE id=? AND task=?")
        .get(a.validation_id, t.id);
      if (!v || v.revision !== t.revision || a.brief_revision !== t.revision)
        error("STALE_VALIDATION");
      const validated = JSON.parse(v.body);
      if (!this.assess(t.brief, validated.allocations).valid)
        error("INVALID_SELECTION");
      const idem = hash([owner, a.idempotency_key]);
      const prev = this.db
        .prepare("SELECT * FROM drafts WHERE idem=?")
        .get(idem);
      if (prev) {
        const body = JSON.parse(prev.body);
        if (body.validation_id !== a.validation_id || prev.task !== t.id)
          error("IDEMPOTENCY_CONFLICT");
        this.db.exec("COMMIT");
        return this.meta(body);
      }
      const n =
        this.db.prepare("SELECT COUNT(*) n FROM drafts WHERE task=?").get(t.id)
          .n + 1;
      const body = {
        draft_id: randomUUID(),
        task_id: t.id,
        draft_version: n,
        brief_revision: t.revision,
        validation_id: a.validation_id,
        brief: t.brief,
        selection: validated,
        status: "draft",
        created_at: new Date().toISOString(),
        notice: "Mock assortment draft; no purchase order created",
      };
      this.db
        .prepare("INSERT INTO drafts VALUES(?,?,?,?,?)")
        .run(body.draft_id, t.id, n, idem, JSON.stringify(body));
      this.db.exec("COMMIT");
      return this.meta(body);
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(owner, a) {
    const row = this.db
      .prepare(
        "SELECT d.body FROM drafts d JOIN tasks t ON t.id=d.task WHERE d.id=? AND t.owner=?",
      )
      .get(a.draft_id, owner);
    if (!row) error("DRAFT_NOT_FOUND");
    return this.meta(JSON.parse(row.body));
  }
}
