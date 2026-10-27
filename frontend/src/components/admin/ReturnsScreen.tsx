"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { withOrigin } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminQueryError } from "./AdminQueryError";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useServiceQuery } from "@/hooks/use-service-query";
import { DATE_FILTER_DEBOUNCE_MS, periodError as getPeriodError } from "@/components/items/search-params";
import { formatCount, formatDateTime, formatInstantDate } from "@/lib/format";
import { services, type ReturnView } from "@/services";

const RETURNS_PATH = "/admin/devolucoes";
const NO_PERIOD = { from: "", to: "" };

/**
 * `/admin/devolucoes`: listagem simples de devoluções (RF05, AC05.3, P2/P9).
 * O período filtra pela data da devolução; não há exportação (decisão registrada na SPEC §1).
 */
export function ReturnsScreen() {
  // `draft` é o que está nos campos; `period` é o que filtra a lista. Digitar uma data gera valores
  // intermediários, então o período só é aplicado depois de uma pausa (mesmo tempo da busca de itens) e
  // nunca invertido (data final antes da inicial: mostra o erro e não busca).
  const [draft, setDraft] = useState(NO_PERIOD);
  const [period, setPeriod] = useState(NO_PERIOD);
  const periodError = getPeriodError(draft) ?? undefined;
  const filtered = Boolean(period.from || period.to);

  useEffect(() => {
    if (periodError) return;
    const timer = setTimeout(() => setPeriod(draft), DATE_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, periodError]);

  const query = useServiceQuery(
    () => services.returns.list({ from: period.from || undefined, to: period.to || undefined }),
    [period.from, period.to],
  );

  function clear() {
    setDraft(NO_PERIOD);
    setPeriod(NO_PERIOD);
  }

  return (
    <Container size="admin">
      <PageHeader title="Devoluções" description="Itens já entregues aos donos, da mais recente para a mais antiga." />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="grid grid-cols-2 gap-3 md:w-96">
          <Field label="Devolvido de">
            <Input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            />
          </Field>
          <Field label="até" error={periodError}>
            <Input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
          </Field>
        </div>
        {draft.from || draft.to ? (
          // `md:pb-1.5`: o `Field` deixa um vão (gap) antes da linha de erro, mesmo vazia; o botão alinha à base do campo.
          <div className="md:pb-1.5">
            <Button variant="ghost" size="lg" onClick={clear}>
              Limpar período
            </Button>
          </div>
        ) : null}
      </div>

      {query.status === "loading" ? <ReturnsSkeleton /> : null}
      {query.status === "error" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar as devoluções" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && query.data && !periodError ? (
        <ReturnsResults returns={query.data} filtered={filtered} onClear={clear} />
      ) : null}
    </Container>
  );
}

function ReturnsResults({
  returns,
  filtered,
  onClear,
}: {
  returns: ReturnView[];
  filtered: boolean;
  onClear: () => void;
}) {
  if (returns.length === 0) {
    return (
      <div className="rounded-lg bg-surface shadow-card">
        {filtered ? (
          <EmptyState
            variant="no-results"
            title="Nenhuma devolução nesse período"
            action={
              <Button variant="secondary" onClick={onClear}>
                Limpar período
              </Button>
            }
          >
            Tente outras datas ou limpe o período.
          </EmptyState>
        ) : (
          <EmptyState title="Nenhuma devolução registrada ainda">
            Quando você confirmar a entrega de um item, a devolução aparece aqui.
          </EmptyState>
        )}
      </div>
    );
  }

  return (
    <>
      <p role="status" className="mb-3 text-meta text-ink-muted tabular">
        {formatCount(returns.length, "devolução", "devoluções")}
      </p>

      {/* Celular: cartões com rótulos visíveis. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {returns.map((record) => (
          <li key={record.id} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
            <Link
              href={withOrigin(`/itens/${record.item.id}`, RETURNS_PATH)}
              className="link user-text touch-target inline-flex items-center self-start font-sans text-lead font-semibold tracking-normal"
            >
              <span className="line-clamp-2">{record.item.title}</span>
            </Link>
            <p className="user-text text-body">
              <span className="text-ink-subtle">Entregue a </span>
              {record.returnedTo.name}
            </p>
            <div>
              <ItemStatusBadge status="returned" />
            </div>
            <p className="user-text text-meta text-ink-subtle">
              <time dateTime={record.returnedAt} className="tabular">
                {formatInstantDate(record.returnedAt)}
              </time>{" "}
              · Registrada por {record.registeredBy.name}
            </p>
            {record.codeVerifiedAt ? (
              <p className="text-meta text-ink-subtle">
                Código validado em <time dateTime={record.codeVerifiedAt}>{formatDateTime(record.codeVerifiedAt)}</time>
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* A partir de 768 px: tabela. */}
      <div className="hidden overflow-hidden rounded-lg bg-surface shadow-card md:block">
        <table className="w-full text-left text-body">
          <caption className="sr-only">Devoluções registradas, da mais recente para a mais antiga</caption>
          <thead className="bg-sunken text-meta">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Item
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Entregue a
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Registrada por
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Data
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {returns.map((record) => (
              <tr key={record.id}>
                <td className="user-text px-4 py-1">
                  <Link
                    href={withOrigin(`/itens/${record.item.id}`, RETURNS_PATH)}
                    className="link touch-target inline-flex items-center font-semibold"
                  >
                    {record.item.title}
                  </Link>
                </td>
                <td className="user-text px-4 py-3">{record.returnedTo.name}</td>
                <td className="user-text px-4 py-3">{record.registeredBy.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={record.returnedAt} className="tabular">
                    {formatInstantDate(record.returnedAt)}
                  </time>
                  {record.codeVerifiedAt ? (
                    <span className="block text-meta text-ink-subtle">
                      Código validado em{" "}
                      <time dateTime={record.codeVerifiedAt}>{formatDateTime(record.codeVerifiedAt)}</time>
                    </span>
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

function ReturnsSkeleton() {
  return (
    <LoadingRegion label="Carregando devoluções…" className="flex flex-col gap-3">
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} className="h-28 w-full rounded-lg md:h-14" />
      ))}
    </LoadingRegion>
  );
}
