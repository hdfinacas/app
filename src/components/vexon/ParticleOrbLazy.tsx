import { Suspense, lazy } from "react";

/**
 * O `ParticleOrb` arrasta o three.js inteiro (~450 KB minificado) só para
 * desenhar um halo de partículas de fundo. Nos dois lugares onde ele aparece
 * — a landing e o checkout — o elemento é decorativo: fica dentro de um
 * container `pointer-events-none` atrás do conteúdo.
 *
 * Carregar isso de forma síncrona colocava o three.js no caminho crítico da
 * página de PAGAMENTO, que é justamente onde a pessoa está no celular, muitas
 * vezes em rede ruim, prestes a assinar. Aqui ele passa a ser buscado depois
 * da primeira pintura; até chegar, o fundo é o gradiente que já existe embaixo.
 */
const ParticleOrbImpl = lazy(() =>
  import("./ParticleOrb").then((m) => ({ default: m.ParticleOrb })),
);

type Props = {
  className?: string;
  start?: boolean;
};

export const ParticleOrb = (props: Props) => (
  <Suspense fallback={null}>
    <ParticleOrbImpl {...props} />
  </Suspense>
);
