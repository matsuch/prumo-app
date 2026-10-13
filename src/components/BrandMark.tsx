// Símbolo da marca PRUMO: o prumo (fio de prumo) — ponto no topo, haste e a
// massa na base. Usa currentColor, então herda a cor do contexto (ex.: text-primary).
// Baseado nos ícones de referência em public/brand/.
export default function BrandMark({
  className,
  title = "PRUMO",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
    >
      <circle cx="12" cy="3.2" r="2.2" />
      <rect x="10.8" y="6" width="2.4" height="9.2" rx="1.2" />
      <circle cx="12" cy="18.4" r="4.6" />
    </svg>
  );
}
