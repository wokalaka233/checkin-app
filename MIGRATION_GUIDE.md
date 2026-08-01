# 打卡网站 - 新建 Supabase 项目迁移指南

## 背景

原 Supabase 项目 `vqalxycphakttybffwz.supabase.co` 域名已在全球范围内 DNS 不可达，所有代理方案均无法恢复。需要新建 Supabase 项目并迁移。

## 步骤

### 1. 新建 Supabase 项目

1. 打开 https://supabase.com/dashboard
2. 点 **New project**
3. 选择组织 `wokalaka233's Org`
4. 填写项目名称（如 `checkin-new`）
5. 选择区域：建议 **Asia Pacific (Singapore)** `ap-southeast-1`
6. 等待项目创建完成（约 1-2 分钟）

### 2. 获取新项目的 URL 和 Key

1. 进入新项目
2. 左侧菜单 **Project Settings** → **API**
3. 复制以下两项：
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `sb_publishable_xxx...`

### 3. 执行数据库初始化 SQL

1. 左侧菜单 **SQL Editor**
2. 点 **New query**
3. 把 `supabase_schema.sql` 文件的全部内容粘贴进去
4. 点 **Run**
5. 确认没有报错

### 4. 创建 Storage Bucket（如 SQL 未自动创建）

1. 左侧菜单 **Storage**
2. 点 **New bucket**
3. 名称填 `media`
4. 勾选 **Public bucket**
5. 点 **Save**

### 5. 更新 Cloudflare Worker 代码

1. 打开 https://dash.cloudflare.com/?to=/:account/workers
2. 进入 `falling-haze-f53f` Worker
3. 编辑代码，把里面的：
   ```js
   const SUPABASE_HOST = 'vqalxycphakttybffwz.supabase.co';
   const SUPABASE_ANON_KEY = 'sb_publishable_xi-u5divr9AoQHLL_G9eaw_4dWotEY9';
   ```
   改成新项目对应的值
4. 点 **Save and Deploy**

### 6. 更新前端代码（本地 `js/api.js`）

把第 4-5 行：
```js
const SUPA_URL = 'https://falling-haze-f53f.860992714.workers.dev';
const SUPA_KEY = 'sb_publishable_xi-u5divr9AoQHLL_G9eaw_4dWotEY9';
```
改成：
```js
const SUPA_URL = 'https://falling-haze-f53f.860992714.workers.dev';
const SUPA_KEY = '新项目的 anon key';
```

Worker URL 不变，只改 key。

### 7. 推送到 GitHub

代码改好后，灵犀会用 Python 脚本推送到 GitHub，触发 Vercel 自动部署。

### 8. 测试

打开 https://checkin.wokalaka.top，尝试注册/登录。

## 注意事项

- 新建项目后，旧项目的数据无法自动迁移，需要重新注册账号
- 如果旧项目里还有重要数据，可以联系 Supabase 支持尝试恢复
- 新项目的 RLS 策略已经配置好，注册后即可正常使用
