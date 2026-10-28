import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ACCOUNT_TWO_FACTOR_PATH } from "./two-factor";

/** Aviso para a administração sem verificação em duas etapas (usuários, convites e auditoria dependem dela). */
export function AdminTwoFactorNotice({ withLink = false, className }: { withLink?: boolean; className?: string }) {
  return (
    <Notice
      tone="warning"
      title="Ative a verificação em duas etapas"
      className={className}
      action={
        withLink ? (
          <LinkButton href={ACCOUNT_TWO_FACTOR_PATH} variant="secondary">
            Ativar em Minha conta
          </LinkButton>
        ) : undefined
      }
    >
      A administração precisa dela para gerenciar usuários, convites e a auditoria. Sem ela, essas telas ficam bloqueadas.
    </Notice>
  );
}
