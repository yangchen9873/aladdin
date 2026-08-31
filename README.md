# Aladdin

带工具调用能力的 AI 聊天应用。React 前端 + Hono 后端 + PostgreSQL，LLM 接入基于 [pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai)。

## 环境要求

- Node.js ≥ 22
- pnpm ≥ 11
- PostgreSQL

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化数据库（会删表重建，执行前请备份）
psql "postgresql://postgres:password@127.0.0.1:5432/pi" -f server/sql/init.sql

# 3. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env：DB_*、LLM_*、LLM_CONFIG_ENCRYPTION_KEY

# 4. 启动
pnpm dev
```

- 前端：<http://localhost:5174>
- 后端：<http://localhost:3002>

Vite 开发模式下会将 `/api` 代理到后端。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | 是 | PostgreSQL 连接 |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` | 是 | 未在 Web 保存模型配置时的兜底 |
| `LLM_CONFIG_ENCRYPTION_KEY` | Web 保存配置时 | 模型 API Key 数据库加密密钥，`openssl rand -base64 32` 生成 |
| `PORT` | 否 | 后端端口，默认 `3002` |
| `LLM_BASE_URL` / `LLM_MODEL_ALIAS` | 否 | 自定义网关地址与模型别名 |
| `LLM_THINKING_LEVEL` | 否 | 推理强度，默认 `medium` |

完整示例见 [`server/.env.example`](server/.env.example)。

## 常用命令

```bash
pnpm dev              # 同时启动前后端
pnpm dev:server       # 仅后端
pnpm dev:web          # 仅前端
pnpm typecheck        # TypeScript 检查
pnpm lint             # 前端 ESLint
pnpm format           # Prettier 格式化
```

## 使用说明

1. **模型配置**：侧栏打开模型设置，保存后写入数据库；未配置时使用 `.env` 中的 `LLM_*`。
2. **系统提示词**：可在 Web 界面编辑，作用于每轮对话。
3. **聊天**：选择会话或新建对话，输入消息发送；支持流式回复与工具调用展示。
4. **会话管理**：侧栏可切换、删除会话；消息与审计数据持久化在 PostgreSQL `aladdin` schema。

## 项目结构

```
aladdin/
├── web/                    # React 前端
│   └── src/
│       ├── api/            # 后端 HTTP / SSE 请求封装
│       ├── components/
│       │   ├── chat/       # 消息列表、输入框、Markdown / 代码 / 工具展示
│       │   ├── layout/     # 侧栏、顶栏、设置弹窗
│       │   └── ui/         # 通用 UI 组件
│       ├── hooks/          # 聊天状态、SSE 处理、主题等
│       ├── lib/            # 格式化、常量、纯函数工具
│       ├── styles/         # 主题与全局样式
│       └── types/          # 前端类型定义
├── server/                 # Hono 后端
│   ├── sql/                # PostgreSQL 初始化 DDL
│   └── src/
│       ├── config/         # 环境变量读取与运行时配置
│       ├── routes/         # HTTP 路由（聊天、会话、模型配置等）
│       ├── db/             # 数据库访问层
│       ├── llm/            # pi-ai 运行时、上下文压缩与转换
│       ├── services/       # 聊天流程中的业务逻辑（流式事件、落库协调）
│       ├── tools/          # Agent 可调用的工具（天气、时间等）
│       ├── shared/         # 数据库连接、加解密、压缩等共享模块
│       └── utils/          # SSE、串行队列等基础工具
└── package.json            # monorepo 根脚本
```

开发规范见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
