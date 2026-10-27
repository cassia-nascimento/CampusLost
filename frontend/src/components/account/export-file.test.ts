import { describe, expect, it } from "vitest";
import type { MyDataExport } from "@/services";
import { exportFileName, serializeExport } from "./export-file";

const sample: MyDataExport = {
  format: "campuslost-export-v1",
  exportedAt: "2026-10-25T12:00:00.000Z",
  account: {
    id: "u1",
    name: "Maria Exemplo",
    email: "maria@demo.test",
    role: "user",
    affiliation: "institutional",
    provider: "password",
    createdAt: "2026-10-01T10:00:00.000Z",
    emailVerifiedAt: "2026-10-01T10:05:00.000Z",
    termsAcceptedAt: "2026-10-01T10:00:00.000Z",
    termsVersion: "2026-10",
  },
  itemsRegistered: [],
  claims: [],
  returns: [],
  sessions: [],
};

describe("arquivo de exportação de dados", () => {
  it("nomeia com a data da exportação", () => {
    expect(exportFileName(sample.exportedAt)).toBe("campuslost-meus-dados-2026-10-25.json");
    expect(exportFileName("invalido")).toBe("campuslost-meus-dados.json");
  });

  it("serializa JSON legível que volta igual, com o formato e a conta", () => {
    const text = serializeExport(sample);
    expect(text).toContain("\n");
    const parsed = JSON.parse(text) as MyDataExport;
    expect(parsed).toEqual(sample);
    expect(parsed.format).toBe("campuslost-export-v1");
    expect(parsed.account.email).toBe("maria@demo.test");
  });
});
