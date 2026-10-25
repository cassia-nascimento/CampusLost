import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Notice } from "@/components/ui/Notice";

/** Lacuna que a equipe precisa preencher: aparece destacada para ninguém publicar o texto sem revisar. */
function ToDefine({ children }: { children: ReactNode }) {
  return <mark className="rounded-sm bg-warning-bg px-1 font-semibold text-warning-fg">[A definir pela equipe: {children}]</mark>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 flex flex-col gap-3">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LIST = "flex list-disc flex-col gap-1.5 pl-6 text-body";

/**
 * `/privacidade`: política de privacidade em linguagem simples (LGPD). É um TEXTO-MODELO: não nomeia controlador,
 * encarregado nem canal de contato, e prazos de guarda ficam em aberto. A equipe revisa antes de qualquer uso real.
 */
export function PrivacyScreen() {
  return (
    <Container size="form">
      <h1>Política de privacidade</h1>
      <p className="mt-2 text-body text-ink-muted">
        Como o CampusLost trata os seus dados pessoais, em linguagem simples.
      </p>

      <Notice tone="warning" title="Texto-modelo, a ser revisado pela equipe" className="mt-6">
        Este texto é um modelo do protótipo acadêmico. Ele não foi revisado por quem responde pelo sistema nem por
        orientação jurídica. Os trechos marcados como <ToDefine>assim</ToDefine> estão em aberto de propósito: não há
        responsável, contato nem prazo definidos.
      </Notice>

      <Section id="quem" title="Quem cuida dos seus dados">
        <p className="text-body">
          O CampusLost é um sistema de achados e perdidos do campus. Quem decide como os dados são usados (o
          controlador) é <ToDefine>instituição ou pessoa responsável</ToDefine>. O contato para assuntos de
          privacidade é <ToDefine>canal de contato e encarregado, se houver</ToDefine>.
        </p>
      </Section>

      <Section id="dados" title="Quais dados coletamos">
        <ul className={LIST}>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e o papel que você informa (aluno, professor ou comunidade
            externa). O papel não é verificado.
          </li>
          <li>
            <strong>Acesso:</strong> sua senha, guardada apenas de forma protegida (nunca em texto legível). Se você
            entra com o Google, recebemos seu nome e e-mail dessa conta.
          </li>
          <li>
            <strong>Itens que você registra:</strong> título, descrição, local e data em que achou, onde o item
            ficou guardado e a foto, se você enviar.
          </li>
          <li>
            <strong>Reivindicações:</strong> os detalhes que você escreve para provar que o item é seu e onde e
            quando o perdeu.
          </li>
          <li>
            <strong>Devoluções:</strong> o registro de que um item foi entregue a você e quando.
          </li>
        </ul>
      </Section>

      <Section id="uso" title="Para que usamos">
        <ul className={LIST}>
          <li>Criar e proteger a sua conta e confirmar o seu e-mail.</li>
          <li>Mostrar os itens achados e permitir que você os reivindique.</li>
          <li>Permitir que a administração analise reivindicações e registre devoluções.</li>
          <li>Responder a pedidos seus sobre os seus dados.</li>
        </ul>
        <p className="text-body">
          Base legal (LGPD, art. 7º) para cada uso: <ToDefine>a equipe indica, ex.: execução do serviço, legítimo interesse</ToDefine>.
        </p>
      </Section>

      <Section id="compartilhamento" title="Quem vê os seus dados">
        <ul className={LIST}>
          <li>
            <strong>Visitantes</strong> veem os itens, sem o local de guarda e sem quem os registrou.
          </li>
          <li>
            <strong>Quem tem conta</strong> vê o nome de quem registrou um item, mas não o e-mail.
          </li>
          <li>
            <strong>A administração</strong> vê as reivindicações, com o nome, o e-mail e o papel de quem reivindicou.
          </li>
          <li>
            O <strong>Google</strong> participa só se você escolher entrar com ele.
          </li>
        </ul>
        <p className="text-body">
          Outros serviços usados para hospedar o sistema ou enviar e-mails: <ToDefine>lista de operadores</ToDefine>.
        </p>
      </Section>

      <Section id="prazo" title="Por quanto tempo guardamos">
        <p className="text-body">
          Prazo de guarda das contas, itens e reivindicações: <ToDefine>prazo e critério</ToDefine>. Se você excluir a
          conta, tratamos como descrito em &ldquo;Seus direitos&rdquo;.
        </p>
      </Section>

      <Section id="direitos" title="Seus direitos">
        <p className="text-body">
          A LGPD (art. 18) garante, entre outros, que você pode pedir: confirmação de que tratamos seus dados, acesso a
          eles, correção, eliminação, portabilidade, informação sobre com quem os compartilhamos e a revogação de
          consentimentos.
        </p>
        <p className="text-body">Dentro do CampusLost, logado, você pode:</p>
        <ul className={LIST}>
          <li>
            <strong>Baixar meus dados:</strong> um arquivo com o seu cadastro, os itens que registrou, suas
            reivindicações e as devoluções feitas a você.
          </li>
          <li>
            <strong>Excluir minha conta:</strong> seu nome e e-mail são removidos e suas reivindicações encerradas. Os
            itens que você registrou continuam no acervo, sem o seu nome. Não dá para desfazer.
          </li>
        </ul>
        <p className="text-body">
          Os dois ficam em{" "}
          <Link href="/conta" className="link font-semibold">
            Minha conta
          </Link>
          . Para outros pedidos, use o contato indicado no início deste texto.
        </p>
      </Section>

      <Section id="mudancas" title="Mudanças neste texto">
        <p className="text-body">
          Última atualização: <ToDefine>data</ToDefine>. Se este texto mudar, a nova versão aparece nesta página.
        </p>
      </Section>
    </Container>
  );
}
