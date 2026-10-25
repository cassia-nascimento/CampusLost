import Link from "next/link";
import { LEGAL_LIST, LegalDocument, LegalSection, ToDefine } from "@/components/legal/LegalDocument";

/**
 * `/privacidade`: política de privacidade em linguagem simples (LGPD). É um TEXTO-MODELO: não nomeia controlador,
 * encarregado nem canal de contato, e prazos de guarda ficam em aberto. A equipe revisa antes de qualquer uso real.
 */
export function PrivacyScreen() {
  return (
    <LegalDocument
      title="Política de privacidade"
      subtitle="Como o CampusLost trata os seus dados pessoais, em linguagem simples."
      notice={
        <>
          Este texto é um modelo do protótipo acadêmico. Ele não foi revisado por quem responde pelo sistema nem por
          orientação jurídica. Os trechos marcados como <ToDefine>assim</ToDefine> estão em aberto de propósito: não há
          responsável, contato nem prazo definidos.
        </>
      }
    >
      <LegalSection id="quem" title="Quem cuida dos seus dados">
        <p className="text-body">
          O CampusLost é um sistema de achados e perdidos do campus. Quem decide como os dados são usados (o
          controlador) é <ToDefine>instituição ou pessoa responsável</ToDefine>. O contato para assuntos de
          privacidade é <ToDefine>canal de contato e encarregado, se houver</ToDefine>.
        </p>
      </LegalSection>

      <LegalSection id="dados" title="Quais dados coletamos">
        <ul className={LEGAL_LIST}>
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
      </LegalSection>

      <LegalSection id="uso" title="Para que usamos">
        <ul className={LEGAL_LIST}>
          <li>Criar e proteger a sua conta e confirmar o seu e-mail.</li>
          <li>Mostrar os itens achados e permitir que você os reivindique.</li>
          <li>Permitir que a administração analise reivindicações e registre devoluções.</li>
          <li>Responder a pedidos seus sobre os seus dados.</li>
        </ul>
        <p className="text-body">
          Base legal (LGPD, art. 7º) para cada uso: <ToDefine>a equipe indica, ex.: execução do serviço, legítimo interesse</ToDefine>.
        </p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="Quem vê os seus dados">
        <ul className={LEGAL_LIST}>
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
      </LegalSection>

      <LegalSection id="prazo" title="Por quanto tempo guardamos">
        <p className="text-body">
          Prazo de guarda das contas, itens e reivindicações: <ToDefine>prazo e critério</ToDefine>. Se você excluir a
          conta, tratamos como descrito em &ldquo;Seus direitos&rdquo;.
        </p>
      </LegalSection>

      <LegalSection id="direitos" title="Seus direitos">
        <p className="text-body">
          A LGPD (art. 18) garante, entre outros, que você pode pedir: confirmação de que tratamos seus dados, acesso a
          eles, correção, eliminação, portabilidade, informação sobre com quem os compartilhamos e a revogação de
          consentimentos.
        </p>
        <p className="text-body">Dentro do CampusLost, logado, você pode:</p>
        <ul className={LEGAL_LIST}>
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
      </LegalSection>

      <LegalSection id="mudancas" title="Mudanças neste texto">
        <p className="text-body">
          Última atualização: <ToDefine>data</ToDefine>. Se este texto mudar, a nova versão aparece nesta página.
        </p>
        <p className="text-body">
          O uso do serviço também segue os{" "}
          <Link href="/termos" className="link font-semibold">
            termos de uso
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
