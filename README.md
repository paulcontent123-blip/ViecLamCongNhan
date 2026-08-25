# ViecLamCongNhan.com

Nền tảng tuyển dụng cho công nhân phổ thông tại các Khu công nghiệp (KCN) — VEA Group.

## Kiến trúc

Turborepo monorepo, hiện tại chỉ có **1 app Next.js full-stack** (frontend + API Route Handlers trong cùng 1 app). Cấu trúc `packages/` để trống, sẵn sàng tách thêm app (vd. `apps/api` riêng, hoặc `packages/ui`, `packages/config`) khi cần mà không phải tổ chức lại repo.

```
.
├── apps/
│   └── web/              Next.js 15 (App Router) — frontend + API routes
├── supabase/
│   ├── migrations/       SQL migrations (Supabase CLI convention)
│   └── seed.sql          Dữ liệu mẫu: admin account + KCN mẫu
├── document/              TechSpec, deploy checklist, HTML demo gốc (tài liệu tham khảo)
├── turbo.json
└── pnpm-workspace.yaml
```

## Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable` nếu chưa có)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` hoặc `scoop install supabase`) — để chạy migration local

## Cài đặt

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# điền SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / ADMIN_SESSION_SECRET
```

## Database (Supabase)

```bash
supabase init          # chỉ chạy nếu chưa có supabase/config.toml
supabase start         # chạy Postgres local qua Docker
pnpm db:migrate         # áp dụng migrations
supabase db seed        # chạy supabase/seed.sql (hoặc dùng psql trực tiếp)
pnpm db:types            # generate TypeScript types từ schema
```

Với project Supabase thật (không phải local): `supabase link --project-ref <ref>` rồi `pnpm db:migrate`.

## Chạy dev

```bash
pnpm dev
```

Mặc định Next.js chạy tại http://localhost:3000

## Auth (giai đoạn hiện tại)

- **Admin**: tài khoản được tạo trực tiếp trong DB (xem `supabase/seed.sql`), đăng nhập bằng email + password (bcrypt hash), phiên đăng nhập lưu qua cookie JWT ký bằng `ADMIN_SESSION_SECRET`.
- **Nhà tuyển dụng (NTD)**: chỉ cần điền form thông tin để tạo hồ sơ `employers` — **chưa có xác thực bằng mật khẩu** ở giai đoạn này (theo yêu cầu hiện tại). Xem ghi chú TODO trong `apps/web/src/app/api/employers/route.ts` — cần nâng cấp lên xác thực thật (JWT+bcrypt hoặc Supabase Auth) trước khi go-live, theo đúng TechSpec.
- **Ứng viên**: không cần tài khoản, chỉ điền form nhanh.

## Tài liệu tham khảo

Xem thư mục [`document/`](./document) — TechSpec FINAL (PDF), deploy checklist, và file HTML demo gốc dùng làm nguồn tham khảo thiết kế/nội dung.
