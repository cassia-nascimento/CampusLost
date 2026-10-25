"use client";

import { useEffect, useState } from "react";
import { DATE_FILTER_DEBOUNCE_MS } from "@/components/items/search-params";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/use-service-query";
import { formatCount, formatDateTime } from "@/lib/format";
import { services } from "@/services";
import { AUDIT_ACTIONS, AUDIT_ACTION_LABEL, type AuditEntry } from "@/types/admin";
import { AdminQueryError } from "./AdminQueryError";
import { AdminSectionNav } from "./AdminSectionNav";
import { auditActionLabel, auditActorName, auditMetadataPairs, describeAuditTarget } from "./list-view";
import { Pagination } from "./Pagination";

const PATH = "/admin/auditoria";

/** `/admin/auditoria`: trilha de eventos, mais recentes primeiro, filtrável por ação e por quem fez (id do usuário). */
export function AuditScreen() {
  const [action, setAction] = useState("");
  const [actorDraft, setActorDraft] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);

  // O id do ator só filtra depois de uma pausa na digitação; a página volta à primeira junto com o filtro.
  useEffect(() => {
    if (actorDraft.trim() === actor) return;
    const timer = setTimeout(() => {
      setActor(actorDraft.trim());
      setPage(1);
    }, DATE_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [actorDraft, actor]);

  const query = useServiceQuery(
    () => services.admin.listAuditLog({ action: action || undefined, actor: actor || undefined, page }),
    [action, actor, page],
  );
  const filtered = Boolean(action || actor);

  function clear() {
    setAction("");
    setActorDraft("");
    setActor("");
    setPage(1);
  }

  function filterByActor(id: string) {
    setActorDraft(id);
    setActor(id);
    setPage(1);
  }

  return (
    <Container size="admin">
      <PageHeader title="Auditoria" description="Registro dos eventos de segurança e de administração, do mais recente para o mais antigo." />
      <AdminSectionNav current={PATH} />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Ação">
          <Select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as ações</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {AUDIT_ACTION_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quem fez (ID do usuário)" hint="Use o botão “Só deste usuário” em um evento para preencher.">
          <Input autoComplete="off" autoCapitalize="none" spellCheck={false} value={actorDraft} onChange={(event) => setActorDraft(event.target.value)} />
        </Field>
        {filtered || actorDraft ? (
          <div className="md:pb-1.5">
            <Button variant="ghost" size="lg" onClick={clear}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </div>

      {query.status === "loading" ? (
        <LoadingRegion label="Carregando eventos…" className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg md:h-12" />
          ))}
        </LoadingRegion>
      ) : null}
      {query.status === "error" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar a auditoria" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && query.data ? (
        query.data.total === 0 ? (
          <div className="rounded-lg bg-surface shadow-card">
            {filtered ? (
              <EmptyState
                variant="no-results"
                title="Nenhum evento encontrado"
                action={
                  <Button variant="secondary" onClick={clear}>
                    Limpar filtros
                  </Button>
                }
              >
                Tente outra ação ou outro usuário.
              </EmptyState>
            ) : (
              <EmptyState title="Nenhum evento registrado ainda">Entradas, mudanças de papel e convites aparecem aqui.</EmptyState>
            )}
          </div>
        ) : (
          <>
            <p role="status" className="mb-3 text-meta text-ink-muted tabular">
              {formatCount(query.data.total, "evento", "eventos")}
            </p>
            <AuditList entries={query.data.items} onFilterActor={filterByActor} />
            {query.data.items.length === 0 ? (
              <EmptyState variant="no-results" title="Esta página está vazia">
                Volte para a primeira página.
              </EmptyState>
            ) : null}
            <Pagination page={query.data} onChange={setPage} />
          </>
        )
      ) : null}
    </Container>
  );
}

function Details({ entry }: { entry: AuditEntry }) {
  const pairs = auditMetadataPairs(entry.metadata);
  if (pairs.length === 0) return <span className="text-ink-subtle">—</span>;
  return (
    <dl className="user-text flex flex-col gap-0.5 text-meta">
      {pairs.map(({ key, value }) => (
        <div key={key} className="flex gap-1.5">
          <dt className="text-ink-subtle">{key}:</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActorFilterButton({ entry, onFilterActor }: { entry: AuditEntry; onFilterActor(id: string): void }) {
  if (!entry.actorId) return null;
  const id = entry.actorId;
  return (
    <Button variant="ghost" aria-label={`Só eventos de ${auditActorName(entry)}`} onClick={() => onFilterActor(id)} className="-ml-4 self-start">
      Só deste usuário
    </Button>
  );
}

function AuditList({ entries, onFilterActor }: { entries: AuditEntry[]; onFilterActor(id: string): void }) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
            <p className="text-lead font-semibold">{auditActionLabel(entry.action)}</p>
            <p className="text-meta text-ink-subtle">
              <time dateTime={entry.at} className="tabular">
                {formatDateTime(entry.at)}
              </time>
            </p>
            <p className="user-text text-body">
              <span className="text-ink-subtle">Quem: </span>
              {auditActorName(entry)}
            </p>
            {describeAuditTarget(entry) ? (
              <p className="user-text text-body break-all">
                <span className="text-ink-subtle">Alvo: </span>
                {describeAuditTarget(entry)}
              </p>
            ) : null}
            {entry.ip ? (
              <p className="text-meta text-ink-subtle">
                IP: <span className="tabular">{entry.ip}</span>
              </p>
            ) : null}
            <Details entry={entry} />
            <ActorFilterButton entry={entry} onFilterActor={onFilterActor} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-lg bg-surface shadow-card md:block">
        <table className="w-full text-left text-body">
          <caption className="sr-only">Eventos de auditoria, do mais recente para o mais antigo</caption>
          <thead className="bg-sunken text-meta">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Quando</th>
              <th scope="col" className="px-4 py-3 font-semibold">Ação</th>
              <th scope="col" className="px-4 py-3 font-semibold">Quem</th>
              <th scope="col" className="px-4 py-3 font-semibold">Alvo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={entry.at} className="tabular">
                    {formatDateTime(entry.at)}
                  </time>
                </td>
                <td className="px-4 py-3 font-semibold">{auditActionLabel(entry.action)}</td>
                <td className="user-text px-4 py-3">
                  <p>{auditActorName(entry)}</p>
                  <ActorFilterButton entry={entry} onFilterActor={onFilterActor} />
                </td>
                <td className="user-text max-w-48 px-4 py-3 break-all">{describeAuditTarget(entry) ?? <span className="text-ink-subtle">—</span>}</td>
                <td className="px-4 py-3">
                  <Details entry={entry} />
                  {entry.ip ? <p className="mt-1 text-meta text-ink-subtle">IP: {entry.ip}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
