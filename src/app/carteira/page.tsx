import { permanentRedirect } from "next/navigation";

// A carteira virou a aba "Investimentos" do Cadastro. Mantém links antigos.
export default function CarteiraPage() {
  permanentRedirect("/cadastro?aba=investimentos");
}
