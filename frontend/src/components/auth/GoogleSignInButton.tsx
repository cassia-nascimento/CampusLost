"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";

/** Tipos mínimos do Google Identity Services (só o que usamos). */
interface GoogleCredentialResponse {
  credential?: string;
}
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: "popup";
    auto_select: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "signin_with" | "signup_with";
      shape: "rectangular";
      logo_alignment: "left";
      locale: string;
      width: number;
    },
  ): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
/** Largura máxima do botão (cabe em 360 px com a margem lateral) e limites aceitos pelo Google. */
const MAX_WIDTH = 328;
const MIN_WIDTH = 200;

let scriptPromise: Promise<void> | null = null;

/** Carrega o script do Google uma única vez por página. */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = null; // permite nova tentativa ao reabrir a tela
      reject(new Error("gsi"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface GoogleSignInButtonProps {
  clientId: string;
  /** Recebe o ID token (`credential`) assim que a pessoa escolhe a conta. */
  onCredential(credential: string): void;
  /** Rótulo oficial do botão: "Fazer login com o Google" ou "Cadastrar-se com o Google". */
  mode?: "signin" | "signup";
}

/** Botão oficial "Entrar com Google" (GIS). Sem filtro de domínio: contas de outros domínios entram como comunidade externa. */
export function GoogleSignInButton({ clientId, onCredential, mode = "signin" }: GoogleSignInButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    loadGsi().then(
      () => {
        const api = window.google?.accounts?.id;
        const container = containerRef.current;
        if (cancelled || !container) return;
        if (!api) {
          setState("failed");
          return;
        }
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          },
          ux_mode: "popup",
          auto_select: false,
        });
        const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(wrapperRef.current?.clientWidth ?? 0) || MAX_WIDTH));
        api.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: "pt-BR",
          width,
        });
        setState("ready");
      },
      () => {
        if (!cancelled) setState("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [clientId, mode]);

  if (state === "failed") {
    return <Notice tone="neutral">Não foi possível carregar o login com Google. Use e-mail e senha.</Notice>;
  }

  return (
    <div ref={wrapperRef} className="min-h-11">
      {state === "loading" ? <Skeleton className="h-11 w-full rounded-md" /> : null}
      <div ref={containerRef} className={state === "ready" ? "flex justify-center" : "hidden"} />
    </div>
  );
}
