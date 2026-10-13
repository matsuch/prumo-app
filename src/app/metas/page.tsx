import { permanentRedirect } from "next/navigation";

// Metas viraram a aba "Metas" do Cadastro. Mantém links antigos.
export default function MetasPage() {
  permanentRedirect("/cadastro?aba=metas");
}
