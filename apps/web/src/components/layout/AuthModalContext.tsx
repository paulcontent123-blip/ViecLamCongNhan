"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { AuthModal } from "@/components/layout/AuthModal";

type Role = "admin" | "employer";

interface AuthModalContextValue {
  openAuthModal: (role?: Role) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

// Modal quản lý ở 1 chỗ duy nhất (Provider bọc toàn app trong layout.tsx) để bất
// kỳ trang/component nào cũng gọi mở được — không chỉ riêng Navbar (vd: nút
// "Tạo tài khoản" trên trang Tuyển dụng công khai cần mở modal đăng ký NTD).
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialRole, setInitialRole] = useState<Role>("admin");

  function openAuthModal(role: Role = "admin") {
    setInitialRole(role);
    setIsOpen(true);
  }

  return (
    <AuthModalContext.Provider value={{ openAuthModal }}>
      {children}
      <AuthModal isOpen={isOpen} initialRole={initialRole} onClose={() => setIsOpen(false)} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal phải được gọi bên trong <AuthModalProvider>");
  return ctx;
}
