import { NextRequest, NextResponse } from "next/server";
import { getJobs, type JobFilters } from "@/lib/jobs";

function parseFilters(searchParams: URLSearchParams): JobFilters {
  const truthy = (v: string | null) => v === "1" || v === "true";

  return {
    province: searchParams.get("province") ?? undefined,
    industry: searchParams.get("industry") ?? undefined,
    kcnId: searchParams.get("kcnId") ?? undefined,
    salaryMin: searchParams.get("salaryMin") ? Number(searchParams.get("salaryMin")) : undefined,
    urgent: truthy(searchParams.get("urgent")),
    housing: truthy(searchParams.get("housing")),
    shuttle: truthy(searchParams.get("shuttle")),
    meals: truthy(searchParams.get("meals")),
    noExperience: truthy(searchParams.get("noExperience")),
    shift: (searchParams.get("shift") as JobFilters["shift"]) || undefined,
    q: searchParams.get("q") || undefined,
    sort: searchParams.get("sort") === "salary_desc" ? "salary_desc" : "newest",
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const { jobs, total } = await getJobs(filters);
  return NextResponse.json({ jobs, total });
}
