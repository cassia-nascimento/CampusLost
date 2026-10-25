import { describe, expect, it } from "vitest";
import { ServiceError } from "@/types/domain";
import { classifyTokenFailure } from "./token-failure";

describe("falha de link com token", () => {
  it("inválido e expirado são o mesmo caso; o resto é outro erro", () => {
    expect(classifyTokenFailure(new ServiceError("TOKEN_EXPIRED", "x"))).toBe("invalid");
    expect(classifyTokenFailure(new ServiceError("TOKEN_INVALID", "x"))).toBe("invalid");
    expect(classifyTokenFailure(new ServiceError("NETWORK", "x"))).toBe("other");
    expect(classifyTokenFailure(new Error("x"))).toBe("other");
  });
});
