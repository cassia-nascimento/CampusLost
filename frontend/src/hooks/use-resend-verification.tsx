"use client";

import { useCallback, useState } from "react";
import { accountErrorMessage } from "@/components/auth/error-messages";
import { useTurnstile } from "@/hooks/use-turnstile";
import { services } from "@/services";
import { isServiceError } from "@/types/domain";

export const RESEND_SENT_MESSAGE = "Enviamos um novo link para o seu e-mail. Verifique também a caixa de spam.";
const RESEND_ERROR_MESSAGE = "Não foi possível reenviar agora. Tente de novo em instantes.";

/**
 * Reenvio do e-mail de verificação com estado de envio e feedback (banner, tela pós-cadastro e link vencido).
 * Com captcha configurado, o widget só aparece depois do primeiro clique (não pesa em toda página do app);
 * o botão fica desabilitado até haver token e o segundo clique envia.
 */
export function useResendVerification() {
  const [sending, setSending] = useState(false);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const { token, reset, blocked, widget } = useTurnstile();

  const resend = useCallback(async () => {
    setMessage("");
    setFailed(false);
    // Primeiro clique com captcha configurado: só mostra o widget.
    if (widget && !armed) {
      setArmed(true);
      return;
    }
    setSending(true);
    try {
      const dispatch = await services.auth.resendVerification(token);
      setDevLink(dispatch.devLink ?? null);
      setMessage(RESEND_SENT_MESSAGE);
    } catch (error) {
      setFailed(true);
      setMessage(isServiceError(error) && error.code === "RATE_LIMITED" ? error.message : accountErrorMessage(error, RESEND_ERROR_MESSAGE));
    } finally {
      setSending(false);
      reset();
    }
  }, [widget, armed, token, reset]);

  return {
    resend,
    sending,
    message,
    failed,
    devLink,
    /** Captcha ativo e sem token: o botão fica desabilitado. */
    blocked: armed && blocked,
    /** Elemento do captcha; nulo sem chave ou antes do primeiro clique. */
    widget: armed ? widget : null,
  };
}
