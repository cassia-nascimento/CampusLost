"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { Container } from "@/components/layout/Container";
import { DefinitionList } from "@/components/layout/DefinitionList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { checkEmailVerified, isAdmin } from "@/lib/rules";
import { services } from "@/services";
import { ROLE_LABEL } from "@/types/domain";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { exportFileName, serializeExport } from "./export-file";

function downloadJson(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** `/conta`: seus dados, "Baixar meus dados" (LGPD) e "Excluir minha conta" (escondido para a administração). */
export function AccountScreen() {
  const { user } = useSession();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null; // a guarda de rota já cuida de quem não tem sessão

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const data = await services.auth.exportMyData();
      downloadJson(exportFileName(data.exportedAt), serializeExport(data));
      toast.success("Arquivo com seus dados gerado.");
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  const verified = checkEmailVerified(user).allowed;

  return (
    <Container size="form">
      <PageHeader title="Minha conta" />

      <section aria-labelledby="account-data" className="flex flex-col gap-4">
        <h2 id="account-data" className="text-h3">
          Seus dados
        </h2>
        <DefinitionList
          items={[
            { label: "Nome", value: user.name },
            { label: "E-mail", value: user.email },
            { label: "Papel", value: ROLE_LABEL[user.role] },
            { label: "Situação do e-mail", value: verified ? "Confirmado" : "Ainda não confirmado" },
          ]}
        />
        {verified ? null : (
          <Notice tone="warning" title="Confirme seu e-mail">
            Enquanto não confirmar, você não pode cadastrar itens nem reivindicar.
            <ResendVerification className="mt-3" />
          </Notice>
        )}
      </section>

      <section aria-labelledby="account-privacy" className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="account-privacy" className="text-h3">
          Privacidade e seus dados
        </h2>
        <p className="text-body text-ink-muted">
          Você pode baixar uma cópia dos dados que o CampusLost guarda sobre você: seu cadastro, os itens que
          registrou, suas reivindicações e as devoluções feitas a você.{" "}
          <Link href="/privacidade" className="link font-semibold">
            Ler a política de privacidade
          </Link>
          .
        </p>
        {exportError ? (
          <Notice tone="danger" role="alert">
            Não foi possível gerar o arquivo agora. Tente de novo em instantes.
          </Notice>
        ) : null}
        <div>
          <Button variant="secondary" size="lg" width="mobile-full" icon={Download} loading={exporting} loadingText="Gerando…" onClick={() => void handleExport()}>
            Baixar meus dados
          </Button>
        </div>
      </section>

      {isAdmin(user) ? (
        <p className="mt-8 border-t border-line pt-6 text-body text-ink-muted">
          A conta de administração não pode ser excluída por aqui.
        </p>
      ) : (
        <section aria-labelledby="account-delete" className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="account-delete" className="text-h3">
            Excluir minha conta
          </h2>
          <p className="text-body text-ink-muted">
            Remove seu nome e e-mail e encerra suas reivindicações. Não é possível desfazer.
          </p>
          <div>
            <Button variant="danger-quiet" size="lg" width="mobile-full" icon={Trash2} onClick={() => setDeleting(true)}>
              Excluir minha conta
            </Button>
          </div>
          <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
        </section>
      )}
    </Container>
  );
}
