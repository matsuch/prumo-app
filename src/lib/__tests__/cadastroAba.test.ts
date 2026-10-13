import { describe, it, expect } from "vitest";
import { parseAba } from "../cadastroAba";

describe("parseAba", () => {
  it("aceita as abas conhecidas", () => {
    expect(parseAba("investimentos")).toBe("investimentos");
    expect(parseAba("metas")).toBe("metas");
  });

  it("cai na aba Mês quando ausente ou inválida", () => {
    expect(parseAba(undefined)).toBe("mes");
    expect(parseAba("xyz")).toBe("mes");
  });
});
