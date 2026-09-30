import { CredinhoLoader } from "@/components/brand/Credinho";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "@/pages/Index";

const Inteligencia = lazy(() => import("@/pages/site/Inteligencia"));
const SobreCredmais = lazy(() => import("@/pages/site/SobreCredmais"));
const Missao = lazy(() => import("@/pages/site/Missao"));
const Planos = lazy(() => import("@/pages/site/PlanosSite"));
const Privacidade = lazy(() => import("@/pages/Privacidade"));
const Termos = lazy(() => import("@/pages/Termos"));

function OpenFullApp() {
  useEffect(() => {
    window.location.assign(window.location.href);
  }, []);

  return <CredinhoLoader fullScreen label="Abrindo aplicação" />;
}

const MarketingLoader = () => <CredinhoLoader fullScreen label="Carregando página" />;

export default function MarketingApp() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<MarketingLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/inteligencia" element={<Inteligencia />} />
            <Route path="/sobre-credmais" element={<SobreCredmais />} />
            <Route path="/missao" element={<Missao />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="*" element={<OpenFullApp />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
