# 本机试用环境

本地入口：`http://localhost:3080`。运行镜像为官方 `v0.8.8-rc3`，不代表当前源码分支已经构建。

## 环境边界

- macOS ARM64，Homebrew 安装 Colima、Docker CLI 和 Compose。
- 专用 Colima profile：`librechat`，2 CPU、6 GiB 内存、20 GiB 虚拟磁盘上限；虚拟磁盘随写入增长。
- 独立 Compose project：`librechat-local`，包含应用、MongoDB、Meilisearch、RAG API、PostgreSQL/pgvector。
- 仅 `127.0.0.1:3080` 暴露给宿主；数据库不发布宿主端口。
- 数据使用 Docker named volumes；没有连接 Alpha 的业务数据库。
- 模型使用与 Alpha 线上相同的 GCP 项目；本机通过既有 gcloud ADC 用户凭据认证，线上使用运行服务账号，两者身份不同。调用会消耗该项目的模型额度。
- 本地配置在 Git 忽略的 `.env` 与 `data/local-runtime/` 内；不上传凭据、登录信息和运行日志。
- 镜像拉取使用 Google 公共缓存绕过本机 Docker Hub 直连故障；应用来自官方 GHCR，RAG 来自 LibreChat registry。运行配置已将所有镜像固定到 digest，记录在本地 `data/local-runtime/images.json`。

## 启停

在仓库根目录执行：

```bash
colima start librechat
data/local-runtime/run.sh up -d
data/local-runtime/run.sh ps
```

停止应用或释放虚拟机内存：

```bash
data/local-runtime/run.sh stop
colima stop librechat
```

`stop` 保留数据。不要执行 `down -v` 或删除 Colima profile，否则可能删除本地数据卷。启动脚本使用独立 Docker CLI 配置，避开旧 Docker Desktop 的失效 credential helper。

## 验证边界

本地试用不包含云部署、TLS、外部备份、SMTP、SSO、定时任务或企业数据集成。应用运行状态、真实模型对话与文档向量检索必须分别验收，不以容器启动代替模型调用成功。

## 2026-09-18 验收结果

- 五个服务已运行；MongoDB、PostgreSQL 健康检查通过。
- 本地管理员注册与登录成功，账户信息保存在受限的 `data/local-runtime/login.json`。
- LibreChat API 调用 Vertex AI `gemini-2.5-flash` 完成真实流式对话，返回“本地连接成功”。
- RAG API 使用 Vertex AI `gemini-embedding-001`，完成虚构中文文本的上传、向量入库和正确内容检索。该项为 RAG API 验收，不等同于浏览器文件上传全流程验收。
- 容器重新创建后，账户和上述对话可以重新登录读取；不依赖临时容器文件系统。
- HTML 和前端 JS/CSS 可访问；本轮未做完整浏览器交互验收。

旧 Alpha 本地配置中的 OpenAI 额度已耗尽，旧 Vertex 项目结算已停用，因此没有继续使用这些旧配置，也没有修改 Alpha。当前仅开放 Google/Agents 入口。

## Codewiz 仅本地开发接入（2026-09-20）

Ashley 是整个产品的品牌（标题、欢迎文案、站点图标和页脚），不作为模型供应商或模型名称。本地默认模型显示 OpenAI / `GPT-5.6 Luna`，底层走 Codewiz；共享发布配置显示 Google / `Gemini 3.1 Pro`，保留原 Google 路由。本地 custom endpoint 内部名为 `OpenAI-Dev`（模型展示分组仍为 OpenAI），不把 Codewiz 作为产品入口。这里的“开发”指本地运行配置，容器仍运行官方镜像。

- 本地 Compose 挂载 `data/local-runtime/librechat-codewiz-dev.yaml`，通过 `host.docker.internal:9960/v1` 访问 Mac 上的 codewiz-proxy。
- Key 在受限的 `data/local-runtime/codewiz-dev.env` 中，由 Compose 注入；不要提交、输出或放入前端。
- 以上目录由 Git 忽略，且 `.dockerignore` 排除了 `/data/local-runtime/` 与 `/scripts/codewiz-dev/`。共享的 `branding/ashley/librechat.yaml` 已修正为真实 Gemini 模型名称；它与默认 Compose、发布 Compose 均未增加 Codewiz，因此正常发布配置不会展示此入口。发布时不要手工复制本地 Compose 或本地配置。
- 自动标题需要同时开启全局 `TITLE_CONVO=true` 和 custom endpoint 的 `titleConvo: true`；本地标题模型固定为已验证的 `gpt-5.6-luna`，与对话共用代理。原本两个开关均关闭，导致对话一直显示 New Chat。开启后新建对话实测自动生成「小户型客厅沙发选择」，并通过对话查询 API 确认标题已持久化；历史 New Chat 不自动批量补写。
- Codewiz 代理需保持运行。当前代理兼容版本声明为 `0.1.99`；Claude 别名存在上游模型映射异常，本地开放经代理真实验证的 10 个模型：OpenAI 的 GPT-5.6 Luna/Terra、Moonshot 的 Kimi K3、DeepSeek V4 Pro/V4.1 Flash、Qwen 3.8 Max/3.8 Flash/3.7 Plus、Zhipu 的 GLM 5.3/5.3 Flash。Qwen 使用 Anthropic 原生协议，其余使用 OpenAI 兼容协议。各端点标题统一交给 OpenAI 端点的 GPT-5.6 Luna。Gemini 代理原生协议尚未接入 LibreChat 自定义端点，本轮不新增；原有 Google 配置保留。新增 9 个模型均通过代理真实非流式请求（200 且有文本）；LibreChat 额外完成 Qwen 3.8 Flash 流式对话及自动标题，浏览器验证了 5 个供应商分组与 Qwen 子列表。其余新增模型尚未逐个完成 LibreChat 端到端及工具调用验收。
- 启动仍使用 `data/local-runtime/run.sh up -d`。关闭本地 Codewiz 接入可恢复 `data/local-runtime/compose.before-codewiz-20260920.yaml` 为本地 `compose.yaml`，然后执行 `data/local-runtime/run.sh up -d --no-deps api`；恢复前检查是否有后续配置改动。

实测本地 GPT 预设经 LibreChat `/api/agents/chat/OpenAI` 请求代理并返回完成事件和 `CODEWIZ_DEV_OK`，响应 sender 为 `GPT-5.6 Luna`。浏览器新对话页保持 Ashley 产品标题、欢迎文案与页脚，模型菜单实际显示 OpenAI 图标和 `GPT-5.6 Luna`。历史对话不重写，旧对话可能仍保留原模型/名称；刷新并新建对话采用新预设。尝试运行仓库要求的 `npm run lighthouse`，因源码依赖尚未安装、缺少 `rimraf` 在构建前置步骤失败；该检查未通过，不能把 API 验证视为页面性能验证。

上游 rc3 存在两个 Meilisearch 旧数据清理用的 MongoDB partial index 创建警告（`$exists: false` 不被接受），本轮未修改上游源码。基本对话与持久化通过；大量历史数据清理/搜索性能仍待单独验证。单进程配置设置 `SCHEDULES_SINGLE_PROCESS=true`，避免调度引擎误判为多副本；定时任务本轮未验收。

## 选品工作流演示

2026-09-20 已新增本地选品顾问与 8 个 mock MCP 工具。入口为智能体市场的“选品顾问”；[实现、启动与验收](../../services/selection-demo/README.md)。MCP 配置、内部密钥与命名数据卷均限本地栈；共享发布配置未启用该服务。

### 本地卡片操作文案定制

2026-09-21 的本地 API 仍使用固定上游镜像，但将宿主 `client/dist` 只读挂载到 `/app/client/dist`，使源码中的卡片动作摘要投影生效。执行 `npm ci --ignore-scripts`、`npm run frontend` 生成产物；重建前端后，将 `branding/ashley/logo.svg` 复制到 `client/dist/assets/logo.svg`，将 `branding/ashley/icon.png` 复制到该 assets 目录的 `ashley-icon.png`、`favicon-16x16.png`、`favicon-32x32.png`、`apple-touch-icon-180x180.png`，确保嵌套品牌文件挂载点存在，再重启 API。不要在服务期间清空挂载中的 dist。回滚可还原本地 `data/local-runtime/compose.before-action-ui.yaml` 后重建 API。

交互合同见 [MCP UI 卡片交互](../../client/src/components/MCPUIResource/README.md)。本次仅改变执行消息的界面投影，原消息及工具审批数据保持不变。

主题/选择状态版本使用独立产物目录 `data/local-runtime/client-next`：在 client 下运行 `npm run build -- --outDir ../data/local-runtime/client-next`，复制上述品牌文件后，将该目录只读挂载至 `/app/client/dist` 并重建 API。当前本地挂载已切换到此目录；后续构建应使用另一个目录完成后再切换，避免覆盖正在服务的产物。切换前配置备份为 `data/local-runtime/compose.before-theme-state.yaml`。
