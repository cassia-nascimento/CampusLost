import { passwordStrength, PASSWORD_STRENGTH_LABEL } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/components/ui/tones";
import { STRENGTH_SEGMENTS, strengthView } from "./password-strength";

const BAR_COLOR = {
  danger: "bg-danger-border",
  warning: "bg-warning-border",
  success: "bg-success-border",
} as const;

/**
 * Medidor de força (só orienta; quem aceita a senha é a política). Mostra barras E o texto da nota, nunca só cor.
 * Não é região viva: anunciar a cada tecla atrapalharia quem usa leitor de tela. Sem senha digitada, não aparece.
 */
export function PasswordStrengthMeter({ password, className }: { password: string; className?: string }) {
  if (!password) return null;
  const level = passwordStrength(password);
  const { filled, tone } = strengthView(level);
  return (
    <div className={className}>
      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: STRENGTH_SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full", index < filled ? BAR_COLOR[tone] : "bg-sunken")}
          />
        ))}
      </div>
      <p className="mt-1.5 text-meta text-ink-muted">
        Força da senha: <strong className={cn("font-semibold", TONE_CLASSES[tone].fg)}>{PASSWORD_STRENGTH_LABEL[level]}</strong>
      </p>
    </div>
  );
}
