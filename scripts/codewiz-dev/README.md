# CodeWiz 本地源码调试

该开发启动器通过 LibreChat 原生 Anthropic 自定义端点连接 CodeWiz，不进入生产启动流程，不修改现有 `.env`、Docker 栈或生产配置。要求 Node.js 22.16+、已安装 LibreChat 依赖并完成依赖包构建，以及可用的本地开发 MongoDB。

## 当前状态

2026-09-18 实测：网关可达，本机存在 CodeWiz 会话；真实来源 `librechat-local-dev` 被返回 `adapter.source_denied`（来源未获授权）。必须由网关管理员开通该来源后才能使用；尚未完成真实流式对话、工具调用或 UI 验收。启动器不会伪装成其他客户端或在拒绝后自动重试。

## 使用

先用 `codewiz-cc` 完成登录，然后在仓库根目录执行：

```bash
# 独立检查，会发起一次最多 32 个输出 token 的模型请求
node scripts/codewiz-dev/start.mjs --check

# 检查通过后启动源码后端；使用已有本地开发数据库配置
node scripts/codewiz-dev/start.mjs

# 另一个终端启动前端，模型入口选择 CodeWiz
npm run frontend:dev
```

不要在现有 3080 容器服务运行时启动同端口源码后端。现有容器数据库未暴露宿主端口，不能把 Docker 运行成功视为源码开发栈已经就绪，见 [本地试用环境](../../docs/deployment/local.zh.md)。本次不重启或改写该栈。

启动器从 `~/.cc-mirror/codewiz-cc/session.json` 提取 SSO Cookie，仅通过子进程环境传递，不写入 YAML、命令行参数或日志。配置文件只保存环境变量占位符；不要输出子进程环境或开启请求头调试日志。Cookie 在启动时读取；登录过期后重新登录并重启启动器。

使用独立 `CONFIG_PATH`，保留 `.env` 中的端点开关并添加 `custom`，不合并现有自定义 YAML；需要原有 MCP、品牌或 Agent 配置时先明确合并再使用。模型列表来自本机 CodeWiz 0.0.53 的内置目录，并不代表账户均有权限。

开发选项放在此目录而不新增生产配置 schema：没有修改生产应用行为；端点、请求头、模型列表均使用已有 LibreChat schema。

## 验证

```bash
node --test scripts/codewiz-dev/start.test.mjs
```

测试覆盖凭证提取、请求头注入拒绝、真实来源标识、授权拒绝与错误信息脱敏。网关开通后，还需验证真实多轮、流式与工具调用。
