"use client";

import { useContext } from "react";
import { ToastContext, type ToastApi } from "@/providers/ToastProvider";

/** `toast.success("Item registrado.")`, `toast.error(...)`, `toast.info(...)`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return api;
}
