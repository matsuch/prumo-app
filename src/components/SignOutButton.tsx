"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";

export default function SignOutButton({
  className,
}: {
  /** Permite ampliar o alvo de toque no rodapé da interface mobile. */
  className?: string;
}) {
  const router = useRouter();
  async function signOut() {
    // Demo: "Sair" volta a carteira fictícia ao estado inicial.
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return (
    <Button variant="outline" size="sm" className={className} onClick={signOut}>
      Reiniciar demo
    </Button>
  );
}
