# Kịch bản thao tác trên web cho mọi vai trò

Ngày lập: 06/11/2026. Dùng để rà soát một lượt trên trình duyệt (bản `https://vieclamcongnhan.com`), song song với `KICH_BAN_THAO_TAC_APP.md` của app.

Cách dùng: làm theo từng bước, ghi vào cột **Kết quả** (Đạt / Lỗi + ghi chú hoặc ảnh chụp màn hình). Đường dẫn (`/…`) lấy từ mã nguồn; tên nút và nhãn lấy theo giao diện, nếu chữ trên màn hình khác thì ghi lại để sửa tài liệu này. Cột Kết quả để trống, chưa có ai chạy.

Mẫu ghi lỗi: mã kịch bản + bước + điều đã làm + điều thấy + ảnh + trình duyệt/thiết bị.

## Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Chrome (máy tính) và 1 điện thoại mở trình duyệt | Kiểm tra cả giao diện hẹp (di động) |
| 1 cửa sổ ẩn danh cho mỗi vai trò | Tránh lẫn phiên đăng nhập giữa các vai trò |
| 1 số điện thoại mới đăng ký công nhân | Đăng ký bằng mật khẩu |
| 1 email mới cho nhà tuyển dụng; 5 email cho 5 loại đối tác (học nghề, thuê trọ, bảo hiểm, tài chính, y tế) | Hoặc dùng tài khoản sẵn có |
| Tài khoản Admin cấp Superadmin và 1 tài khoản Biên tập | Do hệ thống cấp (`/admin/login`) |
| Ảnh JPG/PNG nhỏ hơn 4MB | Cho logo, tin cho thuê, quảng cáo |
| Mở DevTools (F12) tab Console/Network | Ghi lại lỗi đỏ nếu có |

Nếu danh sách trống (tin việc, khóa học, phòng trọ…), tạo dữ liệu bằng kịch bản của vai trò tương ứng trước.

---

## 1. Chung cho mọi vai trò (C)

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| C1 | Mở `/` | Trang chủ tải đủ, không lỗi đỏ trong Console | |
| C2 | Bấm lần lượt các mục menu: Tìm việc, Tuyển dụng, Dịch vụ trọn gói, Tin tức & Quyền lợi, Quảng cáo / Hợp tác | Mỗi mục mở đúng trang, không 404 | |
| C3 | Thu nhỏ cửa sổ về khoảng 375px (hoặc mở bằng điện thoại) | Menu thu gọn dùng được, không tràn ngang, chữ đọc được | |
| C4 | Mở `/bao-loi` (chưa đăng nhập) | Yêu cầu đăng nhập để gửi báo lỗi, có đường dẫn tới đăng nhập | |
| C5 | Đăng nhập rồi vào `/bao-loi` → nhập Tiêu đề và Mô tả → Gửi | Hiện "Đã gửi báo lỗi"; Admin thấy ở `/admin/bao-loi` | |
| C6 | Bỏ trống Tiêu đề hoặc Mô tả rồi gửi báo lỗi | Có thông báo thiếu trường, không gửi | |
| C7 | Mở một đường dẫn không tồn tại, ví dụ `/khong-co` | Trang 404 thân thiện, có đường về trang chủ | |
| C8 | Làm mới (F5) trên từng trang đã đăng nhập | Phiên được giữ, không bị đá ra đăng nhập | |
| C9 | Đăng xuất ở từng vai trò rồi nhấn Back của trình duyệt | Không xem lại được trang cần đăng nhập; đăng nhập lại bình thường | |
| C10 | Xem các vị trí quảng cáo (trang chủ, danh sách KCN) | Ảnh đúng tỷ lệ, bấm mở đúng liên kết | |
| C11 | Mở `/sitemap.xml` và `/robots.txt` | Cả hai tải được, sitemap có các trang công khai | |
| C12 | Giờ hiển thị ở đơn hàng, đơn ứng tuyển, báo lỗi | Đúng giờ Việt Nam (không lệch 7 tiếng) | |

## 2. Công nhân (W)

### Tài khoản

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| W1 | Mở `/dang-ky` → chọn tạo tài khoản công nhân → nhập Họ tên, Số điện thoại, Tỉnh/thành, Mật khẩu (≥ 8 ký tự) → Đăng ký | Hiện "Đã gửi đăng ký"; tài khoản chờ Admin xác nhận | |
| W2 | Lặp W1 với cùng số điện thoại | Báo số đã tồn tại, không tạo trùng | |
| W3 | Mật khẩu ngắn hơn 8 ký tự, bỏ trống họ tên hoặc số điện thoại sai định dạng | Báo lỗi rõ ràng ở đúng ô, không gửi | |
| W4 | Chưa được Admin xác nhận → vào `/dang-nhap` đăng nhập bằng tài khoản vừa tạo | Báo tài khoản chờ xác nhận, chưa vào được | |
| W5 | Admin xác nhận tài khoản (A5) → công nhân đăng nhập lại | Đăng nhập được, vào `/cong-nhan/tai-khoan` | |
| W6 | Nhập sai mật khẩu nhiều lần liên tiếp (6–10 lần) | Bị giới hạn tạm thời, có thông báo; chờ rồi thử lại được | |
| W7 | Mở `/cong-nhan/dang-nhap` | Tự chuyển sang `/dang-nhap` (đăng nhập gộp một ô chung) | |
| W8 | `/cong-nhan/tai-khoan` → sửa hồ sơ (họ tên, ngành nghề mong muốn, tỉnh, lương, kinh nghiệm…) → Lưu | Lưu thành công; tải lại vẫn thấy dữ liệu | |
| W9 | Nhập ngành nghề tự do (ví dụ "lái xe") | Có gợi ý; chấp nhận nhập tay ngoài gợi ý | |
| W10 | Đổi ảnh đại diện (ảnh hợp lệ, ảnh quá 4MB, tệp không phải ảnh) | Ảnh hợp lệ lưu được; hai trường hợp sau bị từ chối kèm thông báo | |
| W11 | Gửi yêu cầu xóa tài khoản | Yêu cầu hiện trạng thái chờ; Admin thấy ở `/admin/yeu-cau-xoa-tai-khoan` | |

### Việc làm

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| W12 | `/tim-viec-lam`: cuộn danh sách, chuyển trang | Có danh sách, phân trang không trùng tin | |
| W13 | Tìm theo từ khóa; lọc ngành, tỉnh, mức lương; xóa bộ lọc | Kết quả đúng bộ lọc; URL giữ bộ lọc khi tải lại | |
| W14 | Tab Khám phá KCN (`?tab=kcn`) → chọn một KCN | Thấy tin của đúng KCN đó | |
| W15 | Mở một tin (`/tim-viec-lam/[slug]`) | Thấy địa điểm, ca làm, nhà ở, bữa ăn, xe đưa đón; mở được cả dạng cửa sổ chồng và trang riêng | |
| W16 | Bấm lưu tin → `/cong-nhan/viec-da-luu` | Tin hiện trong danh sách; bỏ lưu thì biến mất | |
| W17 | Chưa đăng nhập, bấm lưu tin | Yêu cầu đăng nhập, sau đăng nhập quay lại đúng tin | |
| W18 | Ứng tuyển một tin | Báo thành công; Admin thấy ở `/admin/ung-tuyen` | |
| W19 | Ứng tuyển lại đúng tin đó | Báo đã ứng tuyển, không tạo đơn trùng | |
| W20 | `/cong-nhan/goi-y` | Có gợi ý việc phù hợp (hoặc thông báo hướng dẫn cập nhật hồ sơ); gửi liên tiếp nhiều lần thì bị giới hạn tần suất | |
| W21 | `/ung-vien` (form "Để lại thông tin"), điền và gửi | Gửi thành công; Admin thấy ở `/admin/ung-vien` | |

### Thông tin và dịch vụ

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| W22 | `/tin-tuc-quyen-loi` → mở bài viết, mục Quyền lợi, mục Hỏi đáp | Nội dung hiển thị đúng; mục lục bài viết (nếu có) cuộn đúng | |
| W23 | Gửi câu hỏi ở `/tin-tuc-quyen-loi/hoi-dap` | Gửi được; gửi trùng hoặc quá nhanh thì bị chặn chống spam | |
| W24 | `/dich-vu-cong-nhan` → mở lần lượt Học nghề, Thuê trọ, Bảo hiểm, Tài chính, Y tế | Mỗi trang chỉ hiển thị thông tin dịch vụ | |
| W25 | Ở Bảo hiểm / Tài chính / Học nghề: gửi yêu cầu tư vấn | Yêu cầu về Admin (`/admin/yeu-cau-cong-nhan`), không đến thẳng đối tác | |
| W26 | Học nghề: mở chi tiết khóa (`/dich-vu-cong-nhan/hoc-nghe/[id]`) → đăng ký học | Gửi thành công; hiện trong kho học viên của đối tác nếu đã đồng ý chia sẻ | |
| W27 | Thuê trọ: mở chi tiết (`/dich-vu-cong-nhan/thue-tro/[id]`) → liên hệ, có và không điền câu hỏi | Cả hai trường hợp đều gửi được; chủ trọ thấy yêu cầu | |
| W28 | Gửi yêu cầu không tick đồng ý chia sẻ thông tin | Vẫn gửi được; thông tin không vào danh sách chia sẻ cho đối tác | |
| W29 | Trang Quảng cáo / Hợp tác (`/quang-cao-hop-tac`) và Dịch vụ trọn gói (`/dich-vu-tron-goi`) → gửi form | Gửi được; Admin thấy ở `/admin/tu-van` | |

### Điểm thưởng

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| W30 | Tìm mục Điểm thưởng / Quà trong trang tài khoản công nhân | **Hiện chưa thấy trên web (chỉ có API).** Ghi nhận có hay không; nếu không có thì ghi vào mục 8 | |

## 3. Nhà tuyển dụng (E)

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| E1 | `/tuyen-dung` → đăng ký NTD (email, mật khẩu, thông tin công ty) | Tạo được tài khoản; email trùng bị chặn | |
| E2 | `/tuyen-dung/dang-nhap` đăng nhập đúng và sai mật khẩu | Đúng thì vào dashboard; sai thì báo lỗi, không lộ thông tin | |
| E3 | `/tuyen-dung/dashboard/thong-tin` → sửa thông tin công ty, tải logo | Lưu được; logo hiển thị | |
| E4 | `/tuyen-dung/dashboard/dang-tin` → đăng tin khi chưa được Admin xác minh | Bị chặn hoặc chờ duyệt, có thông báo rõ | |
| E5 | Admin xác minh NTD (A8) → đăng tin | Tin vào trạng thái chờ duyệt; Admin duyệt ở `/admin/tin-tuyen-dung` thì lên trang công khai | |
| E6 | Gói Free: đăng quá 1 tin trong ngày | Bị chặn theo giới hạn gói (Basic 3, Premium 10 tin/ngày) | |
| E7 | Mua gói Basic/Premium → trang thanh toán `/tuyen-dung/thanh-toan/[code]` | Có mã đơn, QR VietQR hoặc MoMo, thông tin tài khoản nhận | |
| E8 | Bấm "Tôi đã thanh toán" | Đơn chuyển sang chờ xác nhận; tạo lại đơn trùng chưa thanh toán bị chặn | |
| E9 | Admin xác nhận đã nhận tiền (A11) | Gói được kích hoạt; hạn mức thay đổi theo gói | |
| E10 | `/tuyen-dung/dashboard/don-hang` | Thấy lịch sử đơn đúng trạng thái; hủy đơn chưa thanh toán được | |
| E11 | `/tuyen-dung/dashboard/ung-vien` và `/ho-so-ung-vien` | Thấy đơn ứng tuyển vào tin của mình; đổi trạng thái đơn được | |
| E12 | Xem hồ sơ ứng viên vượt hạn mức xem của gói | Bị chặn kèm gợi ý nâng gói | |
| E13 | `/tuyen-dung/dashboard/chien-dich` → tạo / sửa chiến dịch (`/[id]`) | Lưu được; trang công khai `/chien-dich/[slug]` hiển thị đúng | |
| E14 | `/tuyen-dung/dashboard/dich-vu-da-dat` | Thấy dịch vụ đã đặt; hủy yêu cầu dịch vụ được | |
| E15 | Gửi Blast SMS/Zalo (tab Blast): ước tính → tạo đơn | Có ước tính số người nhận; đơn thanh toán được tạo | |

## 4. Đối tác (P)

Áp dụng cho 5 loại: học nghề (`/doi-tac/hoc-nghe`), thuê trọ (`/doi-tac/thue-tro`), bảo hiểm (`/doi-tac/bao-hiem`), tài chính (`/doi-tac/tai-chinh`), y tế (`/doi-tac/y-te`).

### Bước chung cho mỗi loại

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| P1 | Mở trang giới thiệu của loại đối tác → đăng ký tài khoản | Tạo được; tài khoản chờ Admin xác minh | |
| P2 | `…/dang-nhap` đăng nhập đúng và sai | Đúng thì vào `…/dashboard`; sai thì báo lỗi | |
| P3 | `…/dashboard/thong-tin` → sửa thông tin, tải logo, tải giấy phép (loại có yêu cầu) | Lưu được; thông tin hiển thị | |
| P4 | Khi chưa được xác minh: thêm sản phẩm / dịch vụ / khóa học / tin | Bị chặn hoặc ở trạng thái chờ duyệt, có thông báo rõ | |
| P5 | Admin xác minh đối tác (A9) và duyệt nội dung → xem trang dịch vụ của công nhân | Nội dung đã duyệt hiển thị cho công nhân; chưa duyệt thì không | |
| P6 | `…/dashboard/yeu-cau` | Thấy yêu cầu công nhân Admin chuyển sang; đổi trạng thái được | |
| P7 | `…/dashboard/goi-dich-vu` → mua gói → thanh toán như E7–E9 | Đơn tạo đúng, đối soát được | |
| P8 | `…/dashboard/dich-vu-da-dat` | Thấy dịch vụ đã đặt đúng trạng thái | |
| P9 | Đăng xuất qua nút trên cổng đối tác | Về trang đăng nhập; Back không vào lại được | |
| P10 | Dùng tài khoản đối tác A mở đường dẫn dashboard của loại B | Bị từ chối hoặc chuyển về đăng nhập, không xem được dữ liệu loại khác | |

### Bước riêng

| Mã | Loại | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| P11 | Học nghề | `…/khoa-hoc` thêm / sửa / ẩn khóa; `…/kho-hoc-vien` và `…/ho-so-hoc-vien` | Khóa chờ duyệt; thấy học viên đã đồng ý chia sẻ | |
| P12 | Thuê trọ | `…/tin-cho-thue` thêm tin kèm ảnh; `…/kho-nguoi-thue` | Ảnh tải được; chỉ thấy người thuê đã đồng ý chia sẻ | |
| P13 | Bảo hiểm / Tài chính | `…/san-pham` thêm sản phẩm (phí, lãi suất…) | Chờ duyệt; số liệu hiển thị đúng định dạng tiền | |
| P14 | Y tế | `…/dich-vu` thêm dịch vụ khám | Chờ duyệt; công nhân đặt lịch thấy dịch vụ sau khi duyệt | |
| P15 | Thuê trọ | Gia hạn hàng tháng và thanh toán | **Hiện chưa rõ trên web; ghi nhận có hay không** | |

## 5. Admin (A)

Đăng nhập tại `/admin/login`. Làm với cả Superadmin và Biên tập; ghi rõ vai trò khi gặp lỗi.

### Phân quyền

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| A1 | Biên tập: xem menu bên trái | Thấy nội dung và tuyển dụng; mục Người dùng, Đơn hàng / Thanh toán, Kênh nhận tiền, xác nhận tài khoản và xóa tài khoản chỉ hiện với Superadmin | |
| A2 | Biên tập mở thẳng đường dẫn của mục chỉ dành Superadmin, ví dụ `/admin/nguoi-dung` | Chuyển về tổng quan, không xem được | |
| A3 | Biên tập gọi thao tác cần Superadmin (ví dụ đổi vai trò người dùng) | Bị từ chối (403) kèm thông báo | |
| A4 | Superadmin tạo Admin cấp Biên tập tại `/admin/nguoi-dung` | Tạo được; tài khoản mới đăng nhập được với quyền Biên tập | |

### Công nhân và đối tác

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| A5 | `/admin/xac-nhan-tai-khoan` → xác nhận một công nhân chờ | Chuyển sang đã xác nhận; công nhân đăng nhập được trên web; thu hồi thì mất quyền đăng nhập | |
| A6 | `/admin/yeu-cau-xoa-tai-khoan` → từ chối kèm ghi chú | Tài khoản giữ nguyên; công nhân thấy ghi chú | |
| A7 | Duyệt một yêu cầu xóa tài khoản | Tài khoản bị xóa và không đăng nhập lại được; công nhân còn yêu cầu đổi quà chờ xử lý thì bị chặn kèm thông báo | |
| A8 | `/admin/nha-tuyen-dung` → bấm "✓ Xác minh" / "Huỷ xác minh" | Trạng thái đổi; NTD đăng tin được hoặc bị chặn theo đó | |
| A9 | `/admin/doi-tac` và `/admin/doi-tac/noi-dung` → xác minh đối tác, duyệt nội dung | Nội dung đã duyệt lên trang công khai | |
| A10 | `/admin/yeu-cau-cong-nhan` → nhận yêu cầu → ghi chú → chuyển cho đối tác | Đổi trạng thái được; đối tác thấy sau khi chuyển | |
| A11 | `/admin/don-hang` → xác nhận đã nhận tiền cho đơn công nhân báo đã thanh toán | Đơn thành "Đã nhận tiền" và kích hoạt quyền lợi; đơn chưa được khách báo thì không xác nhận được | |
| A12 | `/admin/nhan-tien` → thêm tài khoản ngân hàng và ví MoMo, bật một | Chỉ một tài khoản được bật; trang thanh toán của NTD hiện đúng | |

### Nội dung và tuyển dụng

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| A13 | `/admin/tin-tuyen-dung` → duyệt / đóng tin | Trạng thái đổi; trang công khai cập nhật | |
| A14 | `/admin/ung-tuyen` → lọc theo trạng thái, tìm theo tên, đổi trạng thái đơn | Số đếm theo trạng thái đúng | |
| A15 | `/admin/ung-vien` → đổi trạng thái ứng viên | Lưu được | |
| A16 | `/admin/tin-tuc`, `/admin/quyen-loi`, `/admin/hoi-dap` → tạo / sửa / đăng / ẩn | Trang công khai khớp trạng thái | |
| A17 | `/admin/kcn` → thêm / sửa / xóa KCN | Danh sách KCN công khai cập nhật | |
| A18 | `/admin/dich-vu-tron-goi`, `/admin/tu-van` | Xử lý được yêu cầu tư vấn, đổi trạng thái | |
| A19 | `/admin/blast` | Xem chiến dịch Blast của NTD | |

### Quảng cáo, báo lỗi, xuất dữ liệu

| Mã | Các bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| A20 | `/admin/hien-thi-quang-cao` → tạo quảng cáo cho từng vị trí (kèm ảnh) | Hiển thị đúng vị trí trên web và app | |
| A21 | `/admin/quang-cao`, `/quang-cao/kcn`, `/quang-cao/bang-gia` và các trang yêu cầu | Xem và xử lý được yêu cầu quảng cáo / bảng giá | |
| A22 | `/admin/bao-loi` → đổi trạng thái, ghi chú | Lưu được; báo lỗi gửi từ app cũng hiện ở đây | |
| A23 | Xuất danh sách SĐT công nhân (CSV) cho một đối tác | Chỉ Superadmin xuất được; file chỉ chứa công nhân đã đồng ý chia sẻ | |
| A24 | `/admin/cai-dat` | Lưu cài đặt được, không lỗi | |
| A25 | Điểm thưởng: tìm trang quản lý quà và yêu cầu đổi điểm | **Hiện chưa thấy trên web (chỉ có trên app).** Ghi nhận; nếu không có thì ghi vào mục 8 | |

## 6. Kịch bản liên vai trò (X) — nên làm trước nhất

| Mã | Luồng | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| X1 | Công nhân đăng ký (W1) → Admin xác nhận (A5) → công nhân đăng nhập (W5) | Cả luồng chạy, trạng thái khớp ở cả hai bên | |
| X2 | NTD đăng ký (E1) → Admin xác minh (A8) → NTD đăng tin (E5) → Admin duyệt (A13) → tin hiện ở `/tim-viec-lam` | Tin công khai | |
| X3 | Công nhân ứng tuyển tin đó (W18) → NTD thấy đơn (E11) → Admin thấy ở `/admin/ung-tuyen` (A14) | Ba bên cùng thấy, trạng thái đồng bộ | |
| X4 | NTD mua gói (E7–E8) → Admin xác nhận tiền (A11) → hạn mức NTD đổi (E9) | Gói kích hoạt đúng | |
| X5 | Công nhân gửi yêu cầu tư vấn (W25) → Admin nhận và chuyển (A10) → đối tác thấy (P6) | Yêu cầu không đến đối tác trước khi Admin chuyển | |
| X6 | Đối tác thêm dịch vụ (P4) → Admin xác minh và duyệt (P5) → công nhân thấy (W24) | Chỉ nội dung đã duyệt hiển thị | |
| X7 | Công nhân tick đồng ý chia sẻ → Admin xuất CSV (A23) | File có công nhân đó; công nhân không tick thì không có | |
| X8 | Đăng ký trên app, đăng nhập cùng tài khoản trên web | Dữ liệu hồ sơ khớp giữa hai nền tảng | |
| X9 | Báo lỗi gửi từ app và từ web → Admin xử lý (A22) | Cả hai hiện cùng danh sách | |

## 7. Thứ tự đề xuất khi rà soát

1. X1 → X3 (tài khoản, tuyển dụng, ứng tuyển) bằng 3 cửa sổ ẩn danh.
2. Phần Admin (A1–A12): phân quyền và xác nhận tài khoản trước, vì mọi vai trò khác phụ thuộc.
3. Đối tác (P1–P15) lần lượt 5 loại, bắt đầu bằng thuê trọ.
4. Công nhân chi tiết (W), rồi chung (C), cuối cùng thử trên điện thoại.

## 8. Điểm đã biết là chưa có hoặc cần kiểm tra (không cần ghi là lỗi mới)

- Điểm thưởng công nhân và trang Admin quản lý quà chưa thấy trên web (W30, A25). Điểm online chỉ chạy trên app.
- Gia hạn hàng tháng cho đối tác thuê trọ trên web chưa kiểm tra (P15).
- Chợ đồ cũ không có trên web theo yêu cầu.
- Đối tác tài xế và canteen chưa có.
- Kịch bản này lập từ mã nguồn, chưa ai chạy thử; tên nút có thể lệch với giao diện thật.
