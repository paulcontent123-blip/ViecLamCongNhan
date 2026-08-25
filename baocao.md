# BÁO CÁO CÁC CHỨC NĂNG ĐÃ TRIỂN KHAI

## 1. Mục đích hệ thống

Xây dựng nền tảng kết nối nhà tuyển dụng với người lao động, hỗ trợ đăng tin tuyển dụng, tìm việc, ứng tuyển, quản lý ứng viên và quản trị nội dung trên website.

## 2. Luồng nghiệp vụ tổng thể

~~~text
Nhà tuyển dụng đăng ký
        ↓
Admin kiểm tra và xác minh nhà tuyển dụng
        ↓
Nhà tuyển dụng đăng nhập, chọn gói và tạo tin tuyển dụng
        ↓
Admin duyệt tin
        ↓
Tin tuyển dụng hiển thị trên trang tìm việc
        ↓
Ứng viên tìm kiếm và ứng tuyển/để lại thông tin
        ↓
Nhà tuyển dụng xem và xử lý ứng viên
        ↓
Admin theo dõi, quản lý dữ liệu và nội dung hệ thống
~~~

## 3. Luồng chức năng nhà tuyển dụng

### 3.1. Đăng ký tài khoản

- Nhập tên công ty.
- Nhập họ tên người liên hệ.
- Nhập số điện thoại, email và mật khẩu.
- Chọn tỉnh/thành phố và ngành nghề.
- Nhập mã số thuế nếu có.
- Tạo tài khoản nhà tuyển dụng.
- Mặc định tài khoản được sử dụng gói Free.
- Tài khoản ở trạng thái chờ Admin xác minh.
- Chưa được đăng tin hoặc sử dụng các chức năng nâng cao trước khi được xác minh.

### 3.2. Đăng nhập và đăng xuất

- Đăng nhập bằng email hoặc số điện thoại.
- Kiểm tra mật khẩu và trạng thái tài khoản.
- Duy trì phiên đăng nhập nhà tuyển dụng.
- Chuyển đến trang quản lý sau khi đăng nhập.
- Đăng xuất tài khoản.

### 3.3. Admin xác minh tài khoản nhà tuyển dụng

- Admin xem danh sách nhà tuyển dụng mới đăng ký.
- Xem thông tin công ty và thông tin liên hệ.
- Kiểm tra mã số thuế/thông tin pháp nhân.
- Xác nhận tài khoản đủ điều kiện hoạt động.
- Từ chối hoặc tắt trạng thái xác minh khi cần.
- Mở quyền đăng tin và sử dụng chức năng dành cho tài khoản đã xác minh.

### 3.4. Cập nhật thông tin nhà tuyển dụng

- Xem thông tin công ty.
- Chỉnh sửa tên công ty.
- Chỉnh sửa người liên hệ.
- Chỉnh sửa số điện thoại.
- Cập nhật tỉnh/thành phố và ngành nghề.
- Cập nhật mã số thuế.
- Cập nhật logo công ty.
- Lưu thông tin mới vào hồ sơ nhà tuyển dụng.

### 3.5. Xem và nâng cấp gói dịch vụ

- Xem thông tin các gói Free, Basic và Premium.
- Xem số tin được đăng trong ngày.
- Xem thời hạn tin tuyển dụng.
- Xem số lượng hồ sơ ứng viên được phép xem.
- Chọn gói muốn nâng cấp.
- Chọn phương thức thanh toán.
- Tạo đơn hàng nâng cấp.
- Theo dõi trạng thái đơn hàng.
- Gói được kích hoạt sau khi Admin xác nhận thanh toán.
- Tự động hạ gói Basic/Premium về Free khi hết hạn nếu chưa gia hạn — tin đã đăng trước đó vẫn giữ nguyên, không bị ẩn hay xóa.

Hạn mức đăng tin:

- Free: tối đa 1 tin/ngày.
- Basic: tối đa 3 tin/ngày.
- Premium: tối đa 10 tin/ngày.

### 3.6. Tạo tin tuyển dụng

- Mở chức năng đăng tin.
- Nhập tiêu đề tuyển dụng.
- Chọn ngành nghề.
- Chọn tỉnh/thành phố.
- Chọn Khu công nghiệp (KCN) từ danh sách KCN thật trong hệ thống — không bắt buộc, danh sách tự lọc theo đúng tỉnh/thành vừa chọn.
- Nhập địa chỉ/quận huyện cụ thể — không bắt buộc.
- Chọn ca làm việc.
- Chọn loại hình công việc.
- Nhập mức lương tối thiểu và tối đa.
- Nhập số lượng cần tuyển.
- Nhập mô tả công việc và quyền lợi.
- Nhập yêu cầu đối với ứng viên.
- Chọn các phúc lợi:
  - Tuyển gấp.
  - Có bữa ăn ca.
  - Có xe đưa đón.
  - Có nhà ở.
  - Không yêu cầu kinh nghiệm.
- Kiểm tra dữ liệu trước khi lưu.
- Kiểm tra nhà tuyển dụng đã được xác minh hay chưa.
- Kiểm tra số tin đã đăng trong ngày theo gói.
- Tạo tin ở trạng thái chờ duyệt.
- Hiển thị thông báo tạo tin thành công.

### 3.7. Mua thêm gói chiến dịch tuyển dụng

- Chọn mua gói Campaign khi tạo tin.
- Nhập nội dung giới thiệu chiến dịch.
- Chọn giao diện/màu sắc cho trang chiến dịch.
- Tạo landing page riêng cho chiến dịch.
- Nhập sẵn nội dung tin nhắn Zalo sẽ gửi cho ứng viên phù hợp.
- Tạo đơn hàng campaign.
- Chờ Admin xác nhận thanh toán.
- Kích hoạt chiến dịch sau khi thanh toán được xác nhận (chưa kích hoạt ngay lúc tạo đơn).
- Hiển thị chiến dịch tại khu vực tuyển dụng nổi bật.
- Tự động gửi Zalo đến ứng viên phù hợp ngay khi kích hoạt (xem mục 6.3).

### 3.8. Admin duyệt và quản lý tin tuyển dụng

- Admin xem danh sách tin chờ duyệt.
- Tìm kiếm tin theo nội dung.
- Lọc tin theo trạng thái.
- Xem thông tin chi tiết tin tuyển dụng.
- Duyệt tin để hiển thị trên trang tìm việc.
- Ẩn/đóng tin tuyển dụng.
- Chuyển tin hết hạn sang trạng thái hết hạn.
- Theo dõi số lượt xem và số lượt ứng tuyển.

## 4. Luồng chức năng tìm việc và ứng viên

### 4.1. Hiển thị danh sách việc làm

- Hiển thị các tin đã được Admin duyệt.
- Hiển thị tiêu đề và tên công ty.
- Hiển thị địa điểm/KCN.
- Hiển thị ngành nghề.
- Hiển thị mức lương.
- Hiển thị loại hình và ca làm việc.
- Hiển thị số lượng cần tuyển.
- Hiển thị các phúc lợi của tin.
- Phân trang danh sách việc làm.
- Sắp xếp tin theo mức độ nổi bật, lương hoặc thời gian đăng.

### 4.2. Lọc việc làm

- Tìm kiếm theo từ khóa.
- Lọc theo tỉnh/thành phố.
- Lọc theo ngành nghề.
- Lọc theo khu công nghiệp.
- Lọc theo mức lương.
- Lọc tin tuyển gấp.
- Lọc tin có nhà ở.
- Lọc tin có xe đưa đón.
- Lọc tin có bữa ăn.
- Lọc tin không yêu cầu kinh nghiệm.
- Lọc theo ca làm việc.
- Kết hợp nhiều điều kiện lọc.

### 4.3. Xem chi tiết việc làm

- Mở tin tuyển dụng theo đường dẫn riêng.
- Xem đầy đủ mô tả công việc.
- Xem yêu cầu ứng viên.
- Xem mức lương và số lượng tuyển.
- Xem địa điểm làm việc.
- Xem thông tin công ty.
- Xem các chính sách/phúc lợi.
- Chuyển sang form ứng tuyển.

### 4.4. Ứng tuyển vào công việc

- Ứng viên mở form ứng tuyển từ tin tuyển dụng.
- Nhập họ tên.
- Nhập số điện thoại.
- Nhập thông tin Zalo.
- Chọn tỉnh/thành phố.
- Chọn ngành nghề mong muốn.
- Nhập mức lương mong muốn.
- Nhập số năm kinh nghiệm.
- Ghi nhận công việc ứng viên đang muốn ứng tuyển.
- Kiểm tra dữ liệu trước khi gửi.
- Tạo hồ sơ ứng viên.
- Tạo đơn ứng tuyển gắn với tin tuyển dụng.
- Gắn đơn ứng tuyển với nhà tuyển dụng tương ứng.
- Cập nhật số lượng ứng viên của tin.
- Thông báo gửi đơn thành công.

### 4.5. Để lại thông tin khi chưa chọn được việc

- Ứng viên điền form thông tin chung.
- Lưu hồ sơ với nguồn “để lại thông tin”.
- Cho phép Admin xem và quản lý hồ sơ.
- Cho phép nhà tuyển dụng phù hợp tìm kiếm hồ sơ.
- Sử dụng hồ sơ trong các chiến dịch tiếp cận ứng viên.

### 4.6. Xử lý ứng viên trùng số điện thoại

- Kiểm tra số điện thoại trước khi lưu.
- Thông báo khi số điện thoại đã tồn tại.
- Cho phép chọn “Xóa thông tin cũ, lưu thông tin mới”.
- Cho phép chọn “Giữ thông tin cũ, không lưu thông tin mới”.
- Xóa hồ sơ cũ và dữ liệu ứng tuyển liên quan nếu người dùng xác nhận thay thế.
- Cập nhật lại số lượng ứng tuyển của các tin liên quan.

### 4.7. Danh sách Khu công nghiệp (KCN) toàn quốc

- Xem danh sách KCN theo tab riêng “KCN toàn quốc” tại trang tìm việc.
- Hiển thị tên KCN, tỉnh/thành, địa chỉ.
- Hiển thị số doanh nghiệp đang hoạt động trong KCN.
- Hiển thị số tin tuyển dụng đang mở trong KCN.
- Chuyển sang danh sách việc làm đã lọc theo đúng KCN vừa chọn.

### 4.8. Chiến dịch tuyển dụng nổi bật (trang chủ)

- Hiển thị các chiến dịch còn hạn ở khu vực riêng trên trang chủ.
- Số cột lưới tự co giãn theo số lượng chiến dịch hiển thị, tối đa 5 cột/2 hàng.
- Luôn có 1 ô kêu gọi “Đăng chiến dịch tuyển dụng của bạn” ở cuối lưới, kèm số ứng viên thật đang có trong hệ thống.
- Phân trang ngay tại khu vực này khi có nhiều hơn 9 chiến dịch, không cần tải lại trang.

## 5. Luồng nhà tuyển dụng xử lý ứng viên

### 5.1. Xem danh sách đơn ứng tuyển

- Mở danh sách ứng viên trong dashboard.
- Xem họ tên ứng viên.
- Xem công việc ứng viên đã ứng tuyển.
- Xem tỉnh/thành phố.
- Xem ngành nghề mong muốn.
- Xem kinh nghiệm.
- Xem trạng thái xử lý.
- Ẩn thông tin liên hệ khi chưa được phép xem.

### 5.2. Cập nhật trạng thái ứng viên

Nhà tuyển dụng có thể cập nhật:

- Mới tiếp nhận.
- Đã xem.
- Đã liên lạc.
- Đã tuyển.
- Từ chối.

Trạng thái ứng viên được cập nhật theo từng đơn ứng tuyển và đồng bộ về hồ sơ tổng của ứng viên.

### 5.3. Xem thông tin liên hệ ứng viên

- Hiển thị danh sách hồ sơ ứng viên ở dạng rút gọn.
- Nhà tuyển dụng chọn hồ sơ muốn xem.
- Kiểm tra gói tài khoản hiện tại.
- Kiểm tra số lượt đã xem trong tháng.
- Ghi nhận lượt xem hồ sơ.
- Hiển thị số điện thoại/Zalo nếu còn hạn mức.
- Thông báo khi đã hết lượt xem.
- Không tính thêm lượt nếu xem lại cùng một ứng viên trong cùng tháng.
- Tự động bắt đầu lại hạn mức vào tháng mới.

Hạn mức xem hồ sơ:

- Free: không được xem thông tin liên hệ.
- Basic: tối đa 60 hồ sơ/tháng.
- Premium: tối đa 300 hồ sơ/tháng.

## 6. Chức năng chiến dịch và Blast

### 6.1. Tạo chiến dịch Blast

- Chọn kênh gửi SMS, Zalo hoặc Combo.
- Nhập tên chiến dịch.
- Nhập nội dung tin nhắn.
- Giới hạn nội dung tối đa 160 ký tự.
- Chọn tỉnh mục tiêu.
- Chọn ngành mục tiêu.
- Chọn số lượng ứng viên muốn gửi — để trống nghĩa là gửi hết ứng viên khớp bộ lọc.
- Khi giới hạn số lượng, hệ thống ưu tiên chọn đúng những ứng viên mới điền form/mới ứng tuyển gần đây nhất, không chọn ngẫu nhiên.
- Ước tính số lượng ứng viên tiếp cận (hiển thị cả số thực nhận và tổng số khớp bộ lọc khi bị giới hạn).
- Ước tính chi phí theo đúng số lượng thực nhận.
- Chọn phương thức thanh toán.
- Tạo chiến dịch ở trạng thái chờ xác nhận.

### 6.2. Xử lý chiến dịch sau thanh toán

- Admin kiểm tra đơn hàng.
- Xác nhận trạng thái thanh toán.
- Đưa chiến dịch vào hàng đợi xử lý.
- Lọc nhóm ứng viên phù hợp.
- Lưu số lượng người nhận.
- Lưu chi phí và trạng thái chiến dịch.
- Theo dõi chiến dịch trong khu vực Admin.

### 6.3. Tự động Blast Zalo khi mua gói Chiến dịch

- Không cần tạo chiến dịch Blast riêng — tự động chạy khi mua gói Chiến dịch cho tin.
- Dùng đúng nội dung tin nhắn Zalo NTD đã nhập lúc mua gói.
- Chỉ nhắm tới ứng viên đã điền form “Để lại thông tin”, khớp đúng ngành nghề và tỉnh/thành với tin tuyển dụng.
- Chỉ chạy sau khi Admin xác nhận đã nhận thanh toán, không chạy ngay lúc nhà tuyển dụng đăng tin.
- Gửi tối đa trong hạn mức ngân sách, hết ứng viên phù hợp thì dừng sớm, không bắt buộc dùng hết hạn mức.
- Lưu số lượng ứng viên đã gửi và hiển thị ngay cạnh từng chiến dịch trong dashboard NTD.
- Hiện tại mới tính toán và lưu số liệu gửi (số người, chi phí) — chưa gọi cổng Zalo thật để gửi tin, giống các chiến dịch Blast khác.

Ngân sách Blast kèm gói Chiến dịch:

- Giá gói Chiến dịch: 1.500.000đ/tin.
- Ngân sách dành riêng cho Blast Zalo: 1.000.000đ trong tổng giá gói.
- Đơn giá: 300đ/tin nhắn Zalo — tối đa khoảng 3.333 ứng viên/chiến dịch.

## 7. Luồng chức năng quản trị Admin

### 7.1. Đăng nhập Admin

- Nhập thông tin đăng nhập.
- Kiểm tra quyền Admin.
- Truy cập dashboard quản trị.
- Đăng xuất khỏi hệ thống.

### 7.2. Dashboard quản trị

- Thống kê số tin tuyển dụng.
- Thống kê tin chờ duyệt.
- Thống kê số nhà tuyển dụng chưa xác minh.
- Thống kê số ứng viên.
- Thống kê số đơn ứng tuyển.
- Thống kê đơn hàng chờ xử lý.
- Thống kê doanh thu.
- Hiển thị các công việc cần Admin xử lý.

### 7.3. Quản lý nhà tuyển dụng

- Xem danh sách NTD.
- Tìm kiếm NTD.
- Xem thông tin đăng ký.
- Xem trạng thái xác minh.
- Duyệt tài khoản NTD.
- Tắt xác minh tài khoản.
- Theo dõi trạng thái hoạt động của NTD.

### 7.4. Quản lý tin tuyển dụng

- Xem danh sách tin.
- Tìm kiếm tin.
- Lọc theo trạng thái.
- Xem chi tiết tin.
- Duyệt tin.
- Ẩn tin.
- Đóng tin.
- Đánh dấu tin hết hạn.

### 7.5. Quản lý hồ sơ ứng viên

- Xem danh sách ứng viên để lại thông tin.
- Tìm kiếm theo họ tên/số điện thoại.
- Lọc theo tỉnh/thành phố.
- Xem ngành nghề mong muốn.
- Xem kinh nghiệm.
- Cập nhật trạng thái hồ sơ.
- Theo dõi hồ sơ đã được liên hệ hoặc tuyển dụng.

### 7.6. Quản lý đơn ứng tuyển

- Xem danh sách đơn ứng tuyển.
- Lọc theo trạng thái.
- Lọc theo tin tuyển dụng.
- Lọc theo nhà tuyển dụng.
- Xem thông tin ứng viên.
- Cập nhật trạng thái đơn.
- Theo dõi số lượng đơn theo từng trạng thái.

### 7.7. Quản lý người dùng

- Xem danh sách người dùng.
- Thêm người dùng mới.
- Chỉnh sửa thông tin người dùng.
- Phân quyền người dùng.
- Cập nhật mật khẩu.
- Xóa/khóa người dùng.
- Bảo vệ tài khoản Admin đang đăng nhập.

### 7.8. Quản lý đơn hàng và gói dịch vụ

- Xem danh sách đơn hàng.
- Lọc đơn hàng theo trạng thái.
- Xem loại gói/dịch vụ.
- Xem số tiền và phương thức thanh toán.
- Xác nhận đơn hàng đã thanh toán.
- Hủy đơn hàng.
- Kích hoạt gói tài khoản.
- Kích hoạt gói chiến dịch.
- Theo dõi lịch sử đơn hàng.

### 7.9. Quản lý đối tác doanh thu (Revenue Partners)

- Xem danh sách đối tác (tài chính, bảo hiểm, tuyển dụng...).
- Xem loại đối tác và tỷ lệ hoa hồng.
- Xem số lượt click và số lượt chuyển đổi (lead).
- Xem doanh thu phát sinh từ từng đối tác.
- Bật/tắt trạng thái hoạt động của đối tác.

### 7.10. Quản lý Khu công nghiệp (KCN) toàn quốc

- Xem danh sách KCN kèm số doanh nghiệp và số tin tuyển dụng đang mở (tính theo dữ liệu thật, không phải số cố định).
- Thêm KCN mới: tên, tỉnh/thành, địa chỉ, diện tích, tỷ lệ lấp đầy, số doanh nghiệp đang hoạt động, ngành nghề chính, tọa độ trên bản đồ.
- Chỉnh sửa thông tin KCN đã có.
- Xóa KCN — tin tuyển dụng đang gắn KCN đó chỉ bị gỡ liên kết, không bị xóa theo.
- Dữ liệu KCN vừa thêm/sửa hiển thị ngay ở tab “KCN toàn quốc” trang Tìm việc làm và ở danh sách chọn KCN khi nhà tuyển dụng đăng tin.

## 8. Luồng chức năng bài viết, quyền lợi và hỏi đáp

### 8.1. Bài viết/tin tức phía người dùng

- Hiển thị danh sách bài viết.
- Lọc bài viết theo danh mục.
- Phân trang bài viết.
- Xem tiêu đề và nội dung tóm tắt.
- Xem chi tiết bài viết.
- Hiển thị thời gian đọc dự kiến.

### 8.2. Quản lý bài viết phía Admin

- Xem danh sách bài viết.
- Thêm bài viết.
- Chỉnh sửa bài viết.
- Chọn danh mục bài viết.
- Lưu bài viết nháp.
- Duyệt bài viết để đăng.
- Ẩn bài viết.
- Xóa bài viết.

### 8.3. Quyền lợi và pháp lý lao động

- Hiển thị danh sách nội dung quyền lợi.
- Hiển thị thông tin lương tối thiểu, BHXH, hợp đồng, thai sản và các quyền lợi khác.
- Xem nội dung chi tiết từng quyền lợi.
- Hiển thị ghi chú thời gian áp dụng.
- Phân loại và sắp xếp nội dung quyền lợi.

### 8.4. Quản lý quyền lợi phía Admin

- Thêm thẻ quyền lợi.
- Chỉnh sửa tiêu đề và nội dung.
- Chỉnh sửa biểu tượng.
- Cập nhật ghi chú hiệu lực.
- Sắp xếp thứ tự hiển thị.
- Bật/tắt hiển thị quyền lợi.
- Xóa nội dung quyền lợi.

### 8.5. Hỏi đáp phía người dùng

- Xem các câu hỏi thường gặp.
- Mở/đóng nội dung câu trả lời.
- Nhập câu hỏi mới.
- Nhập họ tên.
- Nhập số điện thoại/email liên hệ.
- Gửi câu hỏi đến hệ thống.
- Nhận thông báo gửi câu hỏi thành công.

### 8.6. Quản lý hỏi đáp phía Admin

- Xem danh sách câu hỏi mới.
- Xem thông tin liên hệ người hỏi.
- Trả lời câu hỏi.
- Lưu câu trả lời.
- Duyệt câu hỏi và câu trả lời lên website.
- Ẩn câu hỏi đã đăng.
- Xóa câu hỏi.

## 9. Chuẩn hoá và mở rộng ngành nghề tự do

### 9.1. Chọn “Ngành nghề khác” và tự nhập

- Áp dụng ở mọi nơi có chọn ngành nghề: đăng tin, sửa tin chiến dịch, hồ sơ công ty NTD, mục tiêu Blast, lọc hồ sơ ứng viên, lọc tìm việc, form ứng viên “Để lại thông tin”.
- Chọn “Ngành nghề khác” hiện thêm ô nhập tên ngành tự do.
- Lưu đúng tên NTD/ứng viên đã gõ, không giới hạn trong danh sách có sẵn.
- Bỏ ràng buộc danh sách cố định ở hồ sơ công ty nhà tuyển dụng, cho tự nhập giống các nơi khác.

### 9.2. Tìm kiếm/lọc ngành nghề không phân biệt hoa-thường, có dấu hay không dấu

- Chuẩn hoá ngành nghề khi lưu để so khớp không phân biệt chữ hoa/chữ thường.
- Chuẩn hoá không phân biệt có dấu hay không dấu tiếng Việt.
- Áp dụng cho lọc tin tuyển dụng, ước tính Blast, lọc hồ sơ ứng viên trong dashboard NTD.
- Chỉ cần gõ một phần ký tự là lọc ra ngành nghề có chứa ký tự đó, không cần gõ đủ nguyên cụm.
- Tính năng tự động Blast Zalo khi mua gói Chiến dịch (mục 6.3) vẫn so khớp đúng nguyên cụm ngành nghề để đảm bảo gửi đúng đối tượng.

## 10. Dịch vụ trọn gói cho doanh nghiệp

### 10.1. Xem gói dịch vụ và gửi yêu cầu tư vấn

- Xem danh sách gói dịch vụ tại trang “Dịch vụ trọn gói”: RPO tuyển dụng theo yêu cầu, Hợp đồng lao động & hồ sơ nhân sự, Đăng ký BHXH/BHYT/BHTN, Khai thuế TNCN, Tư vấn pháp lý lao động, gói Full-Package trọn gói.
- Xem mô tả, các đầu việc bao gồm và giá tham khảo của từng gói.
- Mở form gửi yêu cầu tư vấn ngay tại gói muốn đặt.
- Nhập tên công ty/nhà tuyển dụng, số điện thoại, email và nội dung yêu cầu.
- Kiểm tra dữ liệu trước khi gửi.
- Lưu yêu cầu vào hệ thống, gắn loại “Dịch vụ trọn gói”, trạng thái “Chưa tư vấn”.
- Thông báo gửi yêu cầu thành công.

### 10.2. Nhà tuyển dụng theo dõi dịch vụ đã đặt

- Xem danh sách các yêu cầu tư vấn đã gửi tại mục “Dịch vụ đã đặt” trong dashboard.
- Tự động khớp yêu cầu với tài khoản theo số điện thoại, kể cả yêu cầu gửi trước khi có tài khoản.
- Xem thời gian gửi, loại dịch vụ, nội dung yêu cầu và trạng thái xử lý.
- Hủy yêu cầu khi còn ở trạng thái “Chưa tư vấn”, bắt buộc nhập lý do hủy.
- Không cho hủy yêu cầu đã được tư vấn hoặc đã hủy trước đó.

### 10.3. Admin quản lý gói dịch vụ và yêu cầu tư vấn

- Xem, thêm, chỉnh sửa, ẩn/hiện và xóa các gói dịch vụ trọn gói.
- Xem danh sách yêu cầu tư vấn, lọc theo Tất cả/Chưa tư vấn/Đã tư vấn/Đã hủy đăng ký.
- Tìm kiếm yêu cầu tư vấn.
- Xem chi tiết từng yêu cầu.
- Đánh dấu đã tư vấn/chưa tư vấn.
- Đánh dấu yêu cầu đã hủy đăng ký.
- Hiển thị số lượng yêu cầu mới chưa xử lý ở menu quản trị.

## 11. Quảng cáo và hợp tác

### 11.1. Quảng cáo theo Khu công nghiệp (KCN)

- Xem danh sách hình thức quảng cáo theo KCN: nhà trọ công nhân, canteen & cơm ca, siêu thị & tạp hóa, xe ôm & đưa đón KCN, quảng cáo toàn site, Blast SMS/Zalo.
- Xem mô tả và các gói đi kèm của từng hình thức.
- Gửi yêu cầu quảng cáo, nhập thêm KCN/tỉnh muốn quảng cáo.
- Nhập thông tin liên hệ và nội dung yêu cầu.
- Lưu yêu cầu vào hệ thống, gắn loại “Quảng cáo/Hợp tác”.

### 11.2. Đối tác dịch vụ

- Xem danh sách đối tác dịch vụ: bảo hiểm, vay tiêu dùng, ví điện tử, BHXH & hưu trí bổ sung.
- Lọc đối tác theo nhóm dịch vụ.
- Xem thông tin chi tiết từng đối tác trước khi gửi đề xuất.
- Gửi đề xuất hợp tác với đối tác đã chọn.
- Lưu yêu cầu vào hệ thống, gắn loại “Đối tác dịch vụ”.

### 11.3. Bảng giá quảng cáo

- Xem bảng giá các hình thức quảng cáo: banner KCN, bundle 5 KCN, card nhà trọ/dịch vụ, sidebar toàn site, banner trang chủ.
- Xem định dạng, vị trí hiển thị, đơn giá và đơn vị tính.
- Đặt quảng cáo trực tiếp theo mục giá đã chọn.
- Lưu yêu cầu vào hệ thống, gắn loại “Bảng giá quảng cáo”.

### 11.4. Hiển thị quy mô tiếp cận

- Hiển thị số lượng ứng viên công nhân thật trong hệ thống ngay tại trang Quảng cáo/Hợp tác để nhà quảng cáo tham khảo quy mô tiếp cận.

### 11.5. Admin quản lý quảng cáo và đối tác

- Quản lý danh sách đối tác dịch vụ: thêm, sửa, ẩn/hiện, xóa.
- Quản lý danh sách hình thức quảng cáo KCN: thêm, sửa, ẩn/hiện, xóa.
- Quản lý bảng giá quảng cáo: thêm, sửa, ẩn/hiện, xóa.
- Xem và xử lý yêu cầu quảng cáo KCN riêng theo từng nhóm.
- Xem và xử lý yêu cầu hợp tác đối tác dịch vụ riêng theo từng nhóm.
- Xem và xử lý yêu cầu đặt bảng giá quảng cáo riêng theo từng nhóm.
- Hiển thị số lượng yêu cầu mới chưa xử lý ở menu quản trị.

## 12. Tổng kết các nhóm chức năng đã hoàn thành

1. Xây dựng cấu trúc dự án và cơ sở dữ liệu.
2. Xây dựng đăng ký, đăng nhập và phân quyền.
3. Xây dựng luồng xác minh nhà tuyển dụng.
4. Xây dựng đăng tin và duyệt tin tuyển dụng.
5. Xây dựng các gói dịch vụ và hạn mức đăng tin.
6. Xây dựng tìm kiếm, lọc và xem chi tiết việc làm.
7. Xây dựng ứng tuyển và để lại thông tin ứng viên.
8. Xây dựng quản lý trạng thái ứng viên.
9. Xây dựng giới hạn xem thông tin liên hệ theo gói.
10. Xây dựng chiến dịch tuyển dụng và Blast.
11. Xây dựng dashboard và các module quản trị Admin.
12. Xây dựng quản lý bài viết, tin tức, quyền lợi và hỏi đáp.
13. Xây dựng danh sách Khu công nghiệp (KCN) toàn quốc.
14. Xây dựng quản lý đối tác doanh thu (Revenue Partners).
15. Xây dựng tự động Blast Zalo khi mua gói Chiến dịch.
16. Xây dựng chuẩn hoá và mở rộng tìm kiếm ngành nghề tự do.
17. Xây dựng Dịch vụ trọn gói cho doanh nghiệp và luồng yêu cầu tư vấn.
18. Xây dựng Quảng cáo/Hợp tác (KCN, đối tác dịch vụ, bảng giá quảng cáo).
17. Xây dựng quản lý Khu công nghiệp (KCN) toàn quốc phía Admin — thêm/sửa/xóa — và cho nhà tuyển dụng chọn đúng KCN thật khi đăng tin.
18. Xây dựng chọn số lượng ứng viên nhận Blast SMS/Zalo, ưu tiên gửi cho ứng viên mới điền form/mới ứng tuyển gần đây nhất.

## 11. Chức năng còn thiếu / chưa hoàn thiện

### 11.1. Trang "Quảng cáo / Hợp tác" — chưa có nội dung

- Trang hiện chỉ hiển thị tiêu đề và mô tả ngắn, chưa có nội dung chi tiết.
- Chưa có danh sách gói quảng cáo theo KCN (banner, card nhà trọ/dịch vụ, blast SMS/Zalo) kèm bảng giá.
- Chưa có form đăng ký đặt quảng cáo cho doanh nghiệp/đối tác dịch vụ.
- Chưa có danh sách đối tác dịch vụ (bảo hiểm, tài chính, ví điện tử, BHXH...) hiển thị công khai kèm form gửi đề xuất hợp tác.
- Phần quản trị (Admin quản lý đối tác doanh thu) đã có và hoạt động với dữ liệu thật, nhưng chưa có nơi hiển thị công khai để khách xem/đăng ký — dữ liệu Admin nhập vào chưa hiển thị ra ngoài trang này.

### 11.2. Trang "Dịch vụ trọn gói" — chưa có nội dung

- Trang hiện chỉ hiển thị tiêu đề và mô tả ngắn, chưa có nội dung chi tiết.
- Chưa có nội dung giới thiệu từng dịch vụ: RPO (tuyển dụng theo yêu cầu), soạn hợp đồng lao động/hồ sơ nhân sự, đăng ký BHXH/BHYT/BHTN, khai thuế TNCN cho công nhân, tư vấn pháp lý lao động, gói trọn gói (Full-Package).
- Chưa có bảng giá tham khảo cho từng dịch vụ.
- Chưa có form liên hệ/nhận báo giá để nhà tuyển dụng gửi yêu cầu sử dụng dịch vụ.

### 11.3. Thanh toán VNPay/MoMo — chưa tích hợp cổng thanh toán thật

- Hiện tại nhà tuyển dụng chỉ chọn nhãn phương thức thanh toán (Chuyển khoản/MoMo/VNPay) rồi tự bấm "Xác nhận đã thanh toán" — không có bước chuyển sang cổng thanh toán thật để quét mã/nhập thẻ.
- Đơn hàng vào trạng thái chờ, Admin phải tự tay kiểm tra và xác nhận đã nhận tiền trong trang quản trị đơn hàng.
- Chưa có kết nối SDK VNPay/MoMo và chưa có endpoint nhận callback tự động xác nhận thanh toán từ 2 cổng này.

### 11.4. Gửi SMS/Zalo thật — chưa tích hợp cổng gửi tin nhắn

- Toàn bộ luồng tạo chiến dịch Blast (ước tính số ứng viên, tính giá, lọc theo tỉnh/ngành, giới hạn số lượng, lưu lịch sử) đã hoạt động đúng với dữ liệu thật.
- Tuy nhiên tin nhắn chưa thực sự được gửi tới điện thoại ứng viên — hệ thống mới dừng ở bước lưu chiến dịch vào hàng chờ, chưa kết nối với nhà cung cấp SMS/Zalo để gửi thật.

### 11.5. Tài khoản và đăng nhập của Ứng viên — chưa xây dựng

- Ứng viên hiện chưa có tài khoản, chưa đăng nhập được bằng số điện thoại/mã OTP.
- Ứng viên chỉ có thể điền form ứng tuyển hoặc form "Để lại thông tin" một lần, chưa có nơi để tự quay lại xem tiến trình hồ sơ của mình (mới nộp/đã xem/đã liên hệ/đã tuyển/từ chối) — thông tin này hiện chỉ nhà tuyển dụng và Admin xem được.

### 11.6. Cài đặt hệ thống (Admin) — chưa lưu được cấu hình

- Trang Cài đặt có các ô nhập thông tin website và khóa kết nối SMS/Zalo (ESMS API Key, Zalo OA Token), nhưng chưa có nút lưu và chưa lưu được vào hệ thống — gõ vào rồi mất khi rời trang.
- Cấu hình thật hiện đang được thiết lập trực tiếp trên server, chưa chỉnh được qua giao diện quản trị.

### 11.7. Các tích hợp bên thứ ba khác chưa có

- **Bản đồ KCN**: dữ liệu tọa độ từng KCN đã có sẵn trong hệ thống nhưng chưa hiển thị thành bản đồ trực quan, hiện chỉ hiển thị dạng danh sách/bảng.
- **Upload ảnh/logo**: nhà tuyển dụng phải tự có sẵn đường dẫn ảnh online rồi dán vào, chưa upload file trực tiếp được từ máy tính.
- **Email tự động**: chưa gửi được email xác nhận đăng ký, xác nhận đơn hàng.
- **Theo dõi lỗi hệ thống**: chưa có công cụ giám sát lỗi tự động cho đội kỹ thuật.

### 11.8. Lưu ý: mô hình gói tài khoản đã thay đổi so với thiết kế ban đầu

- Thiết kế ban đầu là mua từng tin theo 4 gói riêng lẻ (Free/Basic/Featured/Chiến dịch). Hệ thống hiện tại đã đổi sang mô hình thuê bao tài khoản (Free/Basic/Premium — gói nào cấp quyền đăng bấy nhiêu tin/ngày, không mua lẻ theo từng tin), riêng gói Chiến dịch vẫn giữ mua lẻ theo từng tin như thiết kế ban đầu. Đây là thay đổi có chủ đích, không phải thiếu sót, nêu ra để tránh nhầm lẫn khi đối chiếu với tài liệu thiết kế gốc.
