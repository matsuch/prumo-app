import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { isCronRequest } from "../auth";

function req(authorization?: string): Request {
  return new Request("https://exemplo.com/api/cron/diario", {
    headers: authorization ? { authorization } : {},
  });
}

describe("isCronRequest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("aceita só o Bearer com o segredo exato", () => {
    vi.stubEnv("CRON_SECRET", "s3gr3do");
    expect(isCronRequest(req("Bearer s3gr3do"))).toBe(true);
    expect(isCronRequest(req("Bearer s3gr3dx"))).toBe(false);
    expect(isCronRequest(req("Bearer s3gr3do2"))).toBe(false);
    expect(isCronRequest(req())).toBe(false);
  });

  it("recusa tudo quando CRON_SECRET não está configurado", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronRequest(req("Bearer undefined"))).toBe(false);
    expect(isCronRequest(req("Bearer "))).toBe(false);
  });
});
