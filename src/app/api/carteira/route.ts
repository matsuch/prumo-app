import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";
import { valuateCarteira } from "@/lib/market/valuation";
import { getSessionUser, unauthorized } from "@/lib/server/auth";

interface Payload {
  fixedIncome?: FixedIncomePosition[];
  stocks?: StockPosition[];
}

export async function POST(request: Request) {
  if (!(await getSessionUser())) return unauthorized();
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const fixed = body.fixedIncome ?? [];
  const stocks = body.stocks ?? [];

  const { fixedResults, stockResults, warnings, updatedAt } = await valuateCarteira(fixed, stocks);

  return Response.json({ fixedResults, stockResults, warnings, updatedAt });
}
