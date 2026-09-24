import test from "node:test";
import assert from "node:assert/strict";
import { SelectionService, catalog, publicSnapshot } from "./domain.mjs";
function evaluate(s, owner, args) {
  const found = s.search(args, owner);
  return s.evaluate(owner, {
    ...args,
    candidate_set_id: found.candidate_set_id,
  });
}
test("feasible plans enforce quantities, pooled stock, money and margins; 30-day revision invalidates old validation", () => {
  const s = new SelectionService(":memory:");
  try {
    const b = s.brief("u", { brief: {} });
    const a = { task_id: b.task_id, brief_revision: b.brief_revision };
    const p = evaluate(s, "u", a).proposals[0];
    assert.ok(p.valid);
    assert.equal(p.rows.length, 6);
    assert.ok(p.total_cost <= 24000);
    assert.ok(p.rows.every((r) => r.margin >= 0.4));
    const d = s.save("u", {
      ...a,
      validation_id: p.validation_id,
      idempotency_key: "one",
    });
    assert.equal(
      s.save("u", {
        ...a,
        validation_id: p.validation_id,
        idempotency_key: "one",
      }).draft_id,
      d.draft_id,
    );
    assert.equal(s.get("u", { draft_id: d.draft_id }).draft_id, d.draft_id);
    assert.throws(
      () => s.get("other", { draft_id: d.draft_id }),
      /DRAFT_NOT_FOUND/,
    );
    const b2 = s.brief("u", {
      task_id: b.task_id,
      expected_revision: 1,
      brief: { deadline_days: 30, preferences: { B: ["Easy to clean"] } },
    });
    assert.throws(
      () =>
        s.save("u", {
          ...a,
          validation_id: p.validation_id,
          idempotency_key: "two",
        }),
      /STALE_VALIDATION/,
    );
    const p2 = evaluate(s, "u", { task_id: b.task_id, brief_revision: 2 })
      .proposals[0];
    assert.ok(p2.valid);
    assert.ok(p2.rows.every((r) => r.lead_days <= 30));
    assert.notDeepEqual(p.allocations, p2.allocations);
    s.brief("u", {
      task_id: b.task_id,
      expected_revision: 2,
      brief: { deadline_days: 7 },
    });
    assert.equal(
      evaluate(s, "u", { task_id: b.task_id, brief_revision: 3 }).proposals
        .length,
      0,
    );
  } finally {
    s.close();
  }
});
test("invalid combinations cannot be saved; costs missing and shared stock are explicit", () => {
  const s = new SelectionService(":memory:");
  try {
    const b = s.brief("u", { brief: {} });
    const a = {
      task_id: b.task_id,
      brief_revision: 1,
      allocations: ["A", "B", "C"].flatMap((store_id) => [
        { store_id, sku: "SF-019", quantity: 1 },
        { store_id, sku: "SF-013", quantity: 1 },
      ]),
    };
    const p = evaluate(s, "u", a).proposals[0];
    assert.equal(p.valid, false);
    assert.ok(p.reasons.some((r) => r.includes("SHARED_STOCK")));
    assert.ok(p.reasons.some((r) => r.includes("COST_MISSING")));
    assert.throws(
      () =>
        s.save("u", {
          ...a,
          validation_id: p.validation_id,
          idempotency_key: "bad",
        }),
      /INVALID_SELECTION/,
    );
    assert.equal(catalog.length, 30 + publicSnapshot.products.length);
    assert.throws(
      () =>
        s.brief("u", { task_id: b.task_id, expected_revision: 3, brief: {} }),
      /STALE_REVISION/,
    );
  } finally {
    s.close();
  }
});

test("saved drafts survive restart and idempotency conflicts cannot overwrite them", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "selection-test-"));
  let s = new SelectionService(join(dir, "test.sqlite"));
  try {
    const b = s.brief("owner", { brief: {} });
    const a = { task_id: b.task_id, brief_revision: 1 };
    const p = evaluate(s, "owner", a).proposals;
    assert.equal(p.length, 2);
    const args = {
      ...a,
      validation_id: p[0].validation_id,
      idempotency_key: "save",
    };
    const draft = s.save("owner", args);
    assert.throws(
      () => s.save("owner", { ...args, validation_id: p[1].validation_id }),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.throws(() => evaluate(s, "outsider", a), /TASK_NOT_FOUND/);
    s.close();
    s = new SelectionService(join(dir, "test.sqlite"));
    assert.deepEqual(
      s.get("owner", { draft_id: draft.draft_id }).selection,
      draft.selection,
    );
    assert.equal(s.save("owner", args).draft_id, draft.draft_id);
    s.brief("owner", {
      task_id: b.task_id,
      expected_revision: 1,
      brief: { budget: 1 },
    });
    assert.equal(
      evaluate(s, "owner", { ...a, brief_revision: 2 }).status,
      "no_feasible_candidate",
    );
  } finally {
    s.close();
    rmSync(dir, { recursive: true });
  }
});

test("customer research changes matching; explicit priorities win and revisions invalidate old research", () => {
  const s = new SelectionService(":memory:");
  try {
    const b = s.brief("u", { brief: {} });
    const a = { task_id: b.task_id, brief_revision: 1 };
    const research = s.research("u", a);
    assert.deepEqual(
      research.profiles
        .find((p) => p.store_id === "B")
        .criteria.map((c) => c.tag),
      ["Compact", "Good value"],
    );
    const first = evaluate(s, "u", a).proposals[0];
    s.brief("u", {
      task_id: b.task_id,
      expected_revision: 1,
      brief: { customer_needs: { B: ["Children at home"] } },
    });
    assert.throws(() => s.research("u", a), /STALE_REVISION/);
    const updated = s.research("u", { ...a, brief_revision: 2 });
    assert.deepEqual(
      updated.profiles
        .find((p) => p.store_id === "B")
        .criteria.map((c) => c.tag),
      ["Easy to clean", "Durable"],
    );
    const second = evaluate(s, "u", { ...a, brief_revision: 2 }).proposals[0];
    assert.notDeepEqual(
      first.rows
        .filter((r) => r.store_id === "B")
        .map((r) => r.matched_preferences),
      second.rows
        .filter((r) => r.store_id === "B")
        .map((r) => r.matched_preferences),
    );
    assert.ok(
      second.rows
        .filter((r) => r.store_id === "B")
        .some((r) =>
          r.matched_evidence.some((e) => e.source === "user_answers"),
        ),
    );
    s.brief("u", {
      task_id: b.task_id,
      expected_revision: 2,
      brief: { preferences: { B: ["Refined texture"] } },
    });
    assert.deepEqual(
      s
        .research("u", { ...a, brief_revision: 3 })
        .profiles.find((p) => p.store_id === "B")
        .criteria.map((c) => c.tag),
      ["Refined texture"],
    );
    assert.notDeepEqual(
      first.allocations,
      evaluate(s, "u", { ...a, brief_revision: 3 }).proposals[0].allocations,
    );
    assert.throws(
      () => s.brief("u", { brief: { customer_needs: { A: ["Unknown scenario"] } } }),
      /INVALID_CUSTOMER_NEEDS/,
    );
  } finally {
    s.close();
  }
});

test("candidate snapshots constrain solving and reject stale, foreign and out-of-scope input", () => {
  const s = new SelectionService(":memory:");
  try {
    const b = s.brief("u", { brief: {} });
    const a = { task_id: b.task_id, brief_revision: 1 };
    assert.throws(() => s.evaluate("u", a), /CANDIDATE_SET_REQUIRED/);
    const found = s.search({ ...a, tags: ["Compact"] }, "u");
    const args = { ...a, candidate_set_id: found.candidate_set_id };
    const first = s.evaluate("u", args);
    assert.ok(first.proposals.length > 0);
    assert.ok(
      first.proposals.every((p) =>
        p.rows.every((r) => found.items.some((x) => x.sku === r.sku)),
      ),
    );
    assert.throws(() => s.search(a, "outsider"), /TASK_NOT_FOUND/);
    assert.throws(
      () =>
        s.evaluate("u", {
          ...args,
          allocations: [{ store_id: "A", sku: "SF-001", quantity: 1 }],
        }),
      /SKU_OUTSIDE_CANDIDATE_SET/,
    );
    const other = s.brief("u", { brief: {} });
    assert.throws(
      () => s.evaluate("u", { ...args, task_id: other.task_id }),
      /CANDIDATE_SET_REQUIRED/,
    );
    s.brief("u", {
      task_id: b.task_id,
      expected_revision: 1,
      brief: { deadline_days: 30, preferences: { B: ["Easy to clean"] } },
    });
    assert.throws(
      () => s.evaluate("u", { ...args, brief_revision: 2 }),
      /CANDIDATE_SET_REQUIRED/,
    );
    const next = evaluate(s, "u", { ...a, brief_revision: 2 });
    assert.equal(next.revision_comparison.previous_revision, 1);
    assert.equal(
      next.revision_comparison.total_cost_delta,
      next.proposals[0].total_cost - first.proposals[0].total_cost,
    );
    assert.equal(
      next.revision_comparison.store_changes.reduce(
        (n, c) => n + c.procurement_delta,
        0,
      ),
      next.revision_comparison.total_cost_delta,
    );
    const empty = s.search(
      { ...a, brief_revision: 2, tags: ["Nonexistent attribute"] },
      "u",
    );
    assert.equal(
      s.evaluate("u", {
        ...a,
        brief_revision: 2,
        candidate_set_id: empty.candidate_set_id,
      }).proposals.length,
      0,
    );
  } finally {
    s.close();
  }
});
