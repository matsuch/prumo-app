"use client";

import Link from "next/link";
import Modal from "./Modal";

// MODO DEMO: a análise do ativo vem da engine de inteligência de mercado, que fica
// na versão privada. O modal mantém o fluxo e aponta para a tela de Ações.
export default function AssetAnalysisModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  return (
    <Modal title={ticker} onClose={onClose}>
      <div className="text-muted-foreground space-y-3 text-sm">
        <p>
          Na versão completa, aqui aparecem os fundamentos, a reação recente do preço, as
          exposições do ativo e os eventos de mercado que o afetam, calculados pela engine de
          inteligência de mercado, que não faz parte do código aberto.
        </p>
        <Link
          href={`/acoes?ticker=${encodeURIComponent(ticker)}`}
          className="text-primary inline-block underline"
        >
          Ver a evolução de {ticker} em Ações →
        </Link>
      </div>
    </Modal>
  );
}
