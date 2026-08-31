-- Aladdin 初始化 DDL（会删表重建，执行前请备份）

CREATE SCHEMA IF NOT EXISTS aladdin;

DROP TABLE IF EXISTS aladdin.tool_calls;
DROP TABLE IF EXISTS aladdin.llm_calls;
DROP TABLE IF EXISTS aladdin.messages;
DROP TABLE IF EXISTS aladdin.conversation_contexts;
DROP TABLE IF EXISTS aladdin.conversations;
DROP TABLE IF EXISTS aladdin.system_prompts;
DROP TABLE IF EXISTS aladdin.model_configurations;

-- 模型连接配置
CREATE TABLE aladdin.model_configurations (
  id uuid PRIMARY KEY,
  kind varchar(16) NOT NULL,
  label varchar(64) NOT NULL,
  provider varchar(32) NOT NULL,
  model varchar(128) NOT NULL,
  api_key varchar(512) NOT NULL,
  base_url varchar(512),
  model_alias varchar(128),
  thinking_level varchar(16) NOT NULL,
  is_active varchar(1) NOT NULL,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.model_configurations IS '模型连接配置。用于保存各用途模型的供应商、密钥与网关参数，供聊天与后续多模态/向量能力选用';
COMMENT ON COLUMN aladdin.model_configurations.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.model_configurations.kind IS '模型用途。枚举：text=文本，multimodal=多模态，embedding=向量化，rerank=重排序';
COMMENT ON COLUMN aladdin.model_configurations.label IS '界面显示名称';
COMMENT ON COLUMN aladdin.model_configurations.provider IS '供应商标识，如 openai、deepseek';
COMMENT ON COLUMN aladdin.model_configurations.model IS '供应商侧模型标识';
COMMENT ON COLUMN aladdin.model_configurations.api_key IS '调用密钥（应用层加密存储）';
COMMENT ON COLUMN aladdin.model_configurations.base_url IS '自定义 API 网关';
COMMENT ON COLUMN aladdin.model_configurations.model_alias IS '网关模型别名';
COMMENT ON COLUMN aladdin.model_configurations.thinking_level IS '推理强度。枚举：off、minimal、low、medium、high、xhigh、max';
COMMENT ON COLUMN aladdin.model_configurations.is_active IS '是否为当前默认配置。枚举：0=否，1=是；同 kind 设为默认时会取消其他默认';
COMMENT ON COLUMN aladdin.model_configurations.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.model_configurations.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.model_configurations.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 系统提示词
CREATE TABLE aladdin.system_prompts (
  id uuid PRIMARY KEY,
  content varchar(4000) NOT NULL,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.system_prompts IS '系统提示词。用于配置聊天助手的全局指令，在每轮对话开始时注入模型上下文';
COMMENT ON COLUMN aladdin.system_prompts.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.system_prompts.content IS '提示词正文';
COMMENT ON COLUMN aladdin.system_prompts.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.system_prompts.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.system_prompts.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 会话
CREATE TABLE aladdin.conversations (
  id uuid PRIMARY KEY,
  title varchar(64) NOT NULL,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.conversations IS '聊天会话。一次会话对应侧边栏中的一条记录，包含多轮用户提问与助手回复';
COMMENT ON COLUMN aladdin.conversations.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.conversations.title IS '标题';
COMMENT ON COLUMN aladdin.conversations.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.conversations.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.conversations.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 续聊上下文快照
CREATE TABLE aladdin.conversation_contexts (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  context_content bytea,
  covered_message_id uuid,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.conversation_contexts IS '续聊上下文快照。每轮结束后追加一条，供下次请求快速恢复模型上下文，不用于页面展示';
COMMENT ON COLUMN aladdin.conversation_contexts.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.conversation_contexts.conversation_id IS '所属会话';
COMMENT ON COLUMN aladdin.conversation_contexts.turn_id IS '生成该快照的对话轮次';
COMMENT ON COLUMN aladdin.conversation_contexts.context_content IS '有界上下文（历史摘要+最近消息），gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.conversation_contexts.covered_message_id IS '快照覆盖到的最后一条消息';
COMMENT ON COLUMN aladdin.conversation_contexts.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.conversation_contexts.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.conversation_contexts.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 消息时间线
CREATE TABLE aladdin.messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  role varchar(16) NOT NULL,
  model varchar(128),
  content bytea,
  thinking bytea,
  tool_calls_content bytea,
  error_message bytea,
  tool_calls_id uuid,
  parent_message_id uuid,
  tool_name varchar(64),
  tool_status varchar(16),
  tool_duration_ms integer,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.messages IS '消息时间线。保存用户、助手与工具摘要消息，供会话页恢复展示；工具完整结果在 tool_calls 表';
COMMENT ON COLUMN aladdin.messages.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.messages.conversation_id IS '所属会话';
COMMENT ON COLUMN aladdin.messages.turn_id IS '所属对话轮次';
COMMENT ON COLUMN aladdin.messages.role IS '消息角色。枚举：user、assistant、tool';
COMMENT ON COLUMN aladdin.messages.model IS '模型名称，用于 assistant 回显';
COMMENT ON COLUMN aladdin.messages.content IS '消息正文，gzip 压缩';
COMMENT ON COLUMN aladdin.messages.thinking IS '助手思考内容，gzip 压缩';
COMMENT ON COLUMN aladdin.messages.tool_calls_content IS 'LLM 返回的工具调用数组，gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.messages.error_message IS '错误信息，gzip 压缩';
COMMENT ON COLUMN aladdin.messages.tool_calls_id IS '关联的工具调用详情';
COMMENT ON COLUMN aladdin.messages.parent_message_id IS '父助手消息';
COMMENT ON COLUMN aladdin.messages.tool_name IS '工具名称';
COMMENT ON COLUMN aladdin.messages.tool_status IS '工具状态。枚举：running、done、error、aborted';
COMMENT ON COLUMN aladdin.messages.tool_duration_ms IS '工具耗时（毫秒）';
COMMENT ON COLUMN aladdin.messages.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.messages.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.messages.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- LLM 调用审计
CREATE TABLE aladdin.llm_calls (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  assistant_message_id uuid NOT NULL,
  provider varchar(32) NOT NULL,
  model varchar(128) NOT NULL,
  thinking_level varchar(16) NOT NULL,
  input_content bytea,
  output_content bytea,
  thinking bytea,
  text_content bytea,
  tool_calls_content bytea,
  status varchar(16) NOT NULL,
  error_message bytea,
  stop_reason varchar(64),
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,
  total_tokens integer,
  cost_input numeric(18, 8),
  cost_output numeric(18, 8),
  cost_cache_read numeric(18, 8),
  cost_cache_write numeric(18, 8),
  cost_total numeric(18, 8),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer,
  ttft_ms integer,
  tps numeric(12, 4),
  cache_ratio numeric(8, 6),
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.llm_calls IS 'LLM 调用审计。记录每轮中的模型请求与重试，用于用量统计、排障与查看器排查';
COMMENT ON COLUMN aladdin.llm_calls.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.llm_calls.conversation_id IS '所属会话';
COMMENT ON COLUMN aladdin.llm_calls.turn_id IS '所属对话轮次';
COMMENT ON COLUMN aladdin.llm_calls.assistant_message_id IS '对应的助手消息';
COMMENT ON COLUMN aladdin.llm_calls.provider IS '模型供应商';
COMMENT ON COLUMN aladdin.llm_calls.model IS '模型标识';
COMMENT ON COLUMN aladdin.llm_calls.thinking_level IS '推理强度。枚举：off、minimal、low、medium、high、xhigh、max';
COMMENT ON COLUMN aladdin.llm_calls.input_content IS '发给模型的完整输入，gzip 压缩';
COMMENT ON COLUMN aladdin.llm_calls.output_content IS '模型完整原始输出，gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.llm_calls.thinking IS '模型思考输出，gzip 压缩';
COMMENT ON COLUMN aladdin.llm_calls.text_content IS '模型正文输出，gzip 压缩';
COMMENT ON COLUMN aladdin.llm_calls.tool_calls_content IS '模型返回的工具调用数组，gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.llm_calls.status IS '调用状态。枚举：running、done、error、aborted；由写入方显式传入';
COMMENT ON COLUMN aladdin.llm_calls.error_message IS '错误信息，gzip 压缩';
COMMENT ON COLUMN aladdin.llm_calls.stop_reason IS '模型停止原因';
COMMENT ON COLUMN aladdin.llm_calls.input_tokens IS '输入 token 数';
COMMENT ON COLUMN aladdin.llm_calls.output_tokens IS '输出 token 数';
COMMENT ON COLUMN aladdin.llm_calls.cache_read_tokens IS '缓存读取 token 数';
COMMENT ON COLUMN aladdin.llm_calls.cache_write_tokens IS '缓存写入 token 数';
COMMENT ON COLUMN aladdin.llm_calls.total_tokens IS '总 token 数';
COMMENT ON COLUMN aladdin.llm_calls.cost_input IS '输入费用';
COMMENT ON COLUMN aladdin.llm_calls.cost_output IS '输出费用';
COMMENT ON COLUMN aladdin.llm_calls.cost_cache_read IS '缓存读取费用';
COMMENT ON COLUMN aladdin.llm_calls.cost_cache_write IS '缓存写入费用';
COMMENT ON COLUMN aladdin.llm_calls.cost_total IS '总费用';
COMMENT ON COLUMN aladdin.llm_calls.started_at IS '调用开始时间；由写入方显式传入';
COMMENT ON COLUMN aladdin.llm_calls.finished_at IS '调用结束时间';
COMMENT ON COLUMN aladdin.llm_calls.duration_ms IS '调用耗时（毫秒）';
COMMENT ON COLUMN aladdin.llm_calls.ttft_ms IS '首 token 延迟（毫秒）';
COMMENT ON COLUMN aladdin.llm_calls.tps IS '输出速度（token/秒）';
COMMENT ON COLUMN aladdin.llm_calls.cache_ratio IS '缓存命中比例，范围 0~1';
COMMENT ON COLUMN aladdin.llm_calls.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.llm_calls.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.llm_calls.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 工具调用审计
CREATE TABLE aladdin.tool_calls (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  assistant_message_id uuid NOT NULL,
  tool_name varchar(64) NOT NULL,
  arguments bytea,
  result_content bytea,
  result_details bytea,
  status varchar(16) NOT NULL,
  error_message bytea,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer,
  create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invalid_flag varchar(1) NOT NULL DEFAULT '0'
);

COMMENT ON TABLE aladdin.tool_calls IS '工具调用审计。保存工具参数、返回结果与执行状态，供前端展示详情和排查工具执行问题';
COMMENT ON COLUMN aladdin.tool_calls.id IS '主键，UUIDv7';
COMMENT ON COLUMN aladdin.tool_calls.conversation_id IS '所属会话';
COMMENT ON COLUMN aladdin.tool_calls.turn_id IS '所属对话轮次';
COMMENT ON COLUMN aladdin.tool_calls.assistant_message_id IS '发起该工具调用的助手消息';
COMMENT ON COLUMN aladdin.tool_calls.tool_name IS '工具名称';
COMMENT ON COLUMN aladdin.tool_calls.arguments IS '工具参数，gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.tool_calls.result_content IS '返回给模型的文本结果，gzip 压缩';
COMMENT ON COLUMN aladdin.tool_calls.result_details IS '供前端展示的结构化结果，gzip 压缩 JSON';
COMMENT ON COLUMN aladdin.tool_calls.status IS '调用状态。枚举：running、done、error、aborted；由写入方显式传入';
COMMENT ON COLUMN aladdin.tool_calls.error_message IS '错误信息，gzip 压缩';
COMMENT ON COLUMN aladdin.tool_calls.started_at IS '开始时间；由写入方显式传入';
COMMENT ON COLUMN aladdin.tool_calls.finished_at IS '结束时间';
COMMENT ON COLUMN aladdin.tool_calls.duration_ms IS '耗时（毫秒）';
COMMENT ON COLUMN aladdin.tool_calls.create_time IS '创建时间';
COMMENT ON COLUMN aladdin.tool_calls.update_time IS '最后更新时间';
COMMENT ON COLUMN aladdin.tool_calls.invalid_flag IS '逻辑删除。枚举：0=有效，1=已删除';

-- 按会话查询
CREATE INDEX conversation_contexts_conversation_id_idx
  ON aladdin.conversation_contexts (conversation_id, id)
  WHERE invalid_flag = '0';

CREATE INDEX messages_conversation_id_idx
  ON aladdin.messages (conversation_id, id)
  WHERE invalid_flag = '0';

CREATE INDEX llm_calls_conversation_id_idx
  ON aladdin.llm_calls (conversation_id, id)
  WHERE invalid_flag = '0';

CREATE INDEX tool_calls_conversation_id_idx
  ON aladdin.tool_calls (conversation_id, id)
  WHERE invalid_flag = '0';
