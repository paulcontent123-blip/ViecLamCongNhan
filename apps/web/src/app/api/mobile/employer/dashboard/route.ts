import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerApplications, getEmployerJobs } from "@/lib/employer";

const headers = { "Cache-Control": "private, no-store" };
const RECENT_LIMIT = 10;

export async function GET() {
  try {
    const session = await getEmployerSession();
    if (!session) {
      return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    }

    const [jobs, applications] = await Promise.all([
      getEmployerJobs(session.employerId),
      getEmployerApplications(session.employerId),
    ]);
    const now = Date.now();

    return NextResponse.json({
      ok: true,
      summary: {
        newApplications: applications.filter((application) => application.status === "new").length,
        totalApplications: applications.length,
        activeJobs: jobs.filter((job) =>
          job.status === "approved" && (!job.expires_at || Date.parse(job.expires_at) > now),
        ).length,
        hiredApplications: applications.filter((application) => application.status === "hired").length,
        totalJobs: jobs.length,
      },
      jobs: jobs.slice(0, RECENT_LIMIT).map((job) => ({
        id: job.id,
        slug: job.slug,
        title: job.title,
        tier: job.tier,
        status: job.status,
        apply_count: job.apply_count,
        view_count: job.view_count,
        expires_at: job.expires_at,
        created_at: job.created_at,
        province_code: job.province_code,
        industry: job.industry,
      })),
      applications: applications.slice(0, RECENT_LIMIT).map((application) => ({
        id: application.id,
        status: application.status,
        created_at: application.created_at,
        updated_at: application.updated_at,
        jobs: application.jobs ? {
          title: application.jobs.title,
          slug: application.jobs.slug,
        } : null,
        candidates: application.candidates ? {
          id: application.candidates.id,
          full_name: application.candidates.full_name,
          province: application.candidates.province,
          desired_industry: application.candidates.desired_industry,
          experience_years: application.candidates.experience_years,
        } : null,
      })),
    }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/employer/dashboard failed:", error);
    return NextResponse.json({ error: "Không tải được dữ liệu tuyển dụng." }, { status: 500, headers });
  }
}
