-- Tin tức & Quyền lợi: tách 3 mục "Tin tức & Bài viết" / "Quyền lợi & Pháp lý" / "Hỏi
-- đáp" (trước đây gộp chung 1 trang tab trong bản HTML demo) thành 3 bảng dữ liệu
-- riêng, phục vụ 3 trang thật (route thật, không phải JS tab-toggle).

-- Tin tức & Bài viết
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null,
  category text not null
    constraint articles_category_check check (
      category in ('luong_thuong', 'bhxh_baohiem', 'phap_ly_lao_dong', 'phuc_loi', 'tin_kcn', 'an_toan_lao_dong')
    ),
  read_minutes integer not null default 5,
  status text not null default 'draft'
    constraint articles_status_check check (status in ('draft', 'published')),
  published_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_idx on public.articles (status, published_at desc);
create index if not exists articles_category_idx on public.articles (category);

-- Quyền lợi & Pháp lý — thẻ tra cứu nhanh số liệu pháp luật lao động, Admin sửa được
-- (khác các bảng giá gói dịch vụ trong code — nội dung này thay đổi theo luật).
create table if not exists public.right_cards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  icon text not null default '⚖',
  title text not null,
  summary text not null,
  content text,
  effective_note text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists right_cards_active_sort_idx on public.right_cards (is_active, sort_order);

-- Hỏi đáp — NLĐ gửi câu hỏi qua form công khai (lead gen VEA Law). Admin trả lời rồi
-- có thể "duyệt" (status='published') để đăng công khai vào danh sách FAQ ở /hoi-dap.
-- contact KHÔNG BAO GIỜ hiển thị công khai, chỉ Admin xem được.
create table if not exists public.qa_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  full_name text,
  contact text,
  answer text,
  status text not null default 'new'
    constraint qa_questions_status_check check (status in ('new', 'answered', 'published')),
  answered_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists qa_questions_status_idx on public.qa_questions (status, sort_order);

alter table public.articles enable row level security;
alter table public.right_cards enable row level security;
alter table public.qa_questions enable row level security;

-- Đọc công khai: chỉ nội dung đã published/active — bản nháp, câu hỏi chưa duyệt và
-- contact info của người hỏi không bao giờ lộ ra anon/authenticated.
create policy "articles_public_read_published" on public.articles
  for select
  to anon, authenticated
  using (status = 'published');

create policy "right_cards_public_read_active" on public.right_cards
  for select
  to anon, authenticated
  using (is_active = true);

create policy "qa_questions_public_read_published" on public.qa_questions
  for select
  to anon, authenticated
  using (status = 'published');

revoke select on public.qa_questions from anon, authenticated;
grant select (id, question, answer, sort_order, created_at) on public.qa_questions to anon, authenticated;

-- ───────────────────────────── Dữ liệu mẫu ─────────────────────────────
-- Nguồn: document/vieclamcongnhan_FINAL_2.html (mục pg-rights) — giữ nguyên nội dung
-- gốc để không lệch với thiết kế đã duyệt.

insert into public.articles (slug, title, excerpt, content, category, read_minutes, status, published_at) values
(
  'muc-luong-toi-thieu-vung-2026',
  'Mức lương tối thiểu vùng 2026 — Tất cả 4 vùng cập nhật mới nhất',
  'Chính phủ vừa công bố mức lương tối thiểu vùng áp dụng từ 01/07/2026, tăng ở cả 4 vùng so với năm trước.',
  E'Từ ngày 01/07/2026, mức lương tối thiểu vùng mới chính thức có hiệu lực trên cả 4 vùng lương:\n\n- Vùng 1 (TP.HCM, Hà Nội, Hải Phòng, Đà Nẵng, Cần Thơ...): 4.960.000đ/tháng\n- Vùng 2: 4.410.000đ/tháng\n- Vùng 3: 3.860.000đ/tháng\n- Vùng 4: 3.450.000đ/tháng\n\nDoanh nghiệp trả lương thấp hơn mức tối thiểu vùng tương ứng là vi phạm Bộ luật Lao động 2019 và có thể bị xử phạt hành chính. Người lao động phát hiện công ty trả lương dưới mức tối thiểu vùng có quyền khiếu nại lên Phòng Lao động - Thương binh và Xã hội cấp huyện/tỉnh nơi doanh nghiệp hoạt động.\n\nLưu ý: mức lương tối thiểu vùng là mức SÀN cho lao động chưa qua đào tạo, làm công việc giản đơn nhất trong điều kiện lao động bình thường — nhiều doanh nghiệp trả cao hơn mức này tùy theo vị trí, tay nghề và thỏa thuận.',
  'luong_thuong', 5, 'published', '2026-08-10 08:00:00+07'
),
(
  'bhxh-tu-nguyen-2025-them-quyen-loi-thai-san',
  'BHXH tự nguyện 2025: Thêm quyền lợi thai sản từ tháng 7',
  'Từ tháng 7, người tham gia BHXH tự nguyện được bổ sung chế độ thai sản — quyền lợi vốn chỉ dành cho BHXH bắt buộc trước đây.',
  E'Theo quy định mới có hiệu lực từ tháng 7, người lao động tự do tham gia BHXH tự nguyện được hưởng thêm chế độ thai sản — một quyền lợi trước đây chỉ áp dụng cho người tham gia BHXH bắt buộc.\n\nĐiều kiện hưởng: đóng BHXH tự nguyện đủ 6 tháng trở lên trong vòng 12 tháng trước khi sinh con. Mức trợ cấp một lần khi sinh con bằng 2 lần mức lương cơ sở tại tháng sinh.\n\nĐây là bước tiến quan trọng giúp lao động tự do, lao động thời vụ tại các KCN — nhóm thường không có hợp đồng lao động chính thức — có thêm lưới an sinh khi sinh con. VEA khuyến khích công nhân tìm hiểu và tham gia BHXH tự nguyện sớm để đảm bảo đủ thời gian đóng khi cần hưởng chế độ.',
  'bhxh_baohiem', 7, 'published', '2026-08-05 08:00:00+07'
),
(
  'bi-sa-thai-trai-luat-5-dieu-can-lam-ngay',
  'Bị sa thải trái luật — 5 điều công nhân cần làm ngay',
  'Bị cho nghỉ việc đột ngột, không lý do rõ ràng? Đây là 5 việc cần làm ngay để bảo vệ quyền lợi của bạn.',
  E'Nếu bạn bị sa thải mà không có lý do chính đáng hoặc công ty không tuân thủ đúng quy trình theo Bộ luật Lao động, đây là 5 việc cần làm ngay:\n\n1. Yêu cầu quyết định sa thải bằng văn bản — đừng chỉ nhận thông báo miệng.\n2. Giữ lại toàn bộ bằng chứng: hợp đồng lao động, bảng lương, tin nhắn/email liên quan.\n3. Kiểm tra căn cứ sa thải có đúng quy định tại Điều 36 Bộ luật Lao động 2019 hay không.\n4. Khiếu nại bằng văn bản tới công ty trong thời gian sớm nhất.\n5. Nếu không được giải quyết, gửi đơn tới Phòng Lao động - Thương binh và Xã hội hoặc khởi kiện ra Tòa án lao động.\n\nNếu sa thải trái luật, người lao động có quyền được nhận trở lại làm việc hoặc được bồi thường tương đương 2 tháng lương cho mỗi năm làm việc, cộng với trợ cấp thôi việc theo quy định.',
  'phap_ly_lao_dong', 6, 'published', '2026-08-01 08:00:00+07'
),
(
  'thuong-tet-2026-muc-thuong-trung-binh-va-cach-tinh',
  'Thưởng Tết 2026: Mức thưởng trung bình và cách tính',
  'Khảo sát sơ bộ tại các KCN cho thấy mức thưởng Tết trung bình tăng nhẹ so với năm trước — cách tính thưởng theo luật là gì?',
  E'Thưởng Tết không phải là khoản bắt buộc theo luật, nhưng là quyền lợi phổ biến được quy định trong thỏa ước lao động tập thể hoặc quy chế thưởng của từng doanh nghiệp.\n\nTheo khảo sát sơ bộ tại các KCN trọng điểm, mức thưởng Tết 2026 trung bình dao động 1–2 tháng lương, tùy theo kết quả kinh doanh và thâm niên làm việc.\n\nCách tính phổ biến: Thưởng = (Số tháng làm việc trong năm / 12) × Mức thưởng 1 tháng lương cơ bản. Người lao động mới vào làm chưa đủ năm vẫn được thưởng theo tỷ lệ thời gian làm việc thực tế, trừ khi quy chế công ty quy định khác và đã được công khai từ đầu.\n\nNếu công ty có quy chế thưởng rõ ràng nhưng không thực hiện đúng cam kết, người lao động có quyền khiếu nại theo quy chế nội bộ hoặc pháp luật lao động.',
  'phuc_loi', 4, 'published', '2026-07-28 08:00:00+07'
),
(
  'kcn-yen-phong-mo-rong-giai-doan-3',
  'KCN Yên Phong mở rộng giai đoạn 3 — thêm 15.000 việc làm mới',
  'Giai đoạn 3 của KCN Yên Phong (Bắc Ninh) chính thức khởi công, dự kiến tạo thêm 15.000 vị trí việc làm cho lao động phổ thông.',
  E'KCN Yên Phong (Bắc Ninh) vừa khởi công giai đoạn 3 mở rộng, nâng tổng diện tích lên gấp rưỡi so với hiện tại. Dự án dự kiến thu hút thêm các nhà máy trong lĩnh vực điện tử, linh kiện bán dẫn và cơ khí chính xác.\n\nTheo kế hoạch, giai đoạn 3 sẽ tạo ra khoảng 15.000 vị trí việc làm mới cho lao động phổ thông và lao động có tay nghề, dự kiến tuyển dụng bắt đầu từ quý cuối năm.\n\nĐây là tin vui cho lao động tại khu vực Bắc Ninh và các tỉnh lân cận — ViecLamCongNhan.com sẽ cập nhật các tin tuyển dụng chính thức từ những nhà máy đầu tiên đi vào hoạt động tại khu mở rộng ngay khi có thông tin.',
  'tin_kcn', 3, 'published', '2026-07-20 08:00:00+07'
),
(
  'an-toan-ve-sinh-lao-dong-2026-quy-dinh-moi',
  'An toàn vệ sinh lao động 2026: Quy định mới nhà tuyển dụng phải biết',
  'Quy định mới siết chặt trách nhiệm của doanh nghiệp trong việc đảm bảo an toàn lao động — người lao động cũng cần biết quyền của mình.',
  E'Quy định mới về an toàn, vệ sinh lao động có hiệu lực năm 2026 siết chặt hơn trách nhiệm của doanh nghiệp sản xuất, đặc biệt tại các ngành có nguy cơ cao như cơ khí, hóa chất, điện tử.\n\nMột số điểm đáng chú ý:\n\n- Doanh nghiệp bắt buộc huấn luyện an toàn lao động định kỳ cho 100% công nhân trực tiếp sản xuất, không chỉ khi tuyển mới.\n- Trang bị bảo hộ lao động phải đúng chuẩn theo từng vị trí công việc, không thu phí công nhân.\n- Tăng mức phạt với doanh nghiệp để xảy ra tai nạn lao động do không tuân thủ quy định an toàn.\n\nNgười lao động có quyền từ chối làm việc và rời khỏi nơi làm việc mà vẫn được trả đủ lương nếu thấy rõ nguy cơ mất an toàn nghiêm trọng, đồng thời phải báo ngay cho người quản lý trực tiếp.',
  'an_toan_lao_dong', 8, 'published', '2026-07-15 08:00:00+07'
);

insert into public.right_cards (slug, icon, title, summary, content, effective_note, sort_order) values
(
  'luong-toi-thieu-vung-2026',
  '💰',
  'Lương tối thiểu vùng 2026',
  E'Vùng 1 (HCM, HN, HP...): 4.960.000đ/tháng\nVùng 2: 4.410.000đ · Vùng 3: 3.860.000đ\nVùng 4: 3.450.000đ',
  E'Mức lương tối thiểu vùng là mức lương thấp nhất làm cơ sở để doanh nghiệp và người lao động thỏa thuận, trả lương cho lao động chưa qua đào tạo làm công việc giản đơn nhất trong điều kiện lao động bình thường.\n\n- Vùng 1 (TP.HCM, Hà Nội, Hải Phòng, Đà Nẵng, Cần Thơ...): 4.960.000đ/tháng\n- Vùng 2: 4.410.000đ/tháng\n- Vùng 3: 3.860.000đ/tháng\n- Vùng 4: 3.450.000đ/tháng\n\nDoanh nghiệp trả lương thấp hơn mức tương ứng với vùng hoạt động là vi phạm pháp luật lao động và có thể bị xử phạt hành chính.',
  'Hiệu lực từ 01/07/2026',
  1
),
(
  'phu-cap-lam-them-gio',
  '🌙',
  'Phụ cấp làm thêm giờ',
  E'Ngày thường: 150% lương\nNgày nghỉ tuần: 200%\nNgày lễ, Tết: 300%\nNếu công ty trả thấp hơn → có quyền khiếu nại',
  E'Theo Bộ luật Lao động 2019, người lao động làm thêm giờ được trả lương tính theo đơn giá tiền lương hoặc tiền lương thực trả theo công việc đang làm như sau:\n\n- Vào ngày thường: ít nhất bằng 150%.\n- Vào ngày nghỉ hằng tuần: ít nhất bằng 200%.\n- Vào ngày nghỉ lễ, Tết, ngày nghỉ có hưởng lương: ít nhất bằng 300% (chưa kể tiền lương ngày lễ, Tết, ngày nghỉ có hưởng lương đối với người lao động hưởng lương ngày).\n\nNếu công ty trả phụ cấp làm thêm giờ thấp hơn mức tối thiểu này, người lao động có quyền khiếu nại tới công đoàn cơ sở, Phòng Lao động - Thương binh và Xã hội hoặc khởi kiện ra Tòa án lao động.',
  null,
  2
),
(
  'bao-hiem-xa-hoi-bat-buoc',
  '🏥',
  'Bảo hiểm xã hội bắt buộc',
  E'CN đóng: 10,5% lương\nCông ty đóng: 21,5% lương\nQuyền lợi: ốm đau, thai sản, TNLĐ, hưu trí, tử tuất\nNếu công ty không đóng → báo cơ quan BHXH',
  E'Người lao động làm việc theo hợp đồng lao động từ đủ 1 tháng trở lên bắt buộc phải tham gia BHXH bắt buộc.\n\nTỷ lệ đóng: người lao động đóng 10,5% mức lương tháng, doanh nghiệp đóng 21,5% (bao gồm BHXH, BHYT, BHTN).\n\nQuyền lợi bao gồm: chế độ ốm đau, thai sản, tai nạn lao động - bệnh nghề nghiệp, hưu trí và tử tuất.\n\nNếu phát hiện công ty không đóng hoặc đóng thiếu BHXH cho mình, người lao động có quyền tra cứu quá trình đóng trên ứng dụng VssID và báo ngay cho cơ quan BHXH tỉnh/huyện nơi doanh nghiệp đăng ký để được can thiệp.',
  null,
  3
),
(
  'hop-dong-lao-dong',
  '📋',
  'Hợp đồng lao động',
  E'Có quyền yêu cầu ký HĐ từ ngày đầu\nĐược nhận 1 bản gốc HĐ\nThử việc: tối đa 60 ngày, ≥ 85% lương\nKhông ký HĐ → vi phạm luật LĐ',
  E'Người lao động có quyền yêu cầu ký hợp đồng lao động ngay từ ngày đầu tiên đi làm — đây là căn cứ pháp lý bảo vệ quyền lợi về lương, BHXH, và các chế độ khác.\n\nMỗi bên giữ một bản gốc của hợp đồng đã ký. Doanh nghiệp không giao bản gốc cho người lao động là vi phạm.\n\nThời gian thử việc tối đa 60 ngày đối với công việc có chức danh cần trình độ chuyên môn từ cao đẳng trở lên, tối đa 6 ngày với công việc phổ thông. Lương thử việc tối thiểu bằng 85% mức lương chính thức của công việc đó.\n\nDoanh nghiệp để người lao động làm việc mà không ký hợp đồng lao động là hành vi vi phạm Bộ luật Lao động 2019 và có thể bị xử phạt hành chính.',
  null,
  4
),
(
  'che-do-thai-san',
  '🤰',
  'Chế độ thai sản',
  E'Nghỉ sinh: 6 tháng (nữ) có hưởng lương\nTrợ cấp = 100% lương bình quân 6 tháng trước sinh\nChồng nghỉ hưởng: 5–14 ngày\nĐiều kiện: đóng BHXH ≥ 6 tháng trong 12 tháng',
  E'Lao động nữ sinh con được nghỉ việc hưởng chế độ thai sản trước và sau khi sinh con là 6 tháng. Trường hợp sinh đôi trở lên, từ con thứ hai trở đi mỗi con mẹ được nghỉ thêm 1 tháng.\n\nMức trợ cấp thai sản bằng 100% mức bình quân tiền lương tháng đóng BHXH của 6 tháng liền kề trước khi nghỉ sinh.\n\nLao động nam đang đóng BHXH có vợ sinh con được nghỉ việc hưởng chế độ thai sản từ 5–14 ngày làm việc tùy trường hợp (sinh thường, sinh mổ, sinh đôi...).\n\nĐiều kiện hưởng: đóng BHXH từ đủ 6 tháng trở lên trong thời gian 12 tháng trước khi sinh con.',
  null,
  5
);

insert into public.qa_questions (question, answer, status, sort_order, answered_at) values
(
  'Công ty không đóng BHXH cho tôi, tôi phải làm gì?',
  E'Bạn có quyền khiếu nại lên Cơ quan BHXH tỉnh/huyện nơi doanh nghiệp đăng ký. Bước 1: Thu thập bằng chứng (phiếu lương, HĐLĐ). Bước 2: Gửi đơn khiếu nại tới BHXH. Bước 3: Nếu không giải quyết, khởi kiện ra Tòa án lao động. VEA Law hỗ trợ miễn phí tư vấn bước đầu — gọi 1800 6888.',
  'published', 1, now()
),
(
  'Bị sa thải không có lý do, tôi có được bồi thường không?',
  E'Có. Nếu bị sa thải không đúng quy trình hoặc không có căn cứ hợp pháp, bạn được bồi thường: 2 tháng lương × số năm làm việc. Ngoài ra, công ty phải trả đủ trợ cấp thôi việc (0.5 tháng lương/năm). Liên hệ VEA Law để được hỗ trợ cụ thể.',
  'published', 2, now()
),
(
  'Công ty trả lương thấp hơn lương tối thiểu vùng, tôi làm gì?',
  E'Đây là vi phạm nghiêm trọng. Bạn có thể tố cáo lên Phòng Lao động - Thương binh và Xã hội (Phòng LĐTBXH) cấp huyện/tỉnh. Cơ quan này có thẩm quyền xử phạt hành chính và buộc công ty hoàn trả tiền lương chênh lệch. Mức phạt với công ty: 20–75 triệu đồng.',
  'published', 3, now()
),
(
  'Tôi đang thử việc, có được ký HĐLĐ không?',
  E'Có. Trong thời gian thử việc, công ty có thể ký HĐLĐ có điều khoản thử việc bên trong, hoặc ký hợp đồng thử việc riêng. Thời gian thử việc tối đa: 60 ngày với công việc đòi hỏi trình độ chuyên môn, và 6 ngày với công việc phổ thông. Lương thử việc ≥ 85% lương chính thức.',
  'published', 4, now()
),
(
  'Tôi bị tai nạn lao động, được hưởng những gì?',
  E'Nếu bị TNLĐ do lỗi của công ty, bạn được hưởng: 100% chi phí y tế điều trị TNLĐ, trợ cấp TNLĐ từ BHXH (tỷ lệ theo mức độ thương tật từ 5% trở lên), và bồi thường từ công ty ít nhất 1,5 tháng lương (nếu lỗi thuộc công ty). Liên hệ ngay khi xảy ra tai nạn — đừng ký bất kỳ văn bản nào trước khi tư vấn pháp lý.',
  'published', 5, now()
),
(
  'Công ty nợ lương, không trả, tôi cần làm gì ngay?',
  E'Bước 1: Ghi lại toàn bộ bằng chứng (tin nhắn, phiếu lương, lịch sử chuyển khoản). Bước 2: Khiếu nại nội bộ bằng văn bản. Bước 3: Nếu không giải quyết trong 5 ngày làm việc → tố cáo lên Phòng LĐTBXH hoặc Tòa án nhân dân. Bạn có thể tự thực hiện hoặc nhờ VEA Law hỗ trợ — thủ tục đơn giản, không mất nhiều chi phí.',
  'published', 6, now()
);
