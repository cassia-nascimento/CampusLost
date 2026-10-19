"use client";

/*
 * TEMP T04 — substituída na T05.
 * Página de verificação visual dos primitivos de UI, do shell e dos providers. Não faz parte do produto:
 * a T05 troca esta rota por um redirecionamento (`/itens` ou `/entrar`) e remove "/" de navigation.ts.
 * Os itens abaixo são EXEMPLOS (não vêm dos mocks).
 */

import { useState, type ReactNode } from "react";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { ActionBar } from "@/components/layout/ActionBar";
import { AppShell } from "@/components/layout/AppShell";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { DefinitionList } from "@/components/layout/DefinitionList";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FileInput } from "@/components/ui/FileInput";
import { Input } from "@/components/ui/Input";
import { ItemCard, ItemCardSkeleton } from "@/components/ui/ItemCard";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { ClaimStatusBadge, ItemStatusBadge } from "@/components/ui/StatusBadge";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { useIsClient } from "@/hooks/use-is-client";
import { useServiceQuery } from "@/hooks/use-service-query";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCount, formatDate, formatRelativeDate } from "@/lib/format";
import { toLocalDateString, addDays } from "@/lib/rules";
import { services } from "@/services";
import { DEMO_CATEGORIES } from "@/types/catalog";
import { CLAIM_STATUSES, ITEM_STATUSES, ROLE_LABEL } from "@/types/domain";
import { Calendar, MapPin, Plus, Tag, Trash2, Search } from "lucide-react";

const SAMPLE_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#cbe4e7"/><circle cx="200" cy="150" r="70" fill="#0b5563"/></svg>',
  );

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-line pb-2">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function daysAgo(days: number): string {
  return toLocalDateString(addDays(new Date(), -days));
}

export default function VerificationPage() {
  return (
    <AppShell>
      <Verification />
    </AppShell>
  );
}

function Verification() {
  const isClient = useIsClient();
  const { user, status, signInAsDemo, signOut } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState("pending");
  const [text, setText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [photoName, setPhotoName] = useState("nenhuma");
  const items = useServiceQuery(() => services.items.list(), [user?.id ?? null]);

  function simulate(then: () => void) {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      then();
    }, 1200);
  }

  return (
    <Container size="page">
      <PageHeader
        title="Verificação da base de UI"
        description="Página temporária da T04: primitivos, layout e providers. Itens de exemplo, não vêm dos mocks."
        actions={<LinkButton href="/itens/novo" icon={Plus}>Registrar item</LinkButton>}
      />

      <Section title="Sessão (SessionProvider) e useServiceQuery">
        <p>
          Status: <strong>{status}</strong> · Usuário:{" "}
          <strong>{user ? `${user.name} (${ROLE_LABEL[user.role]})` : "visitante"}</strong>
        </p>
        <Row>
          <Button variant="secondary" onClick={() => void signInAsDemo("student")}>Entrar: aluno demo</Button>
          <Button variant="secondary" onClick={() => void signInAsDemo("teacher")}>Entrar: professor demo</Button>
          <Button variant="secondary" onClick={() => void signInAsDemo("admin")}>Entrar: administração demo</Button>
          <Button variant="ghost" onClick={() => void signOut()}>Sair</Button>
        </Row>
        <p>
          useServiceQuery(items.list): <strong>{items.status}</strong>
          {items.status === "success" ? ` — ${formatCount(items.data?.length ?? 0, "item", "itens")}` : null}
          {items.status === "error" ? ` — ${items.error?.code}` : null}. Reexecuta sozinho ao entrar/sair.
        </p>
        {items.status === "error" ? (
          <ErrorState title="Não conseguimos carregar os itens" onRetry={items.refetch}>
            {items.error?.message}
          </ErrorState>
        ) : null}
      </Section>

      <Section title="Botões">
        <Row>
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <Button variant="danger-quiet" icon={Trash2}>Excluir item</Button>
        </Row>
        <Row>
          <Button icon={Search} size="lg">Tamanho lg</Button>
          <Button disabled>Desabilitado</Button>
          <Button variant="secondary" disabled>Desabilitado</Button>
          <IconButton label="Adicionar" icon={Plus} />
          <Button
            loading={loadingBtn}
            loadingText="Salvando…"
            onClick={() => {
              setLoadingBtn(true);
              setTimeout(() => setLoadingBtn(false), 1500);
            }}
          >
            Salvar (clique)
          </Button>
          <Button loading>Carregando fixo</Button>
        </Row>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" width="mobile-full">Largura total no celular</Button>
          <Button size="lg" width="mobile-full" variant="secondary">Cancelar</Button>
        </div>
      </Section>

      <Section title="Campos (Field, Input, Select, Textarea, FileInput)">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="E-mail" hint="Use o formato nome@exemplo.com.">
            <Input type="email" placeholder="nome@exemplo.com" />
          </Field>
          <Field label="E-mail com erro" error="Esse e-mail não parece válido. Use o formato nome@exemplo.com.">
            <Input type="email" defaultValue="maria@" />
          </Field>
          <Field label="Categoria">
            <Select defaultValue="">
              <option value="" disabled>Selecione…</option>
              {DEMO_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quando foi encontrado?">
            <Input type="date" defaultValue={isClient ? toLocalDateString(new Date()) : ""} />
          </Field>
          <Field label="Somente leitura">
            <Input defaultValue="Valor fixo" readOnly />
          </Field>
          <Field label="Desabilitado">
            <Input defaultValue="Indisponível" disabled />
          </Field>
          <Field label="Descrição" optional hint="Cor, tamanho, estado.">
            <Textarea
              maxLength={50}
              value={text}
              onChange={(e) => setText(e.target.value)}
              currentLength={text.length}
              placeholder="Digite 40+ caracteres para ver o contador"
            />
          </Field>
          <Field label="Foto" optional>
            <FileInput
              accept="image/jpeg,image/png,image/webp"
              note="JPG, PNG ou WebP"
              onChange={(f) => setPhotoName(f?.name ?? "nenhuma")}
            />
          </Field>
        </div>
        <p className="text-meta text-ink-muted">Foto escolhida: {photoName}</p>
      </Section>

      <Section title="StatusBadge (ícone + texto + cor)">
        <Row>
          {ITEM_STATUSES.map((s) => (
            <ItemStatusBadge key={s} status={s} />
          ))}
          {CLAIM_STATUSES.map((s) => (
            <ClaimStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row>
          <ItemStatusBadge status="under_claim" size="lg" />
          <ClaimStatusBadge status="accepted" size="lg" />
        </Row>
      </Section>

      <Section title="ItemCard e skeleton">
        {isClient ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <ItemCard
                item={{
                  id: "exemplo-1",
                  title: "Fone de ouvido preto (exemplo)",
                  status: "available",
                  foundLocation: "Bloco A",
                  foundDate: daysAgo(2),
                  photoDataUrl: SAMPLE_PHOTO,
                }}
              />
            </li>
            <li>
              <ItemCard
                item={{
                  id: "exemplo-2",
                  title: "Chaveiro com três chaves e um título bem longo para testar a quebra em duas linhas (exemplo)",
                  status: "under_claim",
                  foundLocation: "Portaria",
                  foundDate: daysAgo(1),
                }}
                myClaimStatus="pending"
              />
            </li>
            <li>
              <ItemCard
                item={{
                  id: "exemplo-3",
                  title: "Carteira (exemplo)",
                  status: "returned",
                  foundLocation: "Biblioteca",
                  foundDate: daysAgo(12),
                }}
                myClaimStatus="rejected"
              />
            </li>
          </ul>
        ) : null}
        <LoadingRegion label="Carregando itens…">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <li key={n}>
                <ItemCardSkeleton />
              </li>
            ))}
          </ul>
        </LoadingRegion>
      </Section>

      <Section title="Notice (todos os tons)">
        <Notice tone="info" title="Informação">Aviso informativo com texto em ink.</Notice>
        <Notice tone="success" title="Sucesso">Sua reivindicação foi aceita.</Notice>
        <Notice tone="warning" title="Atenção">Aguardando análise da administração.</Notice>
        <Notice tone="danger" role="alert" title="Erro">Não foi possível enviar. Suas respostas foram mantidas.</Notice>
        <Notice tone="neutral" action={<LinkButton href="/itens" variant="secondary">Ver itens</LinkButton>}>
          Este item já foi devolvido em {isClient ? formatDate(daysAgo(3)) : "…"}.
        </Notice>
      </Section>

      <Section title="EmptyState e ErrorState">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-surface shadow-card">
            <EmptyState
              variant="empty"
              title="Nenhum item registrado ainda"
              action={<LinkButton href="/itens/novo">Registrar item</LinkButton>}
            >
              Quando alguém registrar um item encontrado, ele aparece aqui.
            </EmptyState>
          </div>
          <div className="rounded-lg bg-surface shadow-card">
            <EmptyState
              variant="no-results"
              title="Nenhum item com esses filtros"
              action={<Button variant="secondary">Limpar filtros</Button>}
            >
              Tente outra categoria, local ou período, ou limpe os filtros.
            </EmptyState>
          </div>
          <div className="rounded-lg bg-surface shadow-card">
            <EmptyState variant="restricted" title="Item devolvido não pode ser editado">
              Itens devolvidos ficam somente para leitura.
            </EmptyState>
          </div>
          <div className="rounded-lg bg-surface shadow-card">
            <ErrorState title="Não conseguimos carregar os itens" onRetry={() => toast.info("Tentando de novo…")}>
              Verifique sua conexão e tente de novo.
            </ErrorState>
          </div>
        </div>
      </Section>

      <Section title="Tabs, DefinitionList e acesso negado">
        <Tabs
          group="verif"
          label="Painel"
          value={tab}
          onChange={setTab}
          items={[
            { id: "pending", label: "Reivindicações pendentes", count: 3 },
            { id: "claimed", label: "Itens em reivindicação", count: 2 },
          ]}
        />
        <TabPanel group="verif" id="pending" active={tab === "pending"}>
          <DefinitionList
            items={[
              { label: "Categoria", value: "Eletrônicos", icon: Tag },
              { label: "Encontrado em", value: "Bloco A", icon: MapPin },
              { label: "Data", value: isClient ? `${formatDate(daysAgo(2))} (${formatRelativeDate(daysAgo(2))})` : "…", icon: Calendar },
              { label: "Guardado em", value: "Portaria" },
            ]}
          />
        </TabPanel>
        <TabPanel group="verif" id="claimed" active={tab === "claimed"}>
          <p>Conteúdo da segunda aba.</p>
        </TabPanel>
        <div className="rounded-lg border border-line bg-surface">
          <AccessDenied role={user?.role ?? "student"} />
        </div>
      </Section>

      <Section title="Dialog e Toast">
        <Row>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Diálogo de confirmação</Button>
          <Button variant="danger-quiet" onClick={() => setDestructiveOpen(true)}>Diálogo destrutivo</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>Bottom sheet (filtros)</Button>
        </Row>
        <Row>
          <Button variant="ghost" onClick={() => toast.success("Item registrado. Ele já aparece na busca.")}>Toast sucesso</Button>
          <Button variant="ghost" onClick={() => toast.info("Informação rápida.")}>Toast info</Button>
          <Button variant="ghost" onClick={() => toast.error("Não foi possível salvar. Tente de novo em instantes.")}>Toast erro</Button>
        </Row>
      </Section>

      <ActionBar>
        <Button size="lg" width="mobile-full" variant="secondary">Cancelar</Button>
        <Button size="lg" width="mobile-full">Ação principal (ActionBar)</Button>
      </ActionBar>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Registrar a devolução?"
        description="Item: Fone de ouvido preto (exemplo). Esta ação não pode ser desfeita."
        confirmLabel="Registrar devolução"
        confirmingLabel="Registrando…"
        busy={busy}
        onConfirm={() =>
          simulate(() => {
            setConfirmOpen(false);
            toast.success("Devolução registrada. O item saiu da busca.");
          })
        }
      />
      <ConfirmDialog
        destructive
        open={destructiveOpen}
        onClose={() => setDestructiveOpen(false)}
        title="Excluir este item?"
        description="“Fone de ouvido preto (exemplo)” será removido da busca. Esta ação não pode ser desfeita."
        confirmLabel="Excluir item"
        confirmingLabel="Excluindo…"
        busy={busy}
        onConfirm={() =>
          simulate(() => {
            setDestructiveOpen(false);
            toast.success("Item excluído.");
          })
        }
      />
      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtros"
        variant="sheet"
        actions={
          <>
            <Button variant="ghost" size="lg" width="mobile-full" onClick={() => setSheetOpen(false)}>Limpar</Button>
            <Button size="lg" width="mobile-full" onClick={() => setSheetOpen(false)}>Aplicar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Categoria">
            <Select defaultValue="">
              <option value="">Todas</option>
              {DEMO_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Encontrado de">
            <Input type="date" />
          </Field>
        </div>
      </Dialog>
    </Container>
  );
}

