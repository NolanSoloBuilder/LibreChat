import { createServer } from "node:http";
import { createRequire } from "node:module";
import { SelectionService, signals } from "./domain.mjs";
import { ChannelService } from "./channel.mjs";
import { needScenarios } from "./research.mjs";
import { renderToolUI } from "./ui.mjs";
import { renderChannelUI } from "./channel-ui.mjs";
import { searchPublicWeb } from "./public-search.mjs";
const require = createRequire(new URL('../../package.json', import.meta.url));
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const svc = new SelectionService(
  process.env.DEMO_DB ?? "/data/selection.sqlite",
);
const channel = new ChannelService(process.env.DEMO_DB ?? "/data/selection.sqlite");
const token = process.env.SELECTION_MCP_KEY;
if (!token) throw Error("SELECTION_MCP_KEY required");
const str = z.string().min(1).max(200),
  rev = z.number().int().positive();
const legacyTools = {
  get_selection_context: {
    description: "Read simulated stores and policies. All enterprise data is synthetic demo data.",
    schema: {},
    run: () => svc.context(),
  },
  upsert_selection_brief: {
    description:
      "Create or revise an assortment brief. A new revision invalidates old validations. budget covers sample procurement and delivery freight; deadline_days is relative to the demo reference date.",
    schema: {
      task_id: str.optional(),
      expected_revision: rev.optional(),
      brief: z.object({
        budget: z.number().positive().optional(),
        deadline_days: z.number().int().positive().optional(),
        store_ids: z.array(z.enum(["A", "B", "C"])).optional(),
        preferences: z.record(z.array(str)).optional(),
        customer_needs: z
          .record(z.array(z.enum(Object.keys(needScenarios))))
          .optional(),
      }),
    },
    run: (o, a) => svc.brief(o, a),
  },
  research_customer_needs: {
    description:
      "Read customer interviews, scenarios, matching criteria and evidence for each store and brief revision. Explicit preferences override scenario answers, which override simulated interviews.",
    schema: { task_id: str, brief_revision: rev },
    run: (o, a) => svc.research(o, a),
  },
  search_market_signals: {
    description: "Search synthetic market observations. These are not live research or sales forecasts.",
    schema: { tags: z.array(str).optional() },
    run: (_, a) =>
      svc.meta({
        signals: signals.filter(
          (s) => !a.tags?.length || a.tags.includes(s.tag),
        ),
      }),
  },
  search_catalog: {
    description:
      "Search official website snapshots and synthetic sofa candidates. For proposals pass task_id and brief_revision and use the returned candidate_set_id. Public facts and simulated business fields are separate. Missing costs cannot pass margin validation. Width is in cm.",
    schema: {
      task_id: str.optional(),
      brief_revision: rev.optional(),
      max_width_cm: z.number().positive().optional(),
      max_price: z.number().positive().optional(),
      tags: z.array(str).optional(),
    },
    run: (o, a) => svc.search(a, o),
  },
  get_supply_availability: {
    description: "Check regional shared stock and delivery lead time for the current brief revision.",
    schema: {
      task_id: str,
      brief_revision: rev,
      skus: z.array(str).min(1).max(100),
    },
    run: (o, a) => {
      if (process.env.DEMO_SUPPLY_FAILURE === "1")
        throw Error("SUPPLY_UNAVAILABLE");
      return svc.supply(o, a);
    },
  },
  evaluate_selection: {
    description:
      "Validate allocations against the current brief. Without allocations, enumerate eligible store combinations from candidate_set_id and propose up to two feasible options. Return calculated budget, margin, sources and validation_id. Preference coverage is not a sales probability.",
    schema: {
      task_id: str,
      brief_revision: rev,
      candidate_set_id: str,
      allocations: z
        .array(
          z.object({
            store_id: z.enum(["A", "B", "C"]),
            sku: str,
            quantity: z.literal(1),
          }),
        )
        .max(6)
        .optional(),
    },
    run: (o, a) => {
      if (process.env.DEMO_SUPPLY_FAILURE === "1")
        throw Error("SUPPLY_UNAVAILABLE");
      return svc.evaluate(o, a);
    },
  },
  save_selection_draft: {
    description:
      "Save a mock draft after the user selects a proposal. Platform approval is required. Use the current brief revision and matching validation_id. No real purchase order is created.",
    schema: {
      task_id: str,
      brief_revision: rev,
      validation_id: str,
      idempotency_key: str,
    },
    run: (o, a) => svc.save(o, a),
  },
  get_selection_draft: {
    description: "Read back a persisted proposal and its sources by draft ID.",
    schema: { draft_id: str },
    run: (o, a) => svc.get(o, a),
  },
};
const channelRef = { task_id: str, brief_revision: rev };
const channelBrief = z.object({
  min_contribution_margin: z.number().min(0).max(1).optional(),
  min_searches_per_listing: z.number().positive().optional(),
  max_lead_days: z.number().int().positive().optional(),
  min_pilot_stock: z.number().int().positive().optional(),
  min_supplier_on_time_rate: z.number().min(0).max(1).optional(),
  max_return_rate: z.number().min(0).max(1).optional(),
  max_negative_review_rate: z.number().min(0).max(1).optional(),
  pilot_days: z.number().int().positive().optional(),
});
const selectedSkus = z.array(str).min(1).max(20);
const channelTools = {
  run_channel_workflow: {
    description: 'Run the full US marketplace discovery workflow for a new or current brief, returning stage evidence and server-side pilot decisions. Best for an open-ended selection request.',
    schema: { task_id: str.optional(), brief_revision: rev.optional() },
    run: (owner, args) => {
      if (process.env.DEMO_SUPPLY_FAILURE === '1') throw Error('SUPPLY_UNAVAILABLE');
      return channel.workflow(owner, args);
    },
  },
  get_channel_context: {
    description: 'Read the US third-party marketplace pilot policy and synthetic-data scope. Use only for assortment questions.',
    schema: {}, run: () => channel.context(),
  },
  upsert_channel_brief: {
    description: 'Create or revise a US marketplace pilot brief. A revision makes old evaluations stale.',
    schema: { task_id: str.optional(), expected_revision: rev.optional(), brief: channelBrief.optional() },
    run: (owner, args) => channel.brief(owner, args),
  },
  scan_market_opportunity: {
    description: 'Compare 90-day simulated marketplace demand, competing listings and 12-month existing-channel orders. This is a scenario, not a sales forecast.',
    schema: channelRef, run: (owner, args) => channel.opportunity(owner, args),
  },
  list_channel_candidates: {
    description: 'List existing Ashley website SKU snapshots for the US marketplace pilot and freeze a candidate set for the current brief.',
    schema: { ...channelRef, skus: selectedSkus.optional() },
    run: (owner, args) => channel.candidates(owner, args),
  },
  get_sku_performance: {
    description: 'Read 12 monthly synthetic existing-channel orders, returns and revenue per SKU. Not marketplace sales.',
    schema: { ...channelRef, skus: selectedSkus },
    run: (owner, args) => channel.performance(owner, args),
  },
  calculate_unit_economics: {
    description: 'Calculate simulated USD contribution after procurement, shipping, marketplace commission, fixed fee and expected return loss.',
    schema: { ...channelRef, skus: selectedSkus },
    run: (owner, args) => channel.economics(owner, args),
  },
  check_launch_risks: {
    description: 'Read simulated lead time, on-time rate, pilot stock, certification evidence and customer review risks.',
    schema: { ...channelRef, skus: selectedSkus },
    run: (owner, args) => {
      if (process.env.DEMO_SUPPLY_FAILURE === '1') throw Error('SUPPLY_UNAVAILABLE');
      return channel.risks(owner, args);
    },
  },
  evaluate_channel_launch: {
    description: 'Server-side three-gate assessment: demand, contribution and launch risk. Requires a current candidate set and returns validation_id.',
    schema: { ...channelRef, candidate_set_id: str },
    run: (owner, args) => {
      if (process.env.DEMO_SUPPLY_FAILURE === '1') throw Error('SUPPLY_UNAVAILABLE');
      return channel.evaluate(owner, args);
    },
  },
  save_pilot_draft: {
    description: 'After explicit user selection and platform approval, save a versioned mock pilot draft. No real order or listing is created.',
    schema: { ...channelRef, validation_id: str, selected_skus: selectedSkus, idempotency_key: str },
    run: (owner, args) => channel.save(owner, args),
  },
  get_pilot_draft: {
    description: 'Read an owner-scoped saved pilot draft by ID.',
    schema: { draft_id: str }, run: (owner, args) => channel.get(owner, args),
  },
};
const legacyReadTools = Object.fromEntries(Object.entries(legacyTools).filter(([name]) =>
  ['get_selection_context', 'research_customer_needs', 'search_market_signals', 'get_supply_availability', 'get_selection_draft'].includes(name),
));
const tools = {
  ...legacyReadTools,
  ...channelTools,
  search_public_web: {
    description: 'Search the current public web with Vertex AI Google Search grounding. Returns exact grounded source links. Use for current or source-dependent questions; never for Ashley private data.',
    schema: { query: z.string().min(3).max(500) },
    run: (_, { query }) => searchPublicWeb(query),
  },
};
const http = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }
  const owner = req.headers["x-user-id"];
  if (typeof owner !== "string" || !owner || owner.includes("{{")) {
    res.writeHead(401);
    res.end();
    return;
  }
  const server = new McpServer({
    name: "ashley-selection-demo",
    version: "1.0.0",
  });
  for (const [name, t] of Object.entries(tools))
    server.registerTool(
      name,
      {
        description: t.description,
        inputSchema: t.schema,
        annotations: {
          readOnlyHint: !['run_channel_workflow', 'upsert_channel_brief', 'evaluate_channel_launch', 'save_pilot_draft', 'list_channel_candidates'].includes(name),
          destructiveHint: false,
          idempotentHint: !['run_channel_workflow', 'upsert_channel_brief', 'evaluate_channel_launch', 'list_channel_candidates'].includes(name),
          openWorldHint: false,
        },
      },
      async (a) => {
        try {
          const data = await t.run(owner, a);
          return {
            content: [
              { type: "text", text: JSON.stringify(data) },
              ...renderToolUI(name, data),
              ...renderChannelUI(name, data),
            ],
          };
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: e.message, data_mode: "mock" }),
              },
            ],
          };
        }
      },
    );
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
http.listen(Number(process.env.DEMO_PORT ?? 9970), "0.0.0.0", () =>
  console.log("selection-demo MCP ready; synthetic data only"),
);
