# 🔥 打卡网站 - 部署指南

## 项目文件结构

```
D:\产物\打卡网站\
├── index.html              # 网站主入口
├── css/
│   └── styles.css          # iOS 风格样式
├── js/
│   ├── app.js              # 主应用逻辑
│   ├── supabase.js         # Supabase 数据库操作
│   ├── calendar.js         # 日历渲染
│   └── chat.js             # 好友 & 聊天
├── supabase-schema.sql     # 数据库建表脚本
├── worker.js               # Cloudflare Worker（缺勤提醒+清理）
└── .github/workflows/
    └── deploy.yml          # GitHub Actions 自动部署
```

---

## 部署步骤

### 第一步：注册 Supabase 并创建项目

1. 打开 https://supabase.com 注册账号
2. 点击 "New Project" 创建新项目
3. 记下 Project URL 和 anon key（Settings -> API）
4. 打开 SQL Editor，粘贴 `supabase-schema.sql` 全部内容运行

### 第二步：在 JS 中配置 Supabase 信息

打开 `js/supabase.js`，替换开头的两行：

```javascript
const SUPABASE_URL = 'https://你的项目.supabase.co';
const SUPABASE_ANON_KEY = '你的 anon key';
```

### 第三步：上传到 GitHub

```bash
# 在 GitHub 上创建新仓库（不要勾选 README）
git init
git add .
git commit -m "init: 打卡网站"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 第四步：启用 GitHub Pages

1. 打开仓库 Settings -> Pages
2. Source 选择 "GitHub Actions"
3. 推送代码后，Actions 会自动部署
4. 部署完成后会显示 URL（如 `https://你的用户名.github.io/仓库名/`）

### 第五步（可选）：绑定自定义域名

1. 在阿里云购买域名（约 ¥30-50/年）
2. 在阿里云 DNS 解析中添加 CNAME 记录：
   - 记录类型：CNAME
   - 主机记录：`www` 或 `@`
   - 记录值：`你的用户名.github.io`
3. 在 GitHub Pages 设置中填入你的域名

### 第六步（可选）：配置缺勤提醒

1. 用户打开网站 -> 设置 -> 微信提醒
2. 打开 https://sct.ftqq.com 扫码获取 SendKey
3. 将 SendKey 粘贴到设置页保存

### 第七步（可选）：部署 Cloudflare Worker 定时任务

如果你希望自动检测缺勤并推送微信提醒：
1. 打开 Cloudflare Dashboard -> Workers & Pages
2. 创建 Worker，粘贴 `worker.js` 内容
3. 设置环境变量：
   - `SUPABASE_URL` = 你的 Supabase URL
   - `SUPABASE_SERVICE_KEY` = Supabase Service Role Key
4. 设置 Cron 触发器：`0 14 * * *`（北京时间 22:00）

---

## Admin 账号说明

- **第一个注册的用户自动成为管理员**
- Admin 在设置页可以看到「管理后台」入口
- Admin 可查看所有用户的打卡记录（普通用户不知情）
- Admin 可重置任意用户的密码

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | 纯 HTML/CSS/JS，GitHub Pages 托管 |
| 数据库 & 认证 | Supabase (PostgreSQL + Auth) |
| 打卡文件存储 | Supabase Storage（免费 1GB） |
| 聊天文件存储 | Cloudflare R2（免费 10GB）|
| 定时任务 | Cloudflare Worker |
| 消息推送 | Server酱 → 微信 |
