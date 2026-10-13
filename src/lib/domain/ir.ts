// Imposto de Renda sobre renda fixa — tabela regressiva por prazo (dias
// corridos desde a aplicação). Incide sobre o RENDIMENTO, no resgate.
// LCI/LCA e alguns títulos são isentos (tratado via flag na posição).

export function aliquotaIR(diasCorridos: number): number {
  if (diasCorridos <= 180) return 0.225;
  if (diasCorridos <= 360) return 0.2;
  if (diasCorridos <= 720) return 0.175;
  return 0.15;
}

export interface IRResult {
  aliquota: number;
  imposto: number;
}

/** Calcula o IR devido sobre um rendimento bruto positivo. */
export function calcIR(rendimentoBruto: number, diasCorridos: number, isento: boolean): IRResult {
  if (isento || rendimentoBruto <= 0) return { aliquota: 0, imposto: 0 };
  const aliquota = aliquotaIR(diasCorridos);
  return { aliquota, imposto: rendimentoBruto * aliquota };
}
