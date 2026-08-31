# 项目开发规范

## 命名

- React 组件、TypeScript 类型和接口使用 `PascalCase`。
- JavaScript/TypeScript 函数、变量和 Hook 使用 `camelCase`。
- 项目自定义 CSS 类使用带领域语义的 `kebab-case`，例如 `markdown-content`、`modal-overlay`。
- Tailwind 工具类和第三方类名保持其原生写法。

## 代码结构

- 页面组件负责组合和展示，跨组件复用的请求、格式化、状态转换逻辑应下沉到 API、lib、hooks 或 services 模块。
- 一个方法内包含多个业务阶段时，使用空行分隔，并在关键边界添加简短中文注释。
- 不保留已废弃的注释代码；需要兼容旧行为时使用明确的迁移策略。

## 文档

- 所有导出的函数、组件和公共方法使用标准 JSDoc，至少说明用途、参数和返回值。
- 复杂的异步流程、持久化顺序和竞态控制使用中文注释说明原因，而不是重复代码表面行为。

## 提交前检查

```text
pnpm typecheck
pnpm lint
pnpm format:check
git diff --check
```
