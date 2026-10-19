/** Aparência comum de Input, Select e Textarea (DESIGN §6.2). Borda de foco/erro sem deslocar o layout. */
export const CONTROL_CLASSES =
  "block w-full touch-target-lg rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink " +
  "hover:border-ink-muted " +
  "focus-visible:border-primary focus-visible:shadow-[inset_0_0_0_1px_var(--color-primary)] " +
  "aria-invalid:border-danger-border aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger-border)] " +
  "read-only:border-transparent read-only:bg-disabled-bg " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg";
