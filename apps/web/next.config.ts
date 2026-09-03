import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gói toàn bộ server + node_modules cần thiết vào .next/standalone
  // để chạy trên cPanel Node.js App mà không cần pnpm install trên server.
  output: "standalone",
  // Monorepo: trace file từ gốc repo, nếu không standalone sẽ thiếu dependency.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
