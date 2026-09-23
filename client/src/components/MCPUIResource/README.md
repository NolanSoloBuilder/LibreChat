# MCP UI 卡片交互

`Renderer.tsx` 只承载受沙箱保护的 HTML 资源。点击动作仍由 `handleUIAction` 进入原有提交链路；工具审批、服务端校验不因显示层改变而跳过。

卡片可在 action payload 中附带 `displayText`（1–256 字符的业务表达）。宿主将完整 action 和 displayText 一起序列化保存；模型得到原始参数，用户消息渲染、复制、导航预览、引用展示使用摘要。动作消息不提供普通文本编辑入口，用户应从卡片重新操作。没有新增浏览器状态或数据库字段，刷新与历史重放使用同一投影函数。

`utils/uiActionPresentation.ts` 同时兼容旧版英文 UI Resource 包装消息；仅匹配完整格式，不扫描或删除普通用户文本中的 ID。Ashley 历史保存操作显示方案编号；修改操作显示预算、交期。未知旧动作只展示“已提交卡片操作”。此投影是展示边界，不是保密机制：原参数仍在消息存储及模型上下文中。

验证：`uiActionPresentation.spec.ts`、`useCopyMessageToClipboard.spec.tsx`、`MessageNav.spec.tsx`；本地前端构建挂载至 API 的 `/app/client/dist` 后，验证当前历史对话与新动作。升级容器时须继续挂载定制前端或使用包含它的自建镜像，否则会恢复上游显示。

2026-09-21 验收：前端完整构建和 TypeScript 检查通过；摘要/复制 15 项、消息导航 96 项、服务卡片 5 项测试通过。真实本地历史对话中英文包装数量为 0，“选择方案2并申请保存”气泡显示正常，导航同样使用摘要；未重放保存操作，未新建草稿。

Lighthouse 使用隔离端口 3098 尝试运行，但全局登录准备阶段 locator.click 30 秒超时，未进入性能审计；不视为性能通过。本地 3080 服务健康检查正常。

## 选品卡片主题与选择状态

`Renderer` 对 `ui://ashley-selection/` 资源注入展示桥，使用 ThemeContext.resolvedMode 通过受控 postMessage 同步应用实际主题（包括跟随系统时的变化）；iframe 只接收 parent 消息，保留原 sandbox。主题变化不替换 srcdoc，避免清空表单输入。旧历史 HTML 也会获得同一桥接，无需迁移消息。

`selectionState.ts` 从当前会话已持久化的卡片操作消息推导最近选择，校验 validation_id 必须属于当前方案卡片，不使用 iframe 内存或 localStorage 作为事实源。展示“已选择”与业务“已保存”分离；与选择消息直接对应的助手错误保留选择并提供重试，不伪造草稿保存成功。审批与业务校验保持服务端原链路。

本轮验证：11 项主题桥/沙箱/选择恢复测试、客户端类型检查与构建通过；真实会话验证亮色→深色，以及刷新后方案2选中高亮和“保存未完成”仍在。没有重放保存动作。
