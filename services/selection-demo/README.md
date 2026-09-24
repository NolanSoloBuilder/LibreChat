# Ashley 选品演示服务

[业务方案](../../docs/ashley-assortment-demo.zh.md)。本目录是独立的本地 mock MCP 服务，不修改 LibreChat API/前端核心；使用固定容器内的 Node 与 MCP SDK。门店、30 个原有商品与 40 条市场观察为合成数据；另加入 29 个 Ashley 官网公开商品快照。公开商品的名称、图片、USD 标价来自官网，5 款含官网尺寸，其余尺寸明确为演示设定，人民币售价、采购、库存、交期和标签仍为模拟，不代表实际经营结论。

## 运行边界

- Ashley 是产品；选品顾问是业务 Agent；OpenAI / GPT-5.6 Luna 是当前本地演示模型。Codewiz 仅在本地配置中承载模型流量。
- 一个 Agent 可用 9 个工具，LibreChat 显示原生工具卡、方案表及人工审批。没有新增 workflow 画布。
- MCP 使用内部密钥和 LibreChat 注入的用户 ID；容器不发布宿主机端口。勿将该接口直接暴露公网或让客户端自报用户 ID。
- SQLite 独立命名卷保存任务、校验和草稿；按用户隔离。仅草稿，不生成真实订单。数据集固定版本，不保证跨天任务、生产并发或真实供应链事务。
- `server.mjs` 的依赖从固定镜像 `/app/package.json` 解析；领域计算可直接用本机 Node 24+ 测试。没有额外安装仓库依赖。

## 接入

复用本机 `data/local-runtime/run.sh` 管理已有栈。可移植配置见 `compose.example.yaml` 与 `librechat.example.yaml`，合并到现有本地配置，保留原模型/服务；不要覆盖生产配置。服务端与 LibreChat 使用同一个 `SELECTION_MCP_KEY`，仅存在忽略的本地 env。

MCP `requiresOAuth: false` 用于内部 Bearer 鉴权。`X-User-Id` 必须保留 `{{LIBRECHAT_USER_ID}}` 模板。审批匹配真实工具名 `save_selection_draft_mcp_selection-demo`，不是 `mcp:server:tool`。查询/计算自动执行，保存必须确认。

Agent 初始化脚本：通过环境提供 `LIBRECHAT_EMAIL`、`LIBRECHAT_PASSWORD`，运行 `node services/selection-demo/provision.mjs`。更新时同时传 `SELECTION_AGENT_ID`，避免创建重复 Agent。可用 `LIBRECHAT_URL`、`SELECTION_PROVIDER`、`SELECTION_MODEL` 覆盖本地默认值。可用 `LIBRECHAT_TOKEN` 复用现有登录令牌，避免重复登录触发限流。脚本完成后读回校验，不以 HTTP 200 代替配置生效。

入口：智能体市场 → 选品顾问 → 开始对话；也可访问 `/c/new?agent_id=<返回的id>`。运行前确认输入框上方是“选品顾问”，而不是普通模型对话。

## 规则与状态

三店默认各 2 个不同 SKU、各 1 件，总共 6 件，区域最多 3 个 SKU。预算是采购加物流；零售价与成本统一为未税 CNY。毛利率 `(零售价-采购-物流)/零售价`，至少 40%；宽度最多 220cm，零售价 4000–8000。

`upsert_selection_brief` 返回 task_id 和递增 brief_revision。修改需求必须带 expected_revision；旧 validation_id 不能保存。`evaluate_selection` 自动枚举合规单品的 2/3 SKU 跨店组合，先按每店偏好去重覆盖数排序，再按成本，第二方案须有不同产品系列。偏好覆盖数是规则分，不是销量预测。库存跨店合计，未知成本不通过校验。

`save_selection_draft` 事务内再次校验，幂等键按用户隔离；重复调用返回同一草稿，冲突键报错。`get_selection_draft` 回读持久化快照。工具顶层 data_mode=mock 表示经营模拟；官网候选的 public_product 保存真实公开字段，provenance 明确字段边界。

## 演示脚本

1. “为华东三店制定沙发上样方案，预算24000元含物流，45天内到店，按默认政策执行。给两套方案，先不要保存。”
2. “改成30天内到店，B店更看重易清洁。重新计算，并说明换了什么、预算变化。”
3. “保存新的第一套方案。”在工具卡审阅参数后确认；应出现真实草稿编号。
4. “重新读取刚才的草稿，核对每店上样与金额。”
5. 可选：“交期改成7天，预算1000元。”应无解，不能擅自放宽。

供应故障演示：仅对 selection-demo 容器设置 `DEMO_SUPPLY_FAILURE=1` 并重建该服务。供应查询与评估都返回 SUPPLY_UNAVAILABLE；移除开关恢复。不改用户聊天、不清空数据库。

## 验证

`node --test services/selection-demo/domain.test.mjs` 验证数量/预算/毛利/共享库存/缺失成本/交期变更/陈旧版本/幂等/用户隔离/SQLite 重开后持久化。运行时审批和模型多步能力必须另做真实对话验收，不能由领域测试替代。

## 兼容性注意

本地 OpenAI 连接内部名称使用 `OpenAI-Dev`，模型展示分组仍是 OpenAI。Agent 指令要求按顺序调用工具：此固定版本组合的并行流式工具调用曾在第三轮提前结束，串行执行已完成真实多步验证。当前 SDK 未透传 `addParams.parallel_tool_calls`，因此不宣称传输层强制串行；后续升级模型/SDK 必须重跑多步验收。不能把这次验收扩大为所有模型的工具兼容性结论。

MCP 协议与故障检查：在现有容器内执行 `data/local-runtime/run.sh exec -T selection-demo node --test /app/services/selection-demo/server.test.mjs`。测试使用独立端口 9971、内存库和临时测试密钥，不碰演示数据。

## 本次运行验收（2026-09-20）

- Agent：`agent_OJebQ4pTRoMaxnz4sboS4`，OpenAI-Dev / gpt-5.6-luna，经本机 Codewiz proxy。
- 完整对话：`/c/d223226f-0a82-4e8b-a2ef-a7893cb56c2b`。首次实际执行 6 个业务工具，生成 15,900 / 16,000 元方案；修改 30 天及 B 店易清洁偏好后，沿用同一 task_id，revision 1 → 2，重新执行 5 个工具，方案为 16,150 / 17,650 元。
- 保存确认前 SQLite 该任务草稿数为 0；原生审批点击通过后为 1。草稿 `4d5545a7-1204-4b47-a834-af777a6593f4`，需求版本 2、草稿版本 1、总额 16,150 元；重启 MCP 容器后通过 Agent 工具读回相同快照，刷新浏览器后表格和回执仍可见。
- 独立无解对话：`/c/96818d42-1bdf-4932-a16b-a4f0f6c61865`，7 天/1000 元，真实工具返回 no_feasible_candidate，未保存、未放宽。
- 领域测试 3 项通过；容器内 MCP 鉴权/发现/供应故障测试 1 项通过；语法检查及 git diff --check 通过。
- `npm run lighthouse` 未完成：宿主机源码依赖未安装，构建前置缺少 rimraf。没有修改前端核心代码，但这不构成性能验收通过。
- 原生审批按钮仍有英文文案。方案自然语言受模型影响，复演时以工具数字/校验结果为准，不将措辞或偏好评分作为真实经营结论。

## 官网数据与对话卡片

`fixtures/ashley-public-products.json` 收录 29 款官网商品（其中 Mahoney、Aviemore、Lavenhorne、Maggie、Santorine 含详细尺寸），保留 official_sku、来源 URL、采集时间、美元标价、英寸及换算厘米、官方 CDN 图片。采集只摘录事实，不复制营销描述。标价与地区/日期有关，不能用于推算中国采购价。官网 403 或字段缺失时不补造数据，也不绕过访问限制。

刷新：`python3 services/selection-demo/collect-public-catalog.py`。可用 `--category-html <已取得的官网分类HTML>` 提供已采集分类页；产品页仍重新获取。至少三条成功才按官方 SKU 合并更新快照，失败保留旧文件。刷新后重启 selection-demo 并复跑测试。当前初始快照结合成功的 JSON-LD 读取和公开页面读回，部分记录没有原始 HTML 哈希，collection_method 明确说明；不声称每次对话实时爬取。

官网商品使用 `ASH-<官方SKU>`，保留已有 SF SKU 含义与历史草稿。官网候选排在前面；筛选 tags=["官网商品"] 可单独查看。经营数字为独立模拟，不从美元价换算。真实宽度参与硬约束，因此超宽商品能被实际排除。

`ui.mjs` 根据工具名和结构化返回生成受沙箱保护的 MCP UI HTML 资源：商品图片横向轮播、市场观察卡、供应校验行。执行期间可展开工具步骤查看已返回的卡片；Agent 完成全部工具后，在最终回复按原样输出 UI Resource Marker。当前模型中途输出标记曾提前结束回合，因此不宣称自动展开的逐步流式卡片。扩展步骤时增加对应 renderToolUI 分支；业务计算仍在 domain.mjs，不由 HTML 或模型计算。没有要求模型生成任意 HTML。

“实时”范围是每个工具实际返回后显示结果；没有单次 HTTP 查询内部的流式进度。历史资源随会话附件保存。图片引用官网 CDN，网络或远端访问限制可能导致加载失败；合成商品借用官网参考图，不宣称对应 SKU 实拍。图片来源限官方 HTTPS 域，文本 HTML 转义。

验证：`node --test services/selection-demo/domain.test.mjs services/selection-demo/ui.test.mjs`；容器内另跑 server.test.mjs。浏览器对话验收单独记录，不将单测作为图片/轮播视觉验收。


### 官网卡片验收

- 新对话 `/c/0ab13b4a-642d-481f-8ad2-944df20d64b7` 在一个回合顺序完成 6 个工具，输出三类卡片和两套方案（15,900 / 16,000 元），未保存。
- 浏览器实际显示 Mahoney、Aviemore、Santorine 官网图片；轮播键盘 Enter 切换生效。卡片通过 MCP `ui-size-change` 上报高度，供应列表内部滚动，避免把全部 SKU 铺成长页面。
- 领域 3 项、UI 来源与转义 2 项、容器 MCP 1 项测试通过。图片依赖外网，失败会明确展示加载失败；不承诺持续可用。
- 当前默认偏好推荐仍可能选中合成 SF 商品。公开 ASH 商品真实进入候选及约束计算，但没有为了展示图片而强制篡改推荐排序。官网来源、模拟经营字段和最终推荐是独立概念。


## 需求调研到商品匹配

新工具 `research_customer_needs` 读取当前任务版本，对每店返回客群、调研观察、用户提供的使用场景、匹配标准及 evidence_id。`research.mjs` 是调研到匹配的唯一映射；`evaluate_selection` 复用同一映射，商品行返回 matched_evidence 与 unmet_preferences。按每店两件商品去重覆盖的需求数量排序，再比较区域成本，预算/毛利/交期/尺寸/共享库存仍为硬约束。

优先级：明确 preferences → 用户 customer_needs 场景 → 默认模拟门店访谈。场景支持有儿童、有宠物、小户型、租住、经常会客、改善换新、控制花费。缺少关键客群信息且未授权默认时，一次询问主要人群、空间、场景和优先需求；已有输入就继续。修改需求后递增版本，重新调研并计算；已有组合仍满足时，不强行换商品。

官网商品 29 款，自建商品 30 款，总计 59 款。分类页快照导入：`python3 services/selection-demo/import-public-listing.py <已取得的官网HTML>`；按 SKU 合并保留详情事实，缺少尺寸时 public_product.width_cm=null，业务尺寸另列为演示设定。自建 SKU 通过 illustration 配参考图。

卡片移除上一组/下一组，保留横向滑动；主区域展示图片、名称、人民币售价、尺寸、交期，来源折叠，不追加演示提示文案。调研卡片显示每店需求、匹配标准及依据；卡片完成后内嵌汇总，执行期间可展开工具结果查看。

求解时对经营字段完全相同、库存至少六件的官网候选保留三款（区域最多三 SKU），减少等价组合；显式 allocations 仍可校验任何 SKU。该原型不是数万商品的优化引擎。


### 本轮验收

- 对话 `/c/24373ef2-6021-4629-a6b6-6087f7e607e9`：真实执行需求创建 → 调研 → 商品 → 供应 → 求解；卡片图片显示，商品按钮已移除，来源可折叠。
- 同任务将 B 店改为改善换新、优先质感，revision 1→2；研究标准与商品分配一起改变，B 店暖居换为木语/栖木，两套总额为 16,350 / 16,550 元。
- 服务返回 comparison 精确差额，避免模型自行混淆人民币零售价和采购差额；实际对话已纠正首轮自然语言差额错误。模型文字仍以结构化工具数字为准。
- 本轮领域 4 项、UI 3 项、MCP 1 项共 8 项测试通过。历史消息里的卡片是生成时快照，不会随服务升级重写，需新一轮查询查看新版。


### Markdown 输出边界

中文标签使用 `**取舍建议**：正文`，避免 `**取舍建议：**正文`。本地 mdast 解析实测后者保持 text，前者产生 strong；不是 JSON 多转义。Agent 指令已约束标点放在加粗外。已通过消息编辑 API 修复对话 0ab13b4a-642d-481f-8ad2-944df20d64b7 对应文本段，原记录在忽略的本地备份；浏览器读回标签为 STRONG。本次未修改全局 Markdown 解析器，也不宣称提示词能保证所有模型输出格式。


### 正式业务文案

卡片主区域、展开来源、图片 alt、Agent 描述和常规回复不展示“演示数据 / 仅供参考 / 模拟”等说明；保留数据层 provenance、data_mode 和真实来源，不把文案变更等同于真实生产数据接入。需要追问来源时 Agent 如实解释。页脚改为“爱室丽选品工作台”。历史卡片与回复保留原快照，新查询使用新版文案。

正式文案实测：`/c/444596ed-f98b-4181-adb7-d0f1c037f509`，真实查询后只输出查询说明与商品卡片，不附加演示提示。此前长会话验证曾返回 model_rate_limit；新短会话成功，不据此宣称限流问题已根治。

### 卡片排版

卡片 HTML 自身保留上下各 8px 的透明留白，与宿主段落间距共同形成正文节奏；卡内使用 16px 内容留白、20px 区块边距，横向滚动吸附保留同样的 20px 起始边距。高度上报测量完整 body（包含留白），展开来源或图片加载时通过 ResizeObserver 更新，避免底部裁切。历史会话保存的是 HTML 快照，调整作用于重新查询返回的卡片。

## 决策闭环与候选快照

制定方案时 `search_catalog` 必须带 `task_id`、`brief_revision`，将当次返回的 SKU 保存为 SQLite `candidate_sets` 快照，返回 `candidate_set_id`。`evaluate_selection` 必须提供该 ID，并检查任务归属、版本和显式 allocations 是否在范围内；旧版本、其他任务或空候选不能回退到全库。无任务的商品浏览仍支持，但不产生用于求解的快照。

需求卡允许修改预算、交期及分店属性，通过宿主 MCP UI 的 prompt action 发送用户意图，再由 Agent 更新同一任务。需求与校验仍在服务端校验；按钮不直接写库。方案卡展示分店图片、金额、交期、需求合并覆盖及未覆盖点，保存按钮只申请原生人工审批，不跳过审批。

`comparison` 比较同一版本两套方案；`revision_comparison` 比较当前首选方案与最近一个有可行结果的旧需求版本首个可行方案，明确不是用户已选择方案。无解时返回单品排除原因；若其他组合约束有解，返回满足这些约束的最低成本及预算缺口。范围仅限本轮候选。

流程反馈复用原生工具执行状态，启用 `tool_intents` capability 和 Agent 各工具 `describe_intent`，由模型流式输出中文动作说明；卡片另外标明对应步骤已返回。卡片仍在查询结束后统一输出，工具执行期间可展开查看，未新增前端实时流程画布。历史 HTML 快照不会自动刷新。

### 决策闭环验收（2026-09-20）

- 对话 `/c/33154908-2197-45ec-afae-9608af9bbab9`：首轮 6 个工具得到 15,900 / 16,000 元方案；修改 30 天和 B 店易清洁后版本 2 得到 16,150 / 17,650 元，首选相对旧版本 +250 元。
- 浏览器实际编辑需求卡并触发按钮：同一 task 版本 2 → 3，预算 22,000，交期 30 天，B 店易清洁保留；原生工具组在执行期间显示中文 intent。
- 方案按钮触发平台审批，确认前草稿数 0，确认后 1；草稿 `4f1344e1-779a-4db4-baa5-154c0be21158`，草稿版本 1、需求版本 3、采购物流 16,150 元。保存/回读新增确定性回执卡，避免只依赖模型自然语言判断状态。
- 领域 5 项、UI 4 项、MCP 集成 1 项通过；语法与 diff 检查通过。Lighthouse 仍因宿主未安装源码依赖、缺少 rimraf 而未完成，不声称性能验收通过。
- 当前宿主 MCP UI 会把按钮意图包成一条带英文说明的用户消息，审批按钮也保留上游英文。这部分需后续在宿主前端统一文案；服务卡片内业务文案为中文。流程依旧由模型串行编排，非强制状态机。
- 保存回读工具的结构化结果与回执卡已在浏览器展开步骤中核验；工具返回后的模型续写出现长等待，已停止该补充验证。不能把工具成功等同于所有模型回合都低延迟完成。
- 随后的新会话补充回读请求在首次工具调用前返回 `upstream_model_error`；这是当前模型提供方可用性限制，不能归因为只发生在长上下文。主业务链路与 MCP 工具/数据库验收通过，但不宣称上游持续稳定。

### 图片加载修复（2026-09-20）

候选与方案卡片使用离线缩略图，不再由浏览器直接请求官网 4000px 原图。`prepare-images.py` 从固定 catalog 的官方图片 URL 下载、校验证书并使用 macOS sips 压缩；刷新运行 `python3 services/selection-demo/prepare-images.py`，完成后重启 MCP。28 张 JPEG 覆盖当前 59 个商品，最长边 400px，来源 URL 仍保留在商品资料中。

`images.mjs` 只读取 manifest 白名单中的文件，以 data URI 随 HTML 快照存储。卡片 eager 解码，避免横向 iframe 懒加载未触发；新增未准备图片的 SKU 显示“暂无图片”，不会回退为不稳定的外网请求。代价是历史 HTML 包含图片字节：59 款完整卡片测试限制在 1.5MB 内；后续大规模正式商品库应转为受控静态资产服务，不无限扩大内嵌目录。

当前会话 `33154908-2197-45ec-afae-9608af9bbab9` 已定向修复 3 条回复的 213 个图片引用，保留正文、资源 URI 和业务数据；原消息备份在 API 持久卷 `/app/data/selection-image-backup-33154908.json`。其他历史会话仍是旧 HTML 快照，新增卡片自动使用新缩略图。

修复验收：当前对话浏览器读取首组 59 张图片，59 张 complete 且 naturalWidth > 0、0 张失败，最长边 400px；截图显示商品图正常。完整候选 HTML 869,217 字节。领域/UI 10 项及 MCP 集成 1 项通过；git diff --check 通过。Lighthouse 再次因宿主缺少 rimraf 前置依赖未执行成功，不宣称性能预算通过。

### 卡片操作摘要（2026-09-21）

卡片 postMessage payload 新增 `displayText`，保存按钮提交“选择方案N并申请保存”，更新按钮提交业务操作名。`prompt` 中的 task_id、revision、validation_id、idempotency_key 保持原值；详情见 [前端卡片交互](../../client/src/components/MCPUIResource/README.md)。配套前端仅投影显示摘要，旧历史 HTML 仍可通过兼容解析正常显示，不需改写历史业务消息。
