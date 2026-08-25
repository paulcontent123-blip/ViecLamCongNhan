import { Suspense } from "react";
import { EmployerLoginForm } from "@/components/ntd/EmployerLoginForm";

export default function EmployerLoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Suspense>
        <EmployerLoginForm />
      </Suspense>
    </div>
  );
}
