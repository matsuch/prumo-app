// MODO DEMO: o Copiloto de verdade (Claude com tool-use, memória de longo prazo e
// contexto da carteira montado no servidor) fica na versão privada. Aqui a rota
// responde no mesmo formato de streaming — texto, separador nulo, JSON de custo —
// para a interface do chat funcionar igual.

const RESPOSTA = `Este é o **modo demo** do PRUMO, então o Copiloto não está ligado à IA aqui.

Na versão completa ele:

- lê a sua carteira, o orçamento e as faturas direto do banco (nunca do que o navegador manda);
- chama ferramentas do próprio app para analisar ativos e comparar cenários;
- guarda uma **memória de longo prazo** sobre você (veja a tela *Memória*);
- responde em streaming, com custo estimado por resposta.

Enquanto isso, explore o dashboard, as projeções, as metas e os cartões: os números são fictícios, mas os cálculos são os mesmos do app real.`;

export async function POST() {
  const encoder = new TextEncoder();
  const pedacos = RESPOSTA.match(/[^]{1,24}(\s|$)/g) ?? [RESPOSTA];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const p of pedacos) {
        controller.enqueue(encoder.encode(p));
        await new Promise((r) => setTimeout(r, 25));
      }
      controller.enqueue(encoder.encode(String.fromCharCode(0) + JSON.stringify({ cost: 0 })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
