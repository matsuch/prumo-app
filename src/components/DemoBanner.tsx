// MODO DEMO: faixa fixa no topo avisando que os dados são fictícios.
export default function DemoBanner() {
  return (
    <div
      role="note"
      className="bg-primary text-primary-foreground px-4 py-1.5 text-center text-xs font-medium"
    >
      Modo demo: todos os dados são fictícios e o que você alterar fica salvo só neste navegador.
    </div>
  );
}
