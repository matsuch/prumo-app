import { Lock } from "lucide-react";
import { Card, CardContent } from "./ui/card";

// MODO DEMO: cartão que ocupa o lugar de um módulo que só existe na versão privada.
export default function PrivateModule({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex gap-3 py-2">
        <Lock className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{title}</p>
          <div className="text-muted-foreground space-y-2">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}
