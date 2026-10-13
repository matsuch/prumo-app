// Stub vazio de "server-only" para o ambiente de testes (vitest). Em produção o
// Next.js resolve o pacote real, que barra import em client components; nos testes
// unitários (node) não há essa distinção, então neutralizamos o import.
export {};
