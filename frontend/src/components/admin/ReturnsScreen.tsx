"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useServiceQuery } from "@/hooks/use-service-query";
import { formatCount, formatInstantDate } from "@/lib/format";
import { periodSchema } from "@/lib/validation";
import { services, type ReturnView } from "@/services";

/**
 * `/admin/devolucoes`: listagem simples de devoluções (RF05, AC05.3, P2/P9).
 * O período filtra pela data da devolução; não há exportação (decisão registrada na SPEC §1).
 */
export function ReturnsScreen() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const period = periodSchema.safeParse({ from, to });
  const periodError = period.success ? undefined : period.error.issues[0]?.message;
  const filtered = Boolean(from || to);

  const query = useServiceQuery(
    () => services.returns.list(period.success ? { from: from || undefined, to: to || undefined } : {}),
    [from, to],
  );

  function clear() {
    setFrom("");
    setTo("");
  }

  return (
    <Container size="admin">
      <PageHeader title="Devoluções" description="Itens já entregues aos donos, da mais recente para a mais antiga." />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start">
        <div className="grid grid-cols-2 gap-3 md:w-96">
          <Field label="Devolvido de">
            <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="até" error={periodError}>
            <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
        {filtered ? (
          <Button variant="ghost" onClick={clear} className="md:mt-[1.625rem] self-start">
            Limpar período
          </Button>
        ) : null}
      </div>

      {query.status === "loading" ? <ReturnsSkeleton /> : null}
      {query.status === "error" ? (
        <ErrorState title="Não conseguimos carregar as devoluções" onRetry={query.refetch}>
          {query.error?.message}
        </ErrorState>
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
            Quando você registrar a devolução de um item, ela aparece aqui.
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
              href={`/itens/${record.item.id}`}
              className="link line-clamp-2 font-sans text-lead font-semibold tracking-normal"
            >
              {record.item.title}
            </Link>
            <p className="text-body">
              <span className="text-ink-subtle">Entregue a </span>
              {record.returnedTo.name}
            </p>
            <div>
              <ItemStatusBadge status="returned" />
            </div>
            <p className="text-meta text-ink-subtle">
              <time dateTime={record.returnedAt} className="tabular">
                {formatInstantDate(record.returnedAt)}
              </time>{" "}
              · Registrada por {record.registeredBy.name}
            </p>
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
                <td className="px-4 py-3 break-words">
                  <Link href={`/itens/${record.item.id}`} className="link font-semibold">
                    {record.item.title}
                  </Link>
                </td>
                <td className="px-4 py-3 break-words">{record.returnedTo.name}</td>
                <td className="px-4 py-3 break-words">{record.registeredBy.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={record.returnedAt} className="tabular">
                    {formatInstantDate(record.returnedAt)}
                  </time>
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
