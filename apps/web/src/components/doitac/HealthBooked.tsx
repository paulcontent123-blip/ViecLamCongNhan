"use client";

import { ProviderBooked } from "@/components/doitac/ProviderBooked";
import { listBooked } from "@/lib/health-provider-client";
import { ROUTES } from "@/lib/routes";

export function HealthBooked() {
  return <ProviderBooked listBooked={listBooked} loginHref={ROUTES.yTeDoiTacLogin} />;
}
