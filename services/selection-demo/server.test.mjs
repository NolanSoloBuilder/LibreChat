import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("MCP authenticates requests, discovers tools, and fails closed on supply outage", async () => {
  const child = spawn(
    process.execPath,
    [new URL("./server.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        DEMO_PORT: "9971",
        DEMO_DB: ":memory:",
        SELECTION_MCP_KEY: "test-only-key",
        DEMO_SUPPLY_FAILURE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("MCP server failed to start");
      }),
    ]);
    const url = "http://127.0.0.1:9971/mcp";
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { Authorization: "Bearer test-only-key" },
        })
      ).status,
      401,
    );
    async function rpc(method, params) {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-only-key",
          "X-User-Id": "test-user",
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      assert.equal(r.status, 200);
      return (await r.json()).result;
    }
    const init = await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "1" },
    });
    assert.equal(init.serverInfo.name, "ashley-selection-demo");
    const listed = (await rpc('tools/list', {})).tools.map((tool) => tool.name);
    assert.equal(listed.length, 17);
    assert.ok(listed.includes('evaluate_channel_launch'));
    assert.ok(listed.includes('search_public_web'));
    assert.ok(!listed.includes('save_selection_draft'));
    assert.ok(listed.includes('get_selection_draft'));
    const context = await rpc("tools/call", {
      name: "get_channel_context",
      arguments: {},
    });
    assert.equal(JSON.parse(context.content[0].text).data_mode, "mock");
    const brief = await rpc('tools/call', {
      name: 'upsert_channel_brief', arguments: { brief: {} },
    });
    const task = JSON.parse(brief.content[0].text);
    const products = await rpc('tools/call', {
      name: 'list_channel_candidates',
      arguments: { task_id: task.task_id, brief_revision: 1 },
    });
    const candidate = JSON.parse(products.content[0].text);
    assert.equal(candidate.items.length, 6);
    assert.equal(products.content[1].resource.mimeType, 'text/html');
    assert.match(products.content[1].resource.text, /Product source/);
    const bad = await rpc("tools/call", {
      name: "check_launch_risks",
      arguments: { task_id: task.task_id, brief_revision: 1, skus: ['ASH-3100438'] },
    });
    assert.equal(bad.isError, true);
    assert.equal(JSON.parse(bad.content[0].text).error, "SUPPLY_UNAVAILABLE");
    const evaluate = await rpc("tools/call", {
      name: "evaluate_channel_launch",
      arguments: { task_id: task.task_id, brief_revision: 1, candidate_set_id: candidate.candidate_set_id },
    });
    assert.equal(evaluate.isError, true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
});
