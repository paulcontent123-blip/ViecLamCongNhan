# ViecLamCongNhan.com — Deploy Checklist

## File cần upload
```
FINAL_vieclamcongnhan.html  →  public_html/index.html
```
Chỉ 1 file duy nhất. Không cần Node, PHP, hay database để chạy frontend.

---

## Cách deploy theo từng hosting

### Shared Hosting (cPanel / DirectAdmin)
```bash
1. Đăng nhập cPanel → File Manager → public_html/
2. Upload FINAL_vieclamcongnhan.html
3. Rename → index.html
4. Trỏ domain vieclamcongnhan.com → public_html/
5. Bật SSL: cPanel → SSL/TLS → Let's Encrypt
```

### VPS + Nginx
```nginx
server {
    listen 80;
    server_name vieclamcongnhan.com www.vieclamcongnhan.com;
    root /var/www/vieclamcongnhan;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
```bash
# Upload file
scp FINAL_vieclamcongnhan.html user@server:/var/www/vieclamcongnhan/index.html

# Reload Nginx
nginx -t && systemctl reload nginx

# SSL
certbot --nginx -d vieclamcongnhan.com -d www.vieclamcongnhan.com
```

### Netlify (FREE — nhanh nhất)
```
1. Vào app.netlify.com
2. Drag & drop file index.html vào ô deploy
3. Đặt custom domain: vieclamcongnhan.com
4. SSL tự động bật
→ Live trong 30 giây
```

### Cloudflare Pages (FREE)
```bash
1. Tạo repo GitHub, push file index.html
2. Cloudflare Dashboard → Pages → Connect to Git
3. Build command: (để trống)
4. Output directory: /
5. Custom domain: vieclamcongnhan.com
```

---

## Test checklist sau deploy

- [ ] Trang chủ load đúng, marquee đối tác chạy
- [ ] Nav dropdown "Tìm việc làm" hover hoạt động
- [ ] Nav dropdown "Tuyển dụng" hover hoạt động
- [ ] Trang Tuyển dụng → tab Gói đăng tin → thấy 4 gói (Free/Basic/Featured/Chiến dịch)
- [ ] Login Nội bộ: `admin@demo.vn / 123456` → vào Dashboard
- [ ] Login NTD: `ntd@demo.vn / 123456` → vào Tài khoản Nhà tuyển dụng
- [ ] Đăng xuất → về Trang chủ, không còn thấy admin panel
- [ ] Trang Tin tức & Quyền lợi → 3 tab hoạt động (Tin tức / Quyền lợi / Hỏi đáp)
- [ ] Form Hỏi đáp không bị tràn ra ngoài trang khác

---

## Backend (dev team tích hợp sau)

| Component | Stack gợi ý |
|-----------|-------------|
| Database | PostgreSQL / Supabase |
| API | Node.js Express hoặc Next.js |
| Auth | JWT + bcrypt |
| SMS Blast | ESMS.vn |
| Zalo OA | Zalo Official Account API |
| Payment | VNPay / MoMo Business |
| File storage | Cloudinary (free 25GB) |

Demo credentials (chỉ dùng ở frontend, xóa khi go live):
- Admin: `admin@demo.vn / 123456`
- NTD: `ntd@demo.vn / 123456`

---
VEA Group · ViecLamCongNhan.com · 2026
