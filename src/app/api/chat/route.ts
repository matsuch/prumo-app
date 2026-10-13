// MODO DEMO: o Copiloto de verdade (Claude com tool-use, memória de longo prazo e
// contexto da carteira montado no servidor) fica na versão privada. Aqui as quatro
// perguntas sugeridas recebem respostas montadas com as regras de domínio sobre a
// carteira fictícia (src/lib/demo/copilot.ts); o resto recebe uma explicação do
// demo. O formato é o mesmo do app real (texto em streaming, separador nulo, JSON
// de custo), para a interface do chat funcionar igual.

import { createClient } from "@/lib/supabase/server";
import { getCarteira } from "@/lib/supabase/carteira";
import { getGoals as getMonthlyGoals, metaDoMes } from "@/lib/supabase/goal";
import {
  getPluggyAccounts,
  getPluggyBills,
  getPluggyPositions,
  getPluggyTransactions,
} from "@/lib/supabase/pluggy";
import { valuateCarteira } from "@/lib/market/valuation";
import { answerDemoQuestion, classifyQuestion } from "@/lib/demo/copilot";

const SEM_IA = `Este é o **modo demo** do PRUMO, então o Copiloto não está ligado à IA aqui. Ele responde às quatro perguntas sugeridas com os dados fictícios desta carteira.

Na versão completa ele:

- lê a sua carteira, o orçamento e as faturas direto do banco (nunca do que o navegador manda);
- chama ferramentas do próprio app para analisar ativos e comparar cenários;
- guarda uma **memória de longo prazo** sobre você (veja a tela *Memória*);
- responde em streaming, com custo estimado por resposta.

Experimente uma das sugestões, ou explore o dashboard, as metas e os cartões.`;

async function responder(pergunta: string): Promise<string> {
  const q = classifyQuestion(pergunta);
  if (!q) return SEM_IA;

  const db = await createClient();
  const [carteira, pluggy, accounts, bills, transactions, metas] = await Promise.all([
    getCarteira(db),
    getPluggyPositions(db),
    getPluggyAccounts(db),
    getPluggyBills(db),
    getPluggyTransactions(db),
    getMonthlyGoals(db),
  ]);

  // Só a pergunta de diversificação/projeção precisa dos valores a mercado.
  const precisaValuation = q === "diversificacao" || q === "projecao";
  const val = precisaValuation
    ? await valuateCarteira(carteira.fixed, carteira.stocks)
    : { fixedResults: [], stockResults: [] };

  return answerDemoQuestion(q, {
    today: new Date().toISOString().slice(0, 10),
    fixed: carteira.fixed,
    stocks: carteira.stocks,
    fixedValues: Object.fromEntries(val.fixedResults.map((r) => [r.id, r.valorAtual])),
    stockValues: Object.fromEntries(
      val.stockResults.filter((r) => r.valorAtual != null).map((r) => [r.id, r.valorAtual!]),
    ),
    pluggy,
    accounts,
    bills,
    transactions,
    aporteMensal: metaDoMes(metas) || 4000,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: { role: string; content: string }[];
  };
  const ultima = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
  const texto = await responder(String(ultima?.content ?? "")).catch(() => SEM_IA);

  const encoder = new TextEncoder();
  const pedacos = texto.match(/[^]{1,24}(\s|$)/g) ?? [texto];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const p of pedacos) {
        controller.enqueue(encoder.encode(p));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(encoder.encode(String.fromCharCode(0) + JSON.stringify({ cost: 0 })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
