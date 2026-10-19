"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/hooks/use-toast";
import { services } from "@/services";
import { isServiceError } from "@/types/domain";

/** "Reiniciar demonstração" na tela de entrada (SPEC §5): restaura os dados de seed, com confirmação. */
export function ResetDemoButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      await services.demo.reset();
      setOpen(false);
      toast.success("Demonstração reiniciada.");
    } catch (error) {
      toast.error(isServiceError(error) ? error.message : "Não foi possível reiniciar a demonstração.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" icon={RotateCcw} className="-ml-4" onClick={() => setOpen(true)}>
        Reiniciar demonstração
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reiniciar a demonstração?"
        description="Itens, reivindicações e contas criadas por você são apagados e os dados voltam ao estado inicial."
        confirmLabel="Reiniciar"
        confirmingLabel="Reiniciando…"
        busy={busy}
        onConfirm={() => void reset()}
      />
    </>
  );
}
