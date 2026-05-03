# Photlas 导出数据

用户: {{username}}
导出时间: {{exportedAt}}

此压缩包包含 Photlas 保存的关于您的数据，作为 GDPR（欧盟通用数据保护条例）
第 20 条所规定的数据可携带权行使结果而提供。

## 文件结构

| 文件 / 目录                  | 内容 |
|------------------------------|------|
| `README.md`                  | 本文件（压缩包结构与字段说明） |
| `user.json`                  | 个人资料（昵称、邮箱、语言等） |
| `profile_image.*`            | 头像（已设置时） |
| `photos.json`                | 上传照片的元数据 |
| `photos/`                    | 原始照片文件（`{photoId}.{扩展名}`） |
| `favorites.json`             | 收藏的照片 |
| `sns_links.json`             | 个人资料中的社交链接 |
| `oauth.json`                 | OAuth 关联（Google / LINE 等） |
| `reports.json`               | 您提交的举报记录 |
| `sanctions.json`             | 账号处分记录（已剔除管理员自由备注） |
| `violations.json`            | 违规记录（已剔除管理员自由备注） |
| `location_suggestions.json`  | 您提交的地点纠正建议 |
| `spots.json`                 | 您创建的拍摄地点 |
| `errors.json`                | 下载错误日志（无错误时为空数组） |
| `_complete.flag`             | 压缩包完整性标记（存在即视为完整） |

## 主要字段说明

### `photos.json` 的 `moderationStatus`
- `1001` = PENDING_REVIEW（待审）
- `1002` = PUBLISHED（已发布）
- `1003` = QUARANTINED（隔离）
- `1004` = REMOVED（已删除）— 不包含图像本体

### 时间格式
- 所有 JSON 文件中的时间均为 **UTC** ISO 8601 格式（结尾为 `Z`，例如 `2026-03-10T05:30:00Z`）。
- 仅此文件与通知邮件按您注册语言对应的本地时区显示时间。

## 重要提示

- 此压缩包包含个人信息（邮箱、拍摄位置、设备信息等），与他人共享时请务必谨慎。
- 若压缩包中缺少 `_complete.flag`，下载可能在中途中断，请重新申请。
- REMOVED 状态的照片仅保留元数据，不再重新分发图像本体。
- 如有疑问或需要追加披露信息，请联系 support@photlas.jp。
