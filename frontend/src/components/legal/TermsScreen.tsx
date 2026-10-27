import Link from "next/link";
import { LEGAL_LIST, LegalDocument, LegalSection, ToDefine } from "@/components/legal/LegalDocument";

/**
 * `/termos`: termos de uso em linguagem simples. É um TEXTO-MODELO: não nomeia responsável, contato, foro nem
 * data de vigência. A equipe revisa antes de qualquer uso real.
 */
export function TermsScreen() {
  return (
    <LegalDocument
      title="Termos de uso"
      subtitle="As regras para usar o CampusLost, em linguagem simples."
      notice={
        <>
          Este texto é um modelo do protótipo acadêmico. Ele não foi revisado por quem responde pelo sistema nem por
          orientação jurídica. Os trechos marcados como <ToDefine>assim</ToDefine> estão em aberto de propósito: não há
          responsável, contato, foro nem data de vigência definidos.
        </>
      }
    >
      <LegalSection id="servico" title="O que é o CampusLost">
        <p className="text-body">
          O CampusLost é um sistema de achados e perdidos do campus: reúne os objetos encontrados, permite que quem os
          perdeu reivindique o que é seu e registra a devolução. Nasceu como projeto de Engenharia de Software, de
          caráter acadêmico. O serviço é oferecido por <ToDefine>instituição ou pessoa responsável pelo serviço</ToDefine>.
        </p>
      </LegalSection>

      <LegalSection id="quem-pode" title="Quem pode usar">
        <p className="text-body">Podem usar o CampusLost:</p>
        <ul className={LEGAL_LIST}>
          <li>pessoas com conta, com e-mail institucional ou externo;</li>
          <li>a administração, por convite.</li>
        </ul>
        <p className="text-body">
          O vínculo (e-mail institucional ou externo) é definido apenas pelo domínio do e-mail informado. Não verificamos se a pessoa é aluno, professor ou servidor.
        </p>
      </LegalSection>

      <LegalSection id="regras" title="Regras de uso">
        <ul className={LEGAL_LIST}>
          <li>Informe dados verdadeiros no cadastro, nos itens que registra e nas reivindicações.</li>
          <li>Registre somente objetos que você realmente encontrou e reivindique somente o que é seu.</li>
          <li>É proibido fraudar o sistema: reivindicar item de outra pessoa, inventar provas ou usar conta alheia.</li>
          <li>
            As provas de posse que você escreve são analisadas pela administração, que pode aprovar, recusar ou pedir
            mais detalhes antes de qualquer devolução.
          </li>
          <li>Não envie fotos ou textos ofensivos, ilegais ou que exponham dados de outras pessoas.</li>
        </ul>
      </LegalSection>

      <LegalSection id="responsabilidade" title="Responsabilidade limitada">
        <p className="text-body">
          O CampusLost apenas intermedeia o contato entre quem achou, quem perdeu e a administração. A plataforma não
          guarda os objetos: eles ficam no local de guarda indicado em cada item. Por isso, o sistema não garante que um
          item seja encontrado ou devolvido, nem responde por danos ou perdas dos objetos.
        </p>
      </LegalSection>

      <LegalSection id="contas" title="Contas">
        <ul className={LEGAL_LIST}>
          <li>Para criar a conta, o seu e-mail precisa ser confirmado.</li>
          <li>Você cuida da sua senha e responde pelo que acontece na sua conta.</li>
          <li>Contas da administração exigem verificação em duas etapas (2FA).</li>
          <li>
            Contas podem ser suspensas em caso de abuso, como fraude, informações falsas ou uso que prejudique outras
            pessoas.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="privacidade" title="Privacidade">
        <p className="text-body">
          O tratamento dos seus dados pessoais está descrito na{" "}
          <Link href="/privacidade" className="link font-semibold">
            política de privacidade
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="Alterações nestes termos">
        <p className="text-body">
          Estes termos podem mudar. A nova versão aparece nesta página e vale a partir da data indicada nela. Para
          dúvidas, o contato é <ToDefine>canal de contato</ToDefine>.
        </p>
      </LegalSection>

      <LegalSection id="vigencia" title="Vigência e foro">
        <p className="text-body">
          Estes termos valem a partir de <ToDefine>data de vigência</ToDefine>. Eventuais conflitos serão resolvidos no
          foro de <ToDefine>foro</ToDefine>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
