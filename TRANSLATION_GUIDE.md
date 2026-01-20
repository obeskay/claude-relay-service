// Translation Guide: analysis_sub2api/backend/internal/config/config.go

// Line 26:
// OLD: 连接池隔离策略常量
// NEW: Connection pool isolation policy constants

// Line 27:
// OLD: 用于控制上游 HTTP 连接池的隔离粒度，影响连接复用和资源消耗
// NEW: Controls upstream HTTP connection pool isolation granularity, affects connection reuse and resource consumption

// Line 29:
// OLD: ConnectionPoolIsolationProxy: 按代理隔离
// NEW: ConnectionPoolIsolationProxy: Isolation by proxy

// Line 30:
// OLD: 同一代理地址共享连接池，适合代理数量少、账户数量多的场景
// NEW: Same proxy address shares connection pool, suitable for scenarios with few proxies and many accounts

// Line 32:
// OLD: ConnectionPoolIsolationAccount: 按账户隔离
// NEW: ConnectionPoolIsolationAccount: Isolation by account

// Line 33:
// OLD: 每个账户独立连接池，适合账户数量少、需要严格隔离的场景
// NEW: Each account has independent connection pool, suitable for scenarios with few accounts requiring strict isolation

// Line 35:
// OLD: ConnectionPoolIsolationAccountProxy: 按账户+代理组合隔离（默认）
// NEW: ConnectionPoolIsolationAccountProxy: Isolation by account+proxy combination (default)

// Line 36:
// OLD: 同一账户+代理组合共享连接池，提供最细粒度的隔离
// NEW: Same account+proxy combo shares connection pool, provides finest-grained isolation

// Line 90:
// OLD: ProxyURL 用于访问 GitHub 的代理地址
// NEW: ProxyURL for accessing GitHub (proxy address)

// Line 109:
// OLD: 可选：用于从 userinfo JSON 中提取字段的 gjson 路径。
// NEW: Optional: gjson path for extracting fields from userinfo JSON

// Line 212:
// OLD: 请求体最大字节数，用于网关请求体大小限制
// NEW: Maximum request body size in bytes, used for gateway request body size limit

// Line 214:
// OLD: ConnectionPoolIsolation: 上游连接池隔离策略（proxy/account/account_proxy）
// NEW: ConnectionPoolIsolation: Upstream connection pool isolation policy (proxy/account/account_proxy)

// Line 217:
// OLD: HTTP 上游连接池配置（性能优化：支持高并发场景调优）
// NEW: HTTP upstream connection pool configuration (performance optimization: supports high-concurrency tuning)

// Line 220:
// OLD: MaxIdleConns: 每个主机的最大空闲连接数（关键参数，影响连接复用率）
// NEW: MaxIdleConns: Maximum idle connections per host (key parameter, affects connection reuse rate)

// Line 222:
// OLD: MaxConnsPerHost: 每个主机的最大连接数（包括活跃+空闲），0表示无限制
// NEW: MaxConnsPerHost: Maximum connections per host (active + idle), 0 means no limit

// Line 226:
// OLD: MaxUpstreamClients: 上游连接池客户端最大缓存数量
// NEW: MaxUpstreamClients: Maximum number of upstream connection pool clients cached

// Line 227:
// OLD: 当使用连接池隔离策略时，系统会为不同的账户/代理组合创建独立的 HTTP 客户端
// NEW: When using connection pool isolation, system creates independent HTTP clients for different account/proxy combinations

// Line 231:
// OLD: ClientIdleTTLSeconds: 上游连接池客户端空闲回收阈值（秒）
// NEW: ClientIdleTTLSeconds: Upstream connection pool client idle reclaim threshold (seconds)

// Line 239:
// OLD: 用于 Anthropic OAuth/SetupToken 账号的会话数量限制功能
// NEW: Used for Anthropic OAuth/SetupToken account session count limit feature

// Line 255:
// OLD: API-key 账号在客户端未提供 anthropic-beta 时，是否按需自动补齐（默认关闭以保持兼容）
// NEW: Whether to auto-supply anthropic-beta header when client doesn't provide it for API-key accounts (disabled by default to maintain compatibility)

// Other translations needed:
// - "混合调度模式" -> "Hybrid Scheduling Mode"
// - "专用于" -> "Dedicated for"
// - "已知问题" -> "Known Issues"
// - "变通方法" -> "Workaround"
// - "简单模式" -> "Simple Mode"
// - "差异" -> "Difference"
// - "启用" -> "Enable"
// - "注意" -> "Note"
// - "配置" -> "Configuration"
// - "集成" -> "Integration"
