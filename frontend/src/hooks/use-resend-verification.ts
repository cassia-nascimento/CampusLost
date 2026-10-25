"use client";

import { useCallback, useState } from "react";
import { accountErrorMessage } from "@/components/auth/error-messages";
import { services } from "@/services";
import { isServiceError } from "@/types/domain";

export const RESEND_SENT_MESSAGE = "Enviamos um novo link para o seu e-mail. Verifique também a caixa de spam.";
const RESEND_ERROR_MESSAGE = "Não foi possível reenviar agora. Tente de novo em instantes.";

/** Reenvio do e-mail de verificação com estado de envio e feedback (banner, tela pós-cadastro e link vencido). */
export function useResendVerification() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const resend = useCallback(async () => {
    setSending(true);
    setMessage("");
    setFailed(false);
    try {
      const dispatch = await services.auth.resendVerification();
      setDevLink(dispatch.devLink ?? null);
      setMessage(RESEND_SENT_MESSAGE);
    } catch (error) {
      setFailed(true);
      setMessage(isServiceError(error) && error.code === "RATE_LIMITED" ? error.message : accountErrorMessage(error, RESEND_ERROR_MESSAGE));
    } finally {
      setSending(false);
    }
  }, []);

  return { resend, sending, message, failed, devLink };
}
