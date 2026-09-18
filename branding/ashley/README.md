# Ashley 企业演示品牌配置

用于本地选品演示的显示层定制，不表示已经接入 Ashley 内部商品、库存或市场数据。

## 配置

在运行环境的 `.env` 设置：

```dotenv
APP_TITLE=ASHLEY｜爱室丽选品工作台
CUSTOM_FOOTER=[Ashley](https://www.ashleyfurniture.com/) · 爱室丽企业演示版
```

将本目录 `librechat.yaml` 挂载到 `/app/librechat.yaml`。如果目标部署已有该配置，合并 `interface` 与 `modelSpecs`，不要覆盖既有工具或模型配置。

当前本地实例在 `data/local-runtime/compose.yaml` 中使用只读挂载：

| 本目录文件 | 容器目标 |
| --- | --- |
| librechat.yaml | /app/librechat.yaml |
| logo.svg | /app/client/dist/assets/logo.svg |
| icon.png | /app/client/dist/assets/ashley-icon.png |
| icon.png | /app/client/dist/assets/favicon-16x16.png |
| icon.png | /app/client/dist/assets/favicon-32x32.png |
| icon.png | /app/client/dist/assets/apple-touch-icon-180x180.png |

图标直接使用官网 180px 原图，浏览器按展示尺寸缩放。配置调整后在仓库根运行 `data/local-runtime/run.sh up -d api`，再刷新网页。默认新对话采用 Ashley 选品助手显示预设，底层继续使用已配置的 Vertex AI Gemini；历史对话不重写。

## 素材来源

- `icon.png`：<https://www.ashleyfurniture.com/apple-touch-icon-180x180.png>
- `logo.svg`：2026-09-18 从 <https://www.ashleyfurniture.com/> 页头 Ashley Furniture 链接内的 SVG 提取。保留标志路径与橙色；文字增加系统深色模式适配。
- 原项目 LICENSE 和开源归属保留；本次替换应用展示品牌，不修改上游软件来源记录。

## 验证

2026-09-18：登录后的配置 API 返回定制标题、页脚与模型预设；HTTP 获取图标与原文件哈希一致；浏览器新对话页实测显示 Ashley 图标、选品助手名称、业务说明和企业演示版页脚，原 LibreChat 宣传页脚已移除。本次仅变更配置及静态素材，无需重建前端。
