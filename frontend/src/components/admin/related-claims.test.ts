import { describe, expect, it } from "vitest";
import { relatedClaims } from "./related-claims";

const claim = (id: string, createdAt: string, status = "pending") => ({ id, createdAt, status });

describe("relatedClaims", () => {
  it("uma única reivindicação: sem anterior nem próxima", () => {
    const result = relatedClaims([claim("a", "2026-10-01T10:00:00.000Z")], "a");
    expect(result).toMatchObject({ index: 0, total: 1, previous: null, next: null });
  });

  it("várias pendentes: posição e vizinhas da aberta", () => {
    const claims = [
      claim("a", "2026-10-01T10:00:00.000Z"),
      claim("b", "2026-10-02T10:00:00.000Z"),
      claim("c", "2026-10-03T10:00:00.000Z"),
    ];
    const result = relatedClaims(claims, "b");
    expect(result.index).toBe(1);
    expect(result.total).toBe(3);
    expect(result.previous?.id).toBe("a");
    expect(result.next?.id).toBe("c");
  });

  it("ordena pela data de envio (mais antiga primeiro), sem alterar a lista de entrada", () => {
    const claims = [
      claim("c", "2026-10-03T10:00:00.000Z"),
      claim("a", "2026-10-01T10:00:00.000Z"),
      claim("b", "2026-10-02T10:00:00.000Z"),
    ];
    const result = relatedClaims(claims, "a");
    expect(result.list.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(claims.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("estados mistos entram na lista e na navegação, com o status preservado", () => {
    const claims = [
      claim("a", "2026-10-01T10:00:00.000Z", "rejected"),
      claim("b", "2026-10-02T10:00:00.000Z", "accepted"),
      claim("c", "2026-10-03T10:00:00.000Z", "pending"),
    ];
    const result = relatedClaims(claims, "c");
    expect(result.list.map((c) => c.status)).toEqual(["rejected", "accepted", "pending"]);
    expect(result.previous?.id).toBe("b");
    expect(result.next).toBeNull();
  });

  it("extremos: a primeira não tem anterior; a última não tem próxima", () => {
    const claims = [claim("a", "2026-10-01T10:00:00.000Z"), claim("b", "2026-10-02T10:00:00.000Z")];
    expect(relatedClaims(claims, "a")).toMatchObject({ previous: null, next: { id: "b" } });
    expect(relatedClaims(claims, "b")).toMatchObject({ previous: { id: "a" }, next: null });
  });

  it("datas iguais mantêm a ordem recebida", () => {
    const same = "2026-10-01T10:00:00.000Z";
    const result = relatedClaims([claim("x", same), claim("y", same), claim("z", same)], "y");
    expect(result.list.map((c) => c.id)).toEqual(["x", "y", "z"]);
    expect(result.previous?.id).toBe("x");
    expect(result.next?.id).toBe("z");
  });

  it("id inexistente: sem posição e sem vizinhas, mas a lista continua inteira", () => {
    const claims = [claim("a", "2026-10-01T10:00:00.000Z"), claim("b", "2026-10-02T10:00:00.000Z")];
    expect(relatedClaims(claims, "nope")).toMatchObject({ index: -1, total: 2, previous: null, next: null });
  });

  it("sem reivindicações", () => {
    expect(relatedClaims([], "a")).toEqual({ list: [], index: -1, total: 0, previous: null, next: null });
  });
});
