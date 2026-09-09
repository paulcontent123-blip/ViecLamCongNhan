// Đóng gói app Next.js thành thư mục sẵn sàng upload lên cPanel Node.js App.
//
//   pnpm package:cpanel        → gói đầy đủ (có node_modules) — dùng cho lần deploy đầu
//                                hoặc khi package.json đổi dependency.
//   pnpm package:cpanel:app    → gói nhanh (chỉ code) — dùng cho các lần sửa code thường ngày.
//
// Vì sao cần script này: `output: "standalone"` của Next KHÔNG tự copy
// .next/static và public/ vào bundle — thiếu 2 thư mục đó thì site vẫn chạy
// nhưng mất toàn bộ CSS/JS/ảnh.

import { cp, rm, mkdir, writeFile, access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps", "web");
const standalone = path.join(web, ".next", "standalone");

const appOnly = process.argv.includes("--app-only");
const out = path.join(root, appOnly ? "dist-cpanel-app" : "dist-cpanel");

const exists = (p) => access(p).then(() => true, () => false);

if (!(await exists(standalone))) {
  console.error("Chưa có .next/standalone — chạy `pnpm build` trước.");
  process.exit(1);
}

const buildIdPath = path.join(web, ".next", "BUILD_ID");
const cssDir = path.join(web, ".next", "static", "css");
if (!(await exists(buildIdPath))) {
  console.error("Thiếu .next/BUILD_ID — build Next.js chưa hoàn chỉnh.");
  process.exit(1);
}
if (!(await exists(cssDir))) {
  console.error("Thiếu .next/static/css — build đang thiếu CSS.");
  process.exit(1);
}

const buildId = (await readFile(buildIdPath, "utf8")).trim();
const cssFiles = (await readdir(cssDir)).filter((file) => file.endsWith(".css"));
if (!buildId) {
  console.error(".next/BUILD_ID đang rỗng — build Next.js chưa hợp lệ.");
  process.exit(1);
}
if (cssFiles.length === 0) {
  console.error(".next/static/css không có file CSS — dừng đóng gói để tránh deploy mất giao diện.");
  process.exit(1);
}

console.log(`Kiểm tra build: BUILD_ID=${buildId}; CSS=${cssFiles.length} file.`);

console.log("Xoá bản đóng gói cũ...");
await rm(out, { recursive: true, force: true });

if (appOnly) {
  // node_modules và server.js trên server giữ nguyên, chỉ thay .next.
  console.log("Chế độ --app-only: bỏ qua node_modules.");
  await mkdir(path.join(out, "apps", "web"), { recursive: true });
  await cp(
    path.join(standalone, "apps", "web", ".next"),
    path.join(out, "apps", "web", ".next"),
    { recursive: true }
  );
  // Phải kèm cả server.js và package.json của apps/web: quy trình cập nhật
  // xoá nguyên thư mục apps/ trước khi giải nén, nếu gói thiếu 2 file này thì
  // server.js ở gốc require không ra và app chết với MODULE_NOT_FOUND.
  for (const f of ["server.js", "package.json"]) {
    await cp(
      path.join(standalone, "apps", "web", f),
      path.join(out, "apps", "web", f)
    );
  }
} else {
  console.log("Copy standalone server + node_modules...");
  await cp(standalone, out, { recursive: true });
}

console.log("Copy .next/static...");
await cp(
  path.join(web, ".next", "static"),
  path.join(out, "apps", "web", ".next", "static"),
  { recursive: true }
);

const publicDir = path.join(web, "public");
if (await exists(publicDir)) {
  console.log("Copy public/...");
  await mkdir(path.join(out, "apps", "web", "public"), { recursive: true });
  await cp(publicDir, path.join(out, "apps", "web", "public"), { recursive: true });
}

const packagedBuildId = (await readFile(path.join(out, "apps", "web", ".next", "BUILD_ID"), "utf8")).trim();
const packagedCssFiles = (await readdir(path.join(out, "apps", "web", ".next", "static", "css")))
  .filter((file) => file.endsWith(".css"));
if (packagedBuildId !== buildId || packagedCssFiles.length === 0) {
  console.error("Kiểm tra gói thất bại: BUILD_ID hoặc CSS không được copy đầy đủ.");
  process.exit(1);
}
console.log(`Kiểm tra gói: BUILD_ID=${packagedBuildId}; CSS=${packagedCssFiles.length} file.`);

if (!appOnly) {
  // standalone copy nguyên package.json của monorepo (có turbo/supabase) ra gốc.
  // Thay bằng bản tối giản để cPanel không cài thừa nếu bấm "Run NPM Install" —
  // node_modules đã được đóng gói sẵn nên không cần cài thêm gì.
  console.log("Ghi package.json tối giản...");
  const pkg = {
    name: "vieclamcongnhan",
    version: "0.1.0",
    private: true,
    main: "server.js",
    scripts: { start: "node server.js" },
    engines: { node: ">=20" },
  };
  await writeFile(path.join(out, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // cPanel Passenger cần một file khởi động ở gốc Application root.
  // server.js của Next tự gọi process.chdir(__dirname) nên chỉ cần require lại.
  console.log("Tạo server.js ở gốc...");
  await writeFile(
    path.join(out, "server.js"),
    [
      "// Điểm khởi động cho cPanel Node.js App.",
      "// server.js của Next tự process.chdir(__dirname) nên chỉ cần require là đủ.",
      'require("./apps/web/server.js");',
      "",
    ].join("\n")
  );
}

// Nén sẵn thành .zip để upload thẳng qua File Manager của cPanel.
// Phải Set-Location vào thư mục rồi nén `*` tương đối — nếu truyền đường dẫn
// tuyệt đối dạng <out>* thì Compress-Archive bọc thêm một cấp thư mục cha,
// giải nén trên server sẽ ra sai vị trí.
const zip = out + ".deploy.zip";
await rm(zip, { force: true });
if (process.platform === "win32") {
  console.log("Nén thành .zip...");
  const { execFileSync } = await import("node:child_process");
  try {
    // tar.exe có sẵn trên Windows 10/11 và không phụ thuộc module PowerShell.
    execFileSync("tar.exe", ["-a", "-c", "-f", zip, "-C", out, "."], { stdio: "inherit" });
  } catch {
    // Fallback cho máy Windows cũ không có tar.exe.
    console.warn("tar.exe không khả dụng, chuyển sang Compress-Archive...");
    await rm(zip, { force: true });
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Set-Location -LiteralPath '${out}'; Compress-Archive -Path '*' -DestinationPath '${zip}' -CompressionLevel Optimal`,
      ],
      { stdio: "inherit" }
    );
  }
} else {
  console.log("Bỏ qua bước nén (chỉ tự nén trên Windows).");
}

const dir = path.basename(out);
console.log(`\nXong: ${dir}/`);
if (appOnly) {
  console.log("Nén rồi giải nén ĐÈ lên /home/suaembec/vieclamcongnhan, sau đó RESTART app.");
} else {
  console.log("Upload toàn bộ nội dung lên Application root. Startup file: server.js");
}
