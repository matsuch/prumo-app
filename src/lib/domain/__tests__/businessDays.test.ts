import { describe, it, expect } from "vitest";
import { businessDaysBetween } from "../businessDays";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("businessDaysBetween", () => {
  it("é 0 no mesmo dia", () => {
    expect(businessDaysBetween(d("2025-06-10"), d("2025-06-10"))).toBe(0);
  });

  it("conta apenas dias úteis, pulando fim de semana e feriado fixo", () => {
    // [01/01 (feriado), 02, 03, 04(sáb), 05(dom), 06, 07) → 02,03,06,07 = 4
    expect(businessDaysBetween(d("2025-01-01"), d("2025-01-08"))).toBe(4);
  });

  it("pula feriados móveis (Carnaval 2025: 03 e 04/03)", () => {
    expect(businessDaysBetween(d("2025-03-03"), d("2025-03-05"))).toBe(0);
  });

  it("pula Sexta-feira Santa e Páscoa (2025: 18 e 20/04)", () => {
    // 18(sexta santa), 19(sáb), 20(dom/páscoa) → 0
    expect(businessDaysBetween(d("2025-04-18"), d("2025-04-21"))).toBe(0);
  });

  it("uma semana comum sem feriados tem 5 dias úteis", () => {
    // 09/06/2025 é segunda; [09..13) seg-sex = 5
    expect(businessDaysBetween(d("2025-06-09"), d("2025-06-16"))).toBe(5);
  });
});
