import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/types/admin";
import { auditActionLabel, auditActorName, auditMetadataPairs, describeAuditTarget, pageRange } from "./list-view";

describe("faixa da página", () => {
  it("mostra do primeiro ao último item da página", () => {
    expect(pageRange({ page: 2, pageSize: 20, total: 45, items: new Array(20) })).toBe("21–40 de 45");
    expect(pageRange({ page: 3, pageSize: 20, total: 45, items: new Array(5) })).toBe("41–45 de 45");
    expect(pageRange({ page: 1, pageSize: 20, total: 0, items: [] })).toBe("0 de 0");
    expect(pageRange({ page: 9, pageSize: 20, total: 5, items: [] })).toBe("0 de 5");
  });
});

describe("trilha de auditoria", () => {
  it("rótulo da ação, com a ação crua se for desconhecida", () => {
    expect(auditActionLabel("login.success")).toBe("Login concluído");
    expect(auditActionLabel("nova.acao")).toBe("nova.acao");
    expect(auditActionLabel("toString")).toBe("toString");
  });
  it("alvo e detalhes", () => {
    expect(describeAuditTarget({ targetType: "item", targetId: "i1" })).toBe("item · i1");
    expect(describeAuditTarget({ targetType: "user", targetId: null })).toBe("user");
    expect(describeAuditTarget({ targetType: null, targetId: null })).toBeNull();
    expect(auditMetadataPairs(null)).toEqual([]);
    expect(auditMetadataPairs({ role: "admin", ok: true, n: 2, x: null } as AuditEntry["metadata"])).toEqual([
      { key: "role", value: "admin" },
      { key: "ok", value: "sim" },
      { key: "n", value: "2" },
      { key: "x", value: "—" },
    ]);
  });
  it("autor", () => {
    expect(auditActorName({ actorId: "u1", actorName: "Ana" })).toBe("Ana");
    expect(auditActorName({ actorId: "u1", actorName: null })).toBe("Usuário removido");
    expect(auditActorName({ actorId: null, actorName: null })).toBe("Sistema ou visitante");
  });
});
