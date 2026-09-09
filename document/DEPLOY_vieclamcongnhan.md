# ViecLamCongNhan.com — Deploy Next.js lên Vietnix cPanel

Ứng dụng hiện tại là Next.js có API, đăng nhập, Supabase và upload ảnh. File `document/vieclamcongnhan_FINAL_2.html` chỉ là bản HTML tham khảo cũ, không phải gói deploy production của ứng dụng hiện tại.

## 1. Build gói upload trên máy local

Yêu cầu Node.js 20 trở lên và pnpm 11.

Chạy tại thư mục gốc repository:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm package:cpanel:app
```

File cần upload được tạo tại:

```text
dist-cpanel-app.deploy.zip
```

Lệnh đóng gói sẽ tự dừng nếu thiếu `BUILD_ID` hoặc không có CSS. Có thể kiểm tra thủ công trên PowerShell:

```powershell
$buildId = (Get-Content apps/web/.next/BUILD_ID -Raw).Trim()
$cssFiles = @(Get-ChildItem apps/web/.next/static/css -Filter *.css -File)

if (-not $buildId) { throw "Thiếu BUILD_ID" }
if ($cssFiles.Count -eq 0) { throw "Thiếu CSS" }

Write-Host "BUILD_ID=$buildId"
$cssFiles | Select-Object Name, Length
tar.exe -tf dist-cpanel-app.deploy.zip | Select-String 'BUILD_ID|\.css$'
```

Gói `--app-only` phù hợp với cấu trúc đang có trên Vietnix trong ảnh: server đã có `node_modules`, `public`, `tmp`, `package.json` và `server.js` ở application root. Gói này chỉ gồm:

```text
apps/web/.next/       ← build Next.js mới
apps/web/public/      ← asset public của ứng dụng
apps/web/server.js    ← startup server được build
apps/web/package.json
```

Không chép `node_modules` từ Windows lên Linux Vietnix. Nếu thay đổi dependency, cần cài dependency trực tiếp trên server hoặc tạo full package trong môi trường Linux tương thích; hãy dùng quy trình riêng cho lần đó.

## 2. Cấu hình Node.js App lần đầu trên cPanel

Trong cPanel mở **Setup Node.js App** → **Create Application**:

- Node.js: 20 trở lên
- Application mode: `Production`
- Application root: `vieclamcongnhan`
- Application URL: domain cần chạy, ví dụ `https://vieclamcongnhan.com`
- Application startup file: `server.js`

Application root thực tế trong File Manager sẽ tương tự:

```text
/home/suaembec/vieclamcongnhan
```

Các biến môi trường cần khai báo trong Node.js App. Lấy giá trị thật từ `.env.local`/dashboard hiện tại; không đưa secret vào file ZIP:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_SESSION_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_GA_ID                 (không bắt buộc)
NEXT_PUBLIC_SITE_URL=https://vieclamcongnhan.com
```

Các biến `NEXT_PUBLIC_*` được Next.js nhúng vào bundle ở thời điểm build. Nếu đổi domain, Supabase public key hoặc mã Google Analytics thì phải cập nhật giá trị trên máy build và chạy lại `pnpm package:cpanel:app`; các secret server-side vẫn cần có trong Node.js App trên cPanel.

`DATABASE_URL` chỉ cần khi chạy migration theo quy trình database, không phải biến bắt buộc cho runtime hiện tại.

## 3. Deploy mỗi lần sửa code

1. Chạy `pnpm package:cpanel:app` ở máy local.
2. Vào cPanel → **File Manager** → `/home/suaembec/vieclamcongnhan`.
3. Upload `dist-cpanel-app.deploy.zip`.
4. Chọn file ZIP → **Extract** ngay tại application root, để các file `apps/...` ghi đè lên bản cũ.
5. Vào **Setup Node.js App** → bấm **Restart**.

Không extract vào thư mục con như `vieclamcongnhan/dist-cpanel-app`. Không xóa toàn bộ application root và không xóa `node_modules`, `tmp` hoặc `stderr.log` khi chỉ cập nhật code.

Sau khi giải nén, kiểm tra tối thiểu:

```text
/home/suaembec/vieclamcongnhan/
├─ apps/web/.next/
├─ apps/web/public/
├─ apps/web/server.js
├─ node_modules/       ← giữ bản Linux trên server
├─ public/             ← thư mục runtime/cPanel hiện có
├─ tmp/                ← thư mục runtime/cPanel hiện có
├─ package.json
└─ server.js
```

Lưu ý: gói app-only không chứa `server.js` và `package.json` ở root vì hai file này đã có sẵn trên Vietnix. Root `server.js` hiện tại sẽ gọi `apps/web/server.js`.

## 4. Kiểm tra sau khi restart

- Mở trang chủ và một trang chi tiết tin.
- Mở `/robots.txt` và `/sitemap.xml`.
- Mở `/admin/login`, đăng nhập và kiểm tra trang thêm bài viết.
- Kiểm tra mục lục preview, H2/H3, lưu bài viết và upload ảnh.
- Kiểm tra cookie đăng nhập trên HTTPS.

Nếu gặp lỗi 503/500:

1. Restart lại Node.js App.
2. Xem `stderr.log` trong application root.
3. Kiểm tra Node.js đã là phiên bản 20+.
4. Kiểm tra đủ biến môi trường và không có secret bị thừa khoảng trắng.
5. Kiểm tra `apps/web/.next` và `apps/web/server.js` đã được ghi đè đúng vị trí.

## 5. Rollback an toàn

Trước khi extract, có thể nén hoặc đổi tên thư mục `apps` hiện tại để backup. Nếu bản mới lỗi, khôi phục lại `apps/web/.next`, `apps/web/server.js`, `apps/web/package.json` từ backup rồi Restart Node.js App.

## 6. Deploy lần đầu hoặc sau khi đổi dependency

Không dùng gói app-only nếu đã thêm/xóa package. Khi đó cần bảo đảm `node_modules` được cài trên Linux Vietnix theo `apps/web/package.json` và lockfile tương ứng, hoặc tạo full package trên một môi trường Linux tương thích. Tuyệt đối không lấy `node_modules` được cài trên Windows để chạy trên server Linux.

## 7. Kiểm tra bằng lệnh trên Vietnix

Nếu tài khoản cPanel có SSH, chạy sau khi Extract và Restart:

```bash
cd /home/suaembec/vieclamcongnhan
printf 'BUILD_ID=' && cat apps/web/.next/BUILD_ID && printf '\n'
find apps/web/.next/static/css -maxdepth 1 -type f -name '*.css' -printf '%f %s bytes\n'
```

Kết quả `BUILD_ID` trên server phải trùng với giá trị lúc build local. Phải có ít nhất một file `.css`. Nếu không có SSH, dùng File Manager mở `apps/web/.next/BUILD_ID` và thư mục `apps/web/.next/static/css` để kiểm tra tương tự.

Có thể kiểm tra CSS đang được phục vụ ngoài domain bằng cách lấy tên file CSS vừa thấy rồi chạy:

```bash
curl -I https://vieclamcongnhan.com/_next/static/css/TEN_FILE_CSS.css
```

Kết quả đúng thường là HTTP `200` hoặc `304`. Nếu trang chạy nhưng CSS trả `404`, ZIP đã được giải nén sai cấp thư mục hoặc thư mục `.next/static` chưa được ghi đè đầy đủ.
