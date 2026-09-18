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

上游 rc3 存在两个 Meilisearch 旧数据清理用的 MongoDB partial index 创建警告（`$exists: false` 不被接受），本轮未修改上游源码。基本对话与持久化通过；大量历史数据清理/搜索性能仍待单独验证。单进程配置设置 `SCHEDULES_SINGLE_PROCESS=true`，避免调度引擎误判为多副本；定时任务本轮未验收。
