"use client";

import { LogOut, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { getInitial } from "@/lib/format";
import { services } from "@/services";
import { AFFILIATION_LABEL, ROLE_LABEL, isServiceError } from "@/types/domain";

const ITEM_CLASSES =
  "touch-target flex w-full items-center gap-2 rounded-md px-3 text-left text-body font-semibold text-ink " +
  "hover:bg-primary-soft focus-visible:bg-primary-soft";

/**
 * Menu da conta (DESIGN §6.12): nome, papel, "Minha conta", "Reiniciar demonstração" e "Sair".
 * Padrão de menu: foco no primeiro item ao abrir, setas/Home/End, Esc devolve o foco ao botão.
 */
export function AccountMenu() {
  const { user, signOut } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  if (!user) return null;

  function closeAndFocusTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/entrar");
  }

  async function handleReset() {
    setResetting(true);
    try {
      await services.demo.reset();
      await signOut();
      setConfirmingReset(false);
      toast.success("Demonstração reiniciada.");
      router.replace("/entrar");
    } catch (error) {
      toast.error(isServiceError(error) ? error.message : "Não foi possível reiniciar a demonstração.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="touch-target inline-flex items-center justify-center rounded-full bg-primary text-body font-semibold text-on-primary hover:bg-primary-hover active:bg-primary-pressed"
      >
        {getInitial(user.name)}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Conta"
          onKeyDown={handleKeyDown}
          className="animate-rise absolute top-full right-0 z-40 mt-2 w-64 rounded-lg border border-line bg-surface p-2 shadow-raised"
        >
          <div role="none" className="mb-1 border-b border-line px-3 pt-1 pb-3">
            <p className="user-text font-semibold text-ink">{user.name}</p>
            <p className="text-meta text-ink-muted">{ROLE_LABEL[user.role]} · {AFFILIATION_LABEL[user.affiliation]}</p>
          </div>
          <Link href="/conta" role="menuitem" className={ITEM_CLASSES} onClick={() => setOpen(false)}>
            <UserRound aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
            Minha conta
          </Link>
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASSES}
            onClick={() => {
              setOpen(false);
              setConfirmingReset(true);
            }}
          >
            <RotateCcw aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
            Reiniciar demonstração
          </button>
          <button type="button" role="menuitem" className={ITEM_CLASSES} onClick={handleSignOut}>
            <LogOut aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
            Sair
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="Reiniciar a demonstração?"
        description="Todos os dados voltam ao estado inicial e você sairá da conta."
        confirmLabel="Reiniciar"
        confirmingLabel="Reiniciando…"
        busy={resetting}
        onConfirm={handleReset}
      />
    </div>
  );
}
