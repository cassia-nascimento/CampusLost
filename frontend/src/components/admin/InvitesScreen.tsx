"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ACCOUNT_TWO_FACTOR_PATH } from "@/components/account/two-factor";
import { SimulatedEmailBox } from "@/components/auth/SimulatedEmailBox";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useToast } from "@/hooks/use-toast";
import { formatCount, formatDateTime } from "@/lib/format";
import { isInviteUsable, INVITE_TTL_HOURS } from "@/lib/rules";
import { inviteSchema, type InviteValues } from "@/lib/validation";
import { services } from "@/services";
import type { AdminInvite, CreatedInvite } from "@/types/admin";
import { isServiceError } from "@/types/domain";
import { classifyAdminFailure } from "./admin-errors";
import { AdminQueryError } from "./AdminQueryError";
import { AdminSectionNav } from "./AdminSectionNav";
import { InviteStatusBadge } from "./AdminBadges";
import { Pagination } from "./Pagination";

const PATH = "/admin/convites";

/** `/admin/convites`: convida novas contas de administração (uso único, 48 h) e acompanha o estado de cada convite. */
export function InvitesScreen() {
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  // Último convite criado: no mock traz o link simulado (nenhum e-mail sai de verdade).
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const router = useRouter();
  const toast = useToast();
  const query = useServiceQuery(() => services.admin.listInvites({ page }), [page]);

  async function confirmRevoke() {
    if (!revoking) return;
    const target = revoking;
    setRevokeBusy(true);
    try {
      await services.admin.revokeInvite(target.id);
      toast.success(`Convite para ${target.email} revogado.`);
      if (created?.id === target.id) setCreated(null);
      setRevoking(null);
      query.refetch();
    } catch (error) {
      setRevoking(null);
      const failure = classifyAdminFailure(error, "Não foi possível revogar o convite. Tente de novo em instantes.");
      if (failure.kind === "two-factor") router.replace(ACCOUNT_TWO_FACTOR_PATH);
      else {
        toast.error(failure.message);
        query.refetch(); // o convite pode ter sido aceito enquanto a lista estava aberta
      }
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <Container size="admin">
      <PageHeader
        title="Convites"
        description={`Convide alguém para a administração. O convite vale ${INVITE_TTL_HOURS} horas e só pode ser usado uma vez.`}
      />
      <AdminSectionNav current={PATH} />

      <InviteForm
        onCreated={(invite) => {
          setCreated(invite);
          setPage(1);
          query.refetch();
        }}
      />
      {created ? (
        <div className="mt-4">
          <Notice tone="success" role="status">
            Convite criado para <strong className="user-text font-semibold">{created.email}</strong>. Um novo convite para o mesmo e-mail revoga o anterior.
          </Notice>
          <SimulatedEmailBox devLink={created.devLink} action="Abrir link do convite" className="mt-3" />
        </div>
      ) : null}

      <h2 className="mt-8 mb-3 text-h3">Convites enviados</h2>
      {query.status === "loading" ? (
        <LoadingRegion label="Carregando convites…" className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg md:h-14" />
          ))}
        </LoadingRegion>
      ) : null}
      {query.status === "error" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar os convites" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && query.data ? (
        query.data.total === 0 ? (
          <div className="rounded-lg bg-surface shadow-card">
            <EmptyState title="Nenhum convite enviado">Use o formulário acima para convidar a primeira pessoa.</EmptyState>
          </div>
        ) : (
          <>
            <p role="status" className="mb-3 text-meta text-ink-muted tabular">
              {formatCount(query.data.total, "convite", "convites")}
            </p>
            <InvitesList invites={query.data.items} onRevoke={setRevoking} />
            {query.data.items.length === 0 ? (
              <EmptyState variant="no-results" title="Esta página está vazia">
                Volte para a primeira página.
              </EmptyState>
            ) : null}
            <Pagination page={query.data} onChange={setPage} />
          </>
        )
      ) : null}

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        destructive
        busy={revokeBusy}
        title="Revogar este convite?"
        description={`O link enviado para ${revoking?.email ?? ""} para de funcionar. Você pode criar outro convite depois.`}
        confirmLabel="Revogar convite"
        confirmingLabel="Revogando…"
        onConfirm={() => void confirmRevoke()}
      />
    </Container>
  );
}

function InviteForm({ onCreated }: { onCreated(invite: CreatedInvite): void }) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: InviteValues) {
    setFormError(null);
    try {
      const invite = await services.admin.createInvite(email);
      toast.success("Convite criado.");
      reset();
      onCreated(invite);
    } catch (error) {
      if (isServiceError(error) && (error.code === "EMAIL_TAKEN" || error.code === "VALIDATION")) {
        const message = error.fieldErrors?.email ?? (error.code === "EMAIL_TAKEN" ? "Este e-mail já tem uma conta no CampusLost." : undefined);
        if (message) {
          setError("email", { type: "server", message });
          setFocus("email");
          return;
        }
      }
      const failure = classifyAdminFailure(error, "Não foi possível criar o convite. Tente de novo em instantes.");
      if (failure.kind === "two-factor") router.replace(ACCOUNT_TWO_FACTOR_PATH);
      else setFormError(failure.message);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} aria-label="Novo convite" className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-h3">Novo convite</h2>
      {formError ? (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      ) : null}
      <Field label="E-mail da pessoa" hint="A pessoa recebe um link para criar o próprio nome e senha." error={errors.email?.message}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nome@exemplo.com"
          {...register("email")}
        />
      </Field>
      <div>
        <Button type="submit" size="lg" width="mobile-full" loading={isSubmitting} loadingText="Criando…">
          Criar convite
        </Button>
      </div>
    </form>
  );
}

function InvitesList({ invites, onRevoke }: { invites: AdminInvite[]; onRevoke(invite: AdminInvite): void }) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
            <p className="user-text text-lead font-semibold break-all">{invite.email}</p>
            <div>
              <InviteStatusBadge status={invite.status} />
            </div>
            <p className="text-meta text-ink-subtle">
              Criado em {formatDateTime(invite.createdAt)}
              <br />
              Expira em {formatDateTime(invite.expiresAt)}
            </p>
            {isInviteUsable(invite) ? (
              <Button variant="danger-quiet" aria-label={`Revogar convite para ${invite.email}`} onClick={() => onRevoke(invite)} className="self-start max-sm:self-stretch">
                Revogar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-lg bg-surface shadow-card md:block">
        <table className="w-full text-left text-body">
          <caption className="sr-only">Convites, dos mais recentes para os mais antigos</caption>
          <thead className="bg-sunken text-meta">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">E-mail</th>
              <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-4 py-3 font-semibold">Criado em</th>
              <th scope="col" className="px-4 py-3 font-semibold">Expira em</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invites.map((invite) => (
              <tr key={invite.id}>
                <td className="user-text max-w-64 px-4 py-3 break-all">{invite.email}</td>
                <td className="px-4 py-3">
                  <InviteStatusBadge status={invite.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular">{formatDateTime(invite.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular">{formatDateTime(invite.expiresAt)}</td>
                <td className="px-4 py-3 text-right">
                  {isInviteUsable(invite) ? (
                    <Button variant="danger-quiet" aria-label={`Revogar convite para ${invite.email}`} onClick={() => onRevoke(invite)}>
                      Revogar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
