"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ACCOUNT_TWO_FACTOR_PATH } from "@/components/account/two-factor";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { DATE_FILTER_DEBOUNCE_MS } from "@/components/items/search-params";
import { useSession } from "@/hooks/use-session";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useToast } from "@/hooks/use-toast";
import { formatCount, formatInstantDate } from "@/lib/format";
import { canUpdateUser } from "@/lib/rules";
import { services } from "@/services";
import type { AdminUserRow } from "@/types/admin";
import { AFFILIATION_LABEL, AFFILIATION_NOTICE, ROLE_LABEL, USER_ROLES, type UserRole } from "@/types/domain";
import { classifyAdminFailure } from "./admin-errors";
import { AdminQueryError } from "./AdminQueryError";
import { AdminSectionNav } from "./AdminSectionNav";
import { AccountStatusBadge, TwoFactorBadge } from "./AdminBadges";
import { Pagination } from "./Pagination";
import {
  AFFILIATION_OPTIONS,
  NO_USER_FILTERS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  hasUserFilters,
  toListUsersFilters,
  type UserFilterState,
} from "./user-filters";

const PATH = "/admin/usuarios";

/** `/admin/usuarios`: busca, filtros, paginação, alterar papel e ativar/desativar contas. */
export function UsersScreen() {
  const { user: actor } = useSession();
  const router = useRouter();
  const toast = useToast();
  // `draft` é o que está nos campos; `applied` filtra a lista (a busca só vale depois de uma pausa na digitação).
  const [draft, setDraft] = useState<UserFilterState>(NO_USER_FILTERS);
  const [applied, setApplied] = useState<UserFilterState>(NO_USER_FILTERS);
  const [page, setPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState<AdminUserRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminUserRow | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setApplied(draft);
        setPage(1);
      },
      draft.q === applied.q ? 0 : DATE_FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, applied.q]);

  const filters = toListUsersFilters(applied, page);
  const query = useServiceQuery(() => services.admin.listUsers(filters), [applied.q, applied.role, applied.affiliation, applied.status, page]);

  function change(patch: Partial<UserFilterState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function clear() {
    setDraft(NO_USER_FILTERS);
    setApplied(NO_USER_FILTERS);
    setPage(1);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    const target = toggleTarget;
    setToggling(true);
    try {
      await services.admin.updateUser(target.id, { active: !target.active });
      toast.success(target.active ? `Conta de ${target.name} desativada.` : `Conta de ${target.name} reativada.`);
      setToggleTarget(null);
      query.refetch();
    } catch (error) {
      setToggleTarget(null);
      const failure = classifyAdminFailure(error, "Não foi possível alterar a conta. Tente de novo em instantes.");
      if (failure.kind === "two-factor") router.replace(ACCOUNT_TWO_FACTOR_PATH);
      else toast.error(failure.message);
    } finally {
      setToggling(false);
    }
  }

  const filtered = hasUserFilters(applied);

  return (
    <Container size="admin">
      <PageHeader title="Usuários" description="Veja as contas, mude o papel de cada pessoa e ative ou desative o acesso." />
      <AdminSectionNav current={PATH} />
      <p className="mb-4 text-meta text-ink-muted">{AFFILIATION_NOTICE}</p>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
        <Field label="Buscar por nome ou e-mail">
          <Input
            type="search"
            autoComplete="off"
            value={draft.q}
            onChange={(event) => change({ q: event.target.value })}
          />
        </Field>
        <Field label="Papel">
          <Select value={draft.role} onChange={(event) => change({ role: event.target.value })}>
            <option value="">Todos</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vínculo">
          <Select value={draft.affiliation} onChange={(event) => change({ affiliation: event.target.value })}>
            <option value="">Todos</option>
            {AFFILIATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Situação">
          <Select value={draft.status} onChange={(event) => change({ status: event.target.value })}>
            <option value="">Todas</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {hasUserFilters(draft) ? (
          <div className="md:pb-1.5">
            <Button variant="ghost" size="lg" onClick={clear}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </div>

      {query.status === "loading" ? <UsersSkeleton /> : null}
      {query.status === "error" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar os usuários" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && query.data ? (
        query.data.items.length === 0 && query.data.total === 0 ? (
          <div className="rounded-lg bg-surface shadow-card">
            {filtered ? (
              <EmptyState
                variant="no-results"
                title="Nenhum usuário encontrado"
                action={
                  <Button variant="secondary" onClick={clear}>
                    Limpar filtros
                  </Button>
                }
              >
                Tente outro nome, e-mail ou filtro.
              </EmptyState>
            ) : (
              <EmptyState title="Nenhum usuário ainda">Quando alguém criar uma conta, ela aparece aqui.</EmptyState>
            )}
          </div>
        ) : (
          <>
            <p role="status" className="mb-3 text-meta text-ink-muted tabular">
              {formatCount(query.data.total, "usuário", "usuários")}
            </p>
            <UsersList
              rows={query.data.items}
              actorId={actor?.id}
              actorRole={actor?.role}
              onChangeRole={setRoleTarget}
              onToggle={setToggleTarget}
            />
            {query.data.items.length === 0 ? (
              <EmptyState variant="no-results" title="Esta página está vazia">
                Volte para a primeira página.
              </EmptyState>
            ) : null}
            <Pagination page={query.data} onChange={setPage} />
          </>
        )
      ) : null}

      <RoleDialog
        target={roleTarget}
        onClose={() => setRoleTarget(null)}
        onSaved={(row, role) => {
          setRoleTarget(null);
          toast.success(`Papel de ${row.name} alterado para ${ROLE_LABEL[role]}.`);
          query.refetch();
        }}
      />
      <ConfirmDialog
        open={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        destructive={toggleTarget?.active === true}
        busy={toggling}
        title={toggleTarget?.active ? `Desativar a conta de ${toggleTarget.name}?` : `Reativar a conta de ${toggleTarget?.name ?? ""}?`}
        description={
          toggleTarget?.active
            ? "A pessoa sai de todos os aparelhos agora e não consegue entrar até a conta ser reativada."
            : "A pessoa volta a poder entrar."
        }
        confirmLabel={toggleTarget?.active ? "Desativar" : "Reativar"}
        confirmingLabel={toggleTarget?.active ? "Desativando…" : "Reativando…"}
        onConfirm={() => void confirmToggle()}
      />
    </Container>
  );
}

function UserActions({
  row,
  locked,
  onChangeRole,
  onToggle,
}: {
  row: AdminUserRow;
  locked: string | null;
  onChangeRole(row: AdminUserRow): void;
  onToggle(row: AdminUserRow): void;
}) {
  if (locked) return <p className="max-w-64 text-meta text-ink-muted">{locked}</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="secondary" aria-label={`Alterar o papel de ${row.name}`} onClick={() => onChangeRole(row)}>
        Alterar papel
      </Button>
      <Button
        variant={row.active ? "danger-quiet" : "secondary"}
        aria-label={`${row.active ? "Desativar" : "Reativar"} a conta de ${row.name}`}
        onClick={() => onToggle(row)}
      >
        {row.active ? "Desativar" : "Reativar"}
      </Button>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <LoadingRegion label="Carregando usuários…" className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-lg md:h-14" />
      ))}
    </LoadingRegion>
  );
}

function UsersList({
  rows,
  actorId,
  actorRole,
  onChangeRole,
  onToggle,
}: {
  rows: AdminUserRow[];
  actorId: string | undefined;
  actorRole: UserRole | undefined;
  onChangeRole(row: AdminUserRow): void;
  onToggle(row: AdminUserRow): void;
}) {
  // A regra de "não mexer na própria conta" vem de `canUpdateUser`; o "último admin" o serviço confere ao salvar.
  function lockReason(row: AdminUserRow): string | null {
    if (!actorId || !actorRole) return null;
    const decision = canUpdateUser({ id: actorId, role: actorRole }, row, {}, 1);
    return decision.allowed ? null : decision.message;
  }

  return (
    <>
      {/* Celular: cartões com rótulos visíveis. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
            <div className="min-w-0">
              <p className="user-text text-lead font-semibold">{row.name}</p>
              <p className="user-text text-meta break-all text-ink-muted">{row.email}</p>
            </div>
            <p className="text-body">
              <span className="text-ink-subtle">Papel: </span>
              {ROLE_LABEL[row.role]}
            </p>
            <p className="text-body">
              <span className="text-ink-subtle">Vínculo: </span>
              {AFFILIATION_LABEL[row.affiliation]}
            </p>
            <div className="flex flex-wrap gap-2">
              <AccountStatusBadge active={row.active} />
              <TwoFactorBadge enabled={row.twoFactorEnabled} />
            </div>
            <p className="text-meta text-ink-subtle">
              Criada em <time dateTime={row.createdAt}>{formatInstantDate(row.createdAt)}</time>
            </p>
            <UserActions row={row} locked={lockReason(row)} onChangeRole={onChangeRole} onToggle={onToggle} />
          </li>
        ))}
      </ul>

      {/* A partir de 768 px: tabela. */}
      <div className="hidden overflow-hidden rounded-lg bg-surface shadow-card md:block">
        <table className="w-full text-left text-body">
          <caption className="sr-only">Usuários, dos mais recentes para os mais antigos</caption>
          <thead className="bg-sunken text-meta">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Pessoa</th>
              <th scope="col" className="px-4 py-3 font-semibold">Papel</th>
              <th scope="col" className="px-4 py-3 font-semibold">Vínculo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-4 py-3 font-semibold">Criada em</th>
              <th scope="col" className="px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="user-text max-w-64 px-4 py-3">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="truncate text-meta text-ink-muted">{row.email}</p>
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[row.role]}</td>
                <td className="px-4 py-3">{AFFILIATION_LABEL[row.affiliation]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <AccountStatusBadge active={row.active} />
                    <TwoFactorBadge enabled={row.twoFactorEnabled} />
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={row.createdAt} className="tabular">
                    {formatInstantDate(row.createdAt)}
                  </time>
                </td>
                <td className="px-4 py-3">
                  <UserActions row={row} locked={lockReason(row)} onChangeRole={onChangeRole} onToggle={onToggle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const ROLE_FORM_ID = "change-role-form";

function RoleForm({
  target,
  onBusyChange,
  onSaved,
}: {
  target: AdminUserRow;
  onBusyChange(busy: boolean): void;
  onSaved(row: AdminUserRow, role: UserRole): void;
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(target.role);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (role === target.role) {
      setError("Escolha um papel diferente do atual.");
      return;
    }
    onBusyChange(true);
    setError(null);
    try {
      await services.admin.updateUser(target.id, { role });
      onSaved(target, role);
    } catch (cause) {
      const failure = classifyAdminFailure(cause, "Não foi possível alterar o papel. Tente de novo em instantes.");
      if (failure.kind === "two-factor") router.replace(ACCOUNT_TWO_FACTOR_PATH);
      else setError(failure.message);
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <form id={ROLE_FORM_ID} noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Field label="Papel">
        <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)} data-autofocus>
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>
      {role === "admin" && target.role !== "admin" ? (
        <Notice tone="warning">
          A administração gerencia usuários, convites e reivindicações. Ela só abre usuários, convites e auditoria depois de ativar a verificação em duas etapas.
        </Notice>
      ) : null}
    </form>
  );
}

function RoleDialog({
  target,
  onClose,
  onSaved,
}: {
  target: AdminUserRow | null;
  onClose(): void;
  onSaved(row: AdminUserRow, role: UserRole): void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      busy={busy}
      title={`Alterar o papel de ${target?.name ?? ""}`}
      description="Escolha o novo papel. A mudança fica registrada na auditoria."
      actions={
        <>
          <Button variant="secondary" size="lg" width="mobile-full" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={ROLE_FORM_ID} size="lg" width="mobile-full" loading={busy} loadingText="Salvando…">
            Salvar papel
          </Button>
        </>
      }
    >
      {target ? <RoleForm key={target.id} target={target} onBusyChange={setBusy} onSaved={onSaved} /> : null}
    </Dialog>
  );
}
