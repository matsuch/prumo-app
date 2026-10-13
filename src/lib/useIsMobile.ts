"use client";

import { useSyncExternalStore } from "react";

// Detecção de dispositivo por VIEWPORT (não por user-agent): a interface mobile
// entra em telas estreitas e também em telas baixas com ponteiro grosso (celular
// deitado). Assim o mesmo build serve celular, tablet e desktop, e redimensionar
// a janela no desktop troca de layout na hora.
const MOBILE_QUERY = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// No servidor não há viewport: assume desktop (o layout atual) e o cliente
// corrige na hidratação, antes de qualquer dado chegar na tela.
function getServerSnapshot(): boolean {
  return false;
}

/** `true` quando a tela é de celular — usado para escolher a interface mobile. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
