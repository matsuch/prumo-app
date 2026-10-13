"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.replace("/");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <Card className="p-7">
        <CardContent className="px-0">
          <div className="mb-6 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-primary grid size-9 place-items-center rounded-lg"
            >
              <BrandMark className="text-primary-foreground size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">PRUMO</p>
              <h1 className="text-lg font-bold leading-tight tracking-tight">Entrar na sua conta</h1>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-muted-foreground block text-xs font-medium">
                E-mail
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-muted-foreground block text-xs font-medium">
                Senha
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                placeholder="sua senha…"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs font-medium">
        <span className="text-muted-foreground">Decisões de hoje. </span>
        <span className="text-primary">Patrimônio de amanhã.</span>
      </p>
    </main>
  );
}
