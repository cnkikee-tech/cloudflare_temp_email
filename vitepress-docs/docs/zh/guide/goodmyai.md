# GoodMyAI 私有部署

- 仓库：cnkikee-tech/cloudflare_temp_email。
- 网页及 API：https://mail.goodmyai.com；管理员入口 `/admin`。
- 收件域名：`goodmyai.com`；Email Routing Catch-all 指向 Worker `goodmyai-mail`。
- 原生 Worker 静态资源模式，前后端同源；专用 D1 为 `goodmyai-mail`。
- 只允许管理员创建地址；禁用公开注册、自动回复和用户删除；未配置清理定时器和地址到期，邮箱不会因临时邮箱定时清理被删除。
- 管理后台自带批量创建（每批 1–100）及导出；邮箱地址和凭证需要持久保管。邮箱访问凭证之外，还须站点访问密码。
- 私密配置保存在部署机 `~/.config/goodmyai-mail/secrets.json`（权限 600），包含 JWT_SECRET、PASSWORDS、ADMIN_PASSWORDS。不要提交密钥或含凭证导出。
- 构建：在 frontend 执行 `pnpm install --frozen-lockfile && pnpm build:pages`，将本目录 wrangler.toml 复制到 worker/wrangler.toml，在 worker 执行 `pnpm install --frozen-lockfile && pnpm deploy`，用 `wrangler secret bulk` 上传本机私密配置。
- 发版前保留三项 Worker Secrets、域名 Catch-all 和数据库绑定；部署不应重新初始化或清空 D1。
- 查询邮件：`GET /api/parsed_mails?limit=20&offset=0`，请求头 `Authorization: Bearer <邮箱凭证>` 和 `x-custom-auth: <站点密码>`。
- 网页上线和真实外部收信分别验收；仅 API 建址成功不代表外部邮件已投递。
