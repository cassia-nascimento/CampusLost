"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AdminTwoFactorNotice } from "@/components/account/TwoFactorNotice";
import { adminNeedsTwoFactor } from "@/components/account/two-factor";
import { Container } from "@/components/layout/Container";
import { ADMIN_SECTIONS } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminQueryError } from "./AdminQueryError";
import { Photo } from "@/components/ui/Photo";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ClaimStatusBadge } from "@/components/ui/StatusBadge";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useMinWidth } from "@/hooks/use-min-width";
import { useSession } from "@/hooks/use-session";
import { useServiceQuery } from "@/hooks/use-service-query";
import { formatRelativeInstant } from "@/lib/format";
import { cn } from "@/lib/utils";
import { services, type ClaimView } from "@/services";
import { AFFILIATION_LABEL } from "@/types/domain";
import { summarizeAwaitingReturn, type AwaitingReturnRow } from "./awaiting-return";
import { toStoredItem } from "./stored-item";

interface DashboardData {
  pending: ClaimView[];
  awaiting: AwaitingReturnRow[];
  returnsCount: number;
}

/** Fila de pendentes (mais antigas primeiro, P17), itens aguardando devolução (P45) e total de devoluções. */
async function loadDashboard(): Promise<DashboardData> {
  const [pending, underClaim, returns] = await Promise.all([
    services.claims.listPending(),
    services.items.list({ status: "under_claim" }),
    services.returns.list(),
  ]);
  const claimsByItem = await Promise.all(underClaim.map((item) => services.claims.listByItem(item.id)));
  return {
    pending,
    awaiting: summarizeAwaitingReturn(underClaim.map(toStoredItem), claimsByItem),
    returnsCount: returns.length,
  };
}

/** `/admin`: ponto de partida da administração (RF04/RF05, AC04.4). */
export function AdminDashboard() {
  const query = useServiceQuery(loadDashboard);
  const { user } = useSession();

  return (
    <Container size="admin">
      <PageHeader title="Painel" description="Analise as reivindicações e registre as devoluções." />
      {user && adminNeedsTwoFactor(user) ? <AdminTwoFactorNotice withLink className="mb-6" /> : null}
      {query.status === "loading" ? <DashboardSkeleton /> : null}
      {query.status === "error" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar o painel" onRetry={query.refetch} />
      ) : null}
      {query.status === "success" && query.data ? <DashboardContent data={query.data} /> : null}
      <ManagementLinks />
    </Container>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const wide = useMinWidth("64rem");
  const [tab, setTab] = useState("pending");

  // Ordem dos títulos: h1 > h2 > h3. Na grade (desktop) as seções têm h2 e os cartões h3; nas abas (celular)
  // não há h2 de seção, então os títulos dos cartões sobem para h2 (como em `/itens` e "Minhas reivindicações").
  const cardHeading = wide ? "h3" : "h2";
  const pendingList = <PendingList claims={data.pending} heading={cardHeading} />;
  const awaitingList = <AwaitingReturnList rows={data.awaiting} heading={cardHeading} />;

  return (
    <>
      {/* Abaixo de 360 px (ex.: 320) o espaçamento encolhe: a soma das larguras mínimas dos rótulos não cabe com 12 px de vão. */}
      <ul className="grid grid-cols-[auto_1fr_auto] gap-2 min-[360px]:gap-3 sm:grid-cols-3">
        <Stat label="Pendentes" value={data.pending.length} />
        <Stat label="Para devolver" fullLabel="Aguardando devolução" value={data.awaiting.length} />
        <Stat label="Devoluções" value={data.returnsCount} href="/admin/devolucoes" />
      </ul>

      {wide ? (
        <div className="mt-8 grid grid-cols-2 items-start gap-6">
          <section aria-labelledby="painel-pendentes">
            <SectionHeading id="painel-pendentes" hint="Da mais antiga para a mais nova.">
              Reivindicações pendentes
            </SectionHeading>
            {pendingList}
          </section>
          <section aria-labelledby="painel-devolucao">
            <SectionHeading id="painel-devolucao" hint="Da aceitação mais antiga para a mais nova.">
              Aguardando devolução
            </SectionHeading>
            {awaitingList}
          </section>
        </div>
      ) : (
        <div className="mt-6">
          <Tabs
            group="painel"
            label="Painel da administração"
            value={tab}
            onChange={setTab}
            items={[
              { id: "pending", label: "Pendentes", count: data.pending.length },
              { id: "awaiting", label: "Para devolver", count: data.awaiting.length },
            ]}
          />
          <TabPanel group="painel" id="pending" active={tab === "pending"} className="pt-5">
            {pendingList}
          </TabPanel>
          <TabPanel group="painel" id="awaiting" active={tab === "awaiting"} className="pt-5">
            {awaitingList}
          </TabPanel>
        </div>
      )}
    </>
  );
}

/** Atalhos para usuários, convites e auditoria (fora do BottomNav). */
function ManagementLinks() {
  return (
    <section aria-labelledby="painel-gestao" className="mt-8">
      <h2 id="painel-gestao" className="mb-3 text-h3">
        Gestão
      </h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ADMIN_SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full touch-target items-center gap-3 rounded-lg bg-surface p-4 shadow-card transition-shadow hover:shadow-raised active:bg-paper"
            >
              <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-meta text-ink-muted">{description}</span>
              </span>
              <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, fullLabel, value, href }: { label: string; fullLabel?: string; value: number; href?: string }) {
  const body = (
    <>
      <span className="flex items-start justify-between">
        <span className="font-display text-h2 font-bold tabular">{value}</span>
        {href ? <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}
      </span>
      {fullLabel ? (
        <span className="text-meta text-ink-muted">
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{fullLabel}</span>
        </span>
      ) : (
        <span className="text-meta text-ink-muted">{label}</span>
      )}
    </>
  );
  const classes = "flex h-full flex-col gap-1 rounded-lg bg-surface p-2 shadow-card min-[360px]:p-2.5 sm:p-4";
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(classes, "transition-shadow hover:shadow-raised active:bg-paper")}>
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </li>
  );
}

function SectionHeading({ id, hint, children }: { id: string; hint: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-h3">
        {children}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{hint}</p>
    </div>
  );
}

const CARD = "flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card";

type CardHeading = "h2" | "h3";

function PendingList({ claims, heading: Heading }: { claims: ClaimView[]; heading: CardHeading }) {
  if (claims.length === 0) {
    return (
      <div className="rounded-lg bg-surface shadow-card">
        <EmptyState title="Nenhuma reivindicação pendente">
          Quando chegar uma, ela aparece aqui.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {claims.map((claim) => (
        <li key={claim.id} className={CARD}>
          <div className="flex gap-3">
            <Photo
              src={claim.item.photoDataUrl}
              alt=""
              aspect="square"
              className="size-16 shrink-0 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <Heading className="user-text line-clamp-2 font-sans text-lead font-semibold tracking-normal">{claim.item.title}</Heading>
              <p className="user-text mt-0.5 text-meta text-ink-muted">
                {claim.claimant.name} · {AFFILIATION_LABEL[claim.claimant.affiliation]}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-subtle">
                <ClaimStatusBadge status={claim.status} />
                <span>
                  Enviada <time dateTime={claim.createdAt}>{formatRelativeInstant(claim.createdAt)}</time>
                </span>
              </p>
            </div>
          </div>
          <LinkButton
            href={`/admin/reivindicacoes/${claim.id}`}
            variant="secondary"
            width="mobile-full"
            aria-label={`Analisar reivindicação de ${claim.claimant.name} para ${claim.item.title}`}
            className="self-start max-sm:self-stretch"
          >
            Analisar
          </LinkButton>
        </li>
      ))}
    </ul>
  );
}

function AwaitingReturnList({ rows, heading: Heading }: { rows: AwaitingReturnRow[]; heading: CardHeading }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-surface shadow-card">
        <EmptyState title="Nenhum item aguardando devolução">
          Quando você aceitar uma reivindicação, o item aparece aqui.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ item, accepted }) => (
        <li key={item.id} className={CARD}>
          <div className="flex gap-3">
            <Photo
              src={item.photoDataUrl}
              alt=""
              aspect="square"
              className="size-16 shrink-0 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <Heading className="user-text line-clamp-2 font-sans text-lead font-semibold tracking-normal">{item.title}</Heading>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
                <ClaimStatusBadge status="accepted" />
                <span className="user-text">Para {accepted.claimant.name} · aguardando devolução</span>
              </p>
            </div>
          </div>
          <LinkButton
            href={`/admin/reivindicacoes/${accepted.id}`}
            variant="secondary"
            width="mobile-full"
            aria-label={`Confirmar entrega de ${item.title}`}
            className="self-start max-sm:self-stretch"
          >
            Confirmar entrega
          </LinkButton>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <LoadingRegion label="Carregando o painel…">
      <ul className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <Skeleton className="h-20 w-full rounded-lg" />
          </li>
        ))}
      </ul>
      <Skeleton className="mt-6 h-11 w-full max-w-md" />
      <div className="mt-5 flex flex-col gap-3">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}
