// Create/update the Ashley trial agent via the same authenticated API as the UI.
import { readFile } from "node:fs/promises";
const base = process.env.LIBRECHAT_URL ?? "http://localhost:3080";
const headers = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
};
async function api(path, method, body) {
  const res = await fetch(base + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("application/json"))
    throw Error(`API request failed: ${res.status} ${path}`);
  return res.json();
}
const token =
  process.env.LIBRECHAT_TOKEN ??
  (
    await api("/api/auth/login", "POST", {
      email: process.env.LIBRECHAT_EMAIL,
      password: process.env.LIBRECHAT_PASSWORD,
    })
  ).token;
if (!token) throw Error("Login did not return a token");
headers.Authorization = "Bearer " + token;
await api("/api/mcp/selection-demo/reinitialize", "POST", {});
const available = (await api("/api/mcp/tools", "GET")).servers?.[
  "selection-demo"
]?.tools?.map((t) => t.pluginKey);
const expected = [
  'run_channel_workflow',
  'get_channel_context', 'upsert_channel_brief', 'scan_market_opportunity',
  'list_channel_candidates', 'get_sku_performance', 'calculate_unit_economics',
  'check_launch_risks', 'evaluate_channel_launch', 'save_pilot_draft', 'get_pilot_draft',
  'search_public_web',
];
const tools = (available ?? []).filter((name) => expected.some((tool) => name === `${tool}_mcp_selection-demo`));
if (tools.length !== expected.length) throw Error(`Expected ${expected.length} channel tools, found ${tools.length}`);
const model = process.env.SELECTION_MODEL ?? "gemini-3.1-pro-preview";
const provider = process.env.SELECTION_PROVIDER ?? 'google';
const nativeSearch = false;
if (process.env.SELECTION_SEARCH_PROVIDER === 'tavily') tools.push('web_search');
const payload = {
  name: "Ashley Assistant",
  category: "general",
  description:
    "Ask anything, research current information, or explore a US marketplace assortment pilot with traceable demo evidence.",
  instructions: await readFile(
    new URL(provider === 'OpenAI-Dev' ? './instructions-local.md' : './instructions.md', import.meta.url),
    "utf8",
  ),
  provider,
  model,
  model_parameters: { model, web_search: nativeSearch },
  tools,
  isPublic: false,
  tool_options: Object.fromEntries(
    tools.map((name) => [name, { describe_intent: true }]),
  ),
  conversation_starters: [
    "Which existing Ashley sofas should we pilot on a US third-party marketplace? Find the strongest opportunities, show what we could earn after returns and platform costs, and flag anything that could derail the launch.",
    "What is contribution margin, and how is it different from gross margin?",
    "Find recent changes in US online furniture shopping and cite your sources.",
  ],
};
const id = process.env.SELECTION_AGENT_ID;
const saved = await api(
  "/api/agents" + (id ? "/" + encodeURIComponent(id) : ""),
  id ? "PATCH" : "POST",
  payload,
);
const avatarData = new FormData();
avatarData.append("file", new Blob([await readFile(new URL("../../branding/ashley/icon.png", import.meta.url))], { type: "image/png" }), "ashley.png");
const avatarResponse = await fetch(base + "/api/files/images/agents/" + encodeURIComponent(saved.id) + "/avatar", {
  method: "POST", headers: { Authorization: headers.Authorization, "User-Agent": headers["User-Agent"] }, body: avatarData,
});
if (!avatarResponse.ok) throw Error(`Avatar upload failed: ${avatarResponse.status} ${(await avatarResponse.text()).slice(0, 300)}`);
const checked = await api("/api/agents/" + encodeURIComponent(saved.id), "GET");
if (
  !checked.avatar?.filepath ||
  checked.instructions !== payload.instructions ||
  checked.tools.length !== tools.length ||
  !tools.every(
    (name) => checked.tool_options?.[name]?.describe_intent === true,
  ) ||
  checked.model !== model ||
  checked.model_parameters?.web_search !== nativeSearch
)
  throw Error("Agent readback mismatch");
console.log(
  JSON.stringify({
    id: checked.id,
    model: checked.model,
    version: checked.version,
    tool_count: checked.tools.length,
  }),
);
