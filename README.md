# PixelShare

一个基于 React + Vite 构建的图片分享与发现平台。浏览来自 Picsum 和 Unsplash 的高质量摄影作品，收藏喜欢的图片，向社区分享你发现的好图。

## 功能

- **浏览画廊** — 无限滚动，混合展示 Picsum + Unsplash 双源图片
- **收藏** — 登录后收藏图片，数据存储在 Supabase，跨设备同步
- **社区** — 上传分享图片 URL，所有用户可见
- **用户认证** — 基于 Clerk 的登录/注册系统
- **灯箱预览** — 点击图片全屏查看、下载

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS + shadcn/ui |
| 路由 | wouter |
| 数据请求 | TanStack Query |
| 认证 | Clerk |
| 数据库 | Supabase (PostgreSQL) |
| 图片来源 | Unsplash API + Picsum Photos |

## 一键部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/niumaifree/PixelShare&env=VITE_CLERK_PUBLISHABLE_KEY,VITE_UNSPLASH_ACCESS_KEY,VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY&envDescription=填写以下环境变量，详见README&project-name=pixelshare&framework=vite)

### Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages**
2. 连接你的 GitHub 仓库
3. 构建配置：
   - **Framework preset**: `Vite`
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist/public`
4. 在 **Environment variables** 中添加下方所有变量
5. 点击 **Save and Deploy**

## 环境变量配置

部署前需要配置以下 4 个环境变量：

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk 应用的公钥 | [clerk.com](https://clerk.com) → 创建应用 → API Keys |
| `VITE_UNSPLASH_ACCESS_KEY` | Unsplash API 访问密钥 | [unsplash.com/developers](https://unsplash.com/developers) → New Application |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | Supabase 控制台 → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名公钥 | Supabase 控制台 → Project Settings → API → `anon public` |

## 数据库配置（Supabase）

在 [supabase.com](https://supabase.com) 创建项目后，进入 **SQL Editor** 运行以下脚本建表：

```sql
-- 收藏表
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  image_url text not null,
  created_at timestamptz default now(),
  unique(user_id, image_url)
);

-- 社区图片表
create table if not exists community_images (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  image_url text not null,
  title text,
  created_at timestamptz default now()
);

-- 开启行级安全（RLS）
alter table favorites enable row level security;
alter table community_images enable row level security;

-- favorites 访问策略
create policy "favorites_select" on favorites for select using (true);
create policy "favorites_insert" on favorites for insert with check (true);
create policy "favorites_delete" on favorites for delete using (true);

-- community_images 访问策略
create policy "images_select" on community_images for select using (true);
create policy "images_insert" on community_images for insert with check (true);
```

> **说明**：用户身份通过 Clerk 的 `user.id` 字段标识，直接存入数据库。RLS 策略允许客户端直接读写，适合纯前端部署场景。如需更严格的权限控制，建议接入后端服务并配置 Clerk JWT 验证。

## 本地开发

```bash
# 安装依赖
pnpm install

# 复制环境变量（填入上方 4 个变量）
cp .env.example .env.local

# 启动开发服务器（需要 PORT 和 BASE_PATH 变量）
PORT=5000 BASE_PATH=/ pnpm run dev
```

## 注意事项

- 所有请求均由**浏览器直接发出**，没有自建后端服务器
- Unsplash Access Key 会暴露在前端，建议在 Unsplash 控制台限制允许的来源域名
- Supabase anon key 本身是公开安全的，真正的访问控制由 RLS 策略决定
- Clerk 开发环境密钥有调用限制，生产环境请使用正式密钥
