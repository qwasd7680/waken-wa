# 活动上报说明

本文档说明如何向系统上报活动事件。

## 1. 获取 API Token

1. 访问后台：`/admin`
2. 登录后进入 `API Token` 页面
3. 点击创建 Token
4. 保存弹窗中的完整 Token（只显示一次）

## 2. 上报接口

- 方法：`POST`
- 地址：`/api/activity`
- 鉴权：`Authorization: Bearer <YOUR_TOKEN>`
- 内容类型：`application/json`

### 请求字段

必填字段：

- `device`: 设备名称（如 `MacBook Pro`）
- `process_name`: 进程名称（如 `VS Code`）

可选字段：

- `process_title`: 进程标题
- `metadata`: 扩展 JSON 对象

说明：

- `started_at` / `ended_at` 无需上传，由服务端自动处理时间。
- 同一设备上报新事件时，服务端会自动结束该设备上一条未结束状态。

## 3. curl 示例

```bash
curl -X POST "http://localhost:3000/api/activity" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "MacBook Pro",
    "process_name": "VS Code",
    "process_title": "editing setup-form.tsx",
    "metadata": {
      "source": "manual-test"
    }
  }'
```

## 4. Node.js 示例

```ts
await fetch('http://localhost:3000/api/activity', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    device: 'My PC',
    process_name: 'Chrome',
    process_title: 'Dashboard',
  }),
})
```

## 5. 返回与错误

成功返回：

- HTTP `201`
- `{"success": true, "data": ...}`

常见错误：

- `401`: Token 无效或未启用
- `400`: 缺少必填字段（`device`、`process_name`）
- `500`: 服务端异常

## 6. 快速检查

如果上报失败，请按顺序检查：

1. Token 是否为完整值（不是截断值）
2. 是否带了 `Bearer ` 前缀
3. `device` 与 `process_name` 是否存在
4. Token 是否处于启用状态（后台可切换）

## 7. 一键复制接入配置（Base64）

后台 `设置` 页面提供 **一键复制接入配置（Base64）** 按钮。

复制内容包含：

- 网页配置（名称、简介、头像、历史窗口、文案等）
- Token 列表（含名称、token、启用状态）
- 上报地址（`reportEndpoint`）

可在其他设备中把 Base64 解码为 JSON 使用。

示例（Node.js 解码）：

```ts
const decoded = Buffer.from(base64Text, 'base64').toString('utf8')
const config = JSON.parse(decoded)
console.log(config.token.reportEndpoint)
console.log(config.token.items[0]?.token)
```
