import test from "node:test";
import assert from "node:assert/strict";
import { catalog, publicSnapshot, SelectionService } from "./domain.mjs";
import { renderToolUI } from "./ui.mjs";
test("public product cards preserve source facts and distinguish simulated CNY economics", () => {
  const item = catalog[0];
  const [result] = renderToolUI("search_catalog", { items: [item] });
  assert.match(result.resource.uri, /^ui:\/\//);
  assert.equal(result.resource.mimeType, "text/html");
  assert.ok(result.resource.text.includes(item.public_product.source_url));
  assert.match(result.resource.text, /USD/);
  assert.match(result.resource.text, /Retail price/);
  assert.match(result.resource.text, /<html lang="en">/);
  assert.doesNotMatch(result.resource.text, /[\u3400-\u9fff]/);
  assert.match(result.resource.text, /data:image\/jpeg;base64,/);
  assert.deepEqual(renderToolUI("search_catalog", { items: [item] }), [result]);
  assert.ok(publicSnapshot.products.length >= 20);
});
test("untrusted product text is escaped and non-official image URLs are rejected", () => {
  const item = {
    ...catalog[0],
    name: "<script>attack()</script>",
    public_product: {
      ...catalog[0].public_product,
      images: ["javascript:alert(1)"],
      source_url: "https://evil.example/",
    },
  };
  const html = renderToolUI("search_catalog", { items: [item] })[0].resource
    .text;
  assert.ok(!html.includes("<script>attack()"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("evil.example"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(
    renderToolUI("search_catalog", { items: [] })[0].resource.text,
    /No products match these filters/,
  );
  assert.deepEqual(renderToolUI("unknown", {}), []);
});

test("all synthetic products have reference pictures and catalog has no paging buttons", () => {
  const items = catalog.filter((p) => p.sku.startsWith("SF-"));
  assert.equal(items.length, 30);
  assert.ok(
    items.every((p) =>
      p.illustration.image.startsWith("https://cdn.ashley.com/"),
    ),
  );
  const html = renderToolUI("search_catalog", { items })[0].resource.text;
  assert.ok(!html.includes("data-scroll"));
  assert.ok(!html.includes("上一组"));
  assert.ok(!html.includes("暂无实拍图片"));
  assert.ok(!/demo data|for reference only|simulated|非本 SKU 实拍/.test(html));
});

test("decision cards expose needs, combined coverage, revision deltas and approval intent", () => {
  const s = new SelectionService(":memory:");
  try {
    const brief = s.brief("u", {
      brief: { preferences: { A: ["Easy to clean", "Durable"] } },
    });
    const form = renderToolUI("upsert_selection_brief", brief)[0].resource.text;
    assert.match(form, /Update brief and recalculate/);
    assert.match(form, /Default policy/);
    const args = { task_id: brief.task_id, brief_revision: 1 };
    const found = s.search(args, "u");
    const result = s.evaluate("u", {
      ...args,
      candidate_set_id: found.candidate_set_id,
    });
    const html = renderToolUI("evaluate_selection", result)[0].resource.text;
    assert.match(html, /Select this proposal and request save/);
    assert.ok(html.includes(result.proposals[0].validation_id));
    assert.match(html, /type:'prompt'/);
    const saved = s.save("u", {
      ...args,
      validation_id: result.proposals[0].validation_id,
      idempotency_key: "receipt",
    });
    for (const tool of ["save_selection_draft", "get_selection_draft"]) {
      const receipt = renderToolUI(tool, saved)[0].resource.text;
      assert.match(receipt, /Assortment draft saved/);
      assert.ok(receipt.includes(saved.draft_id));
    }
    assert.ok(!html.includes("Not yet covered: Easy to clean、Durable"));
    assert.ok(!/demo data|for reference only/.test(html));
    s.brief("u", {
      task_id: brief.task_id,
      expected_revision: 1,
      brief: { budget: 1 },
    });
    const next = { ...args, brief_revision: 2 };
    const candidates = s.search(next, "u");
    const none = s.evaluate("u", {
      ...next,
      candidate_set_id: candidates.candidate_set_id,
    });
    const empty = renderToolUI("evaluate_selection", none)[0].resource.text;
    assert.match(empty, /budget gap/);
    assert.ok(!empty.includes('data-prompt="'));
  } finally {
    s.close();
  }
});

test("all catalog pictures are bundled and eager, with bounded total card size", () => {
  const html = renderToolUI("search_catalog", { items: catalog })[0].resource
    .text;
  assert.equal(
    (html.match(/<img src="data:image\/jpeg;base64,/g) ?? []).length,
    catalog.length,
  );
  assert.ok(!html.includes('loading="lazy"'));
  assert.ok(!/<img src="https?:/.test(html));
  assert.ok(Buffer.byteLength(html) < 1_500_000);
});
