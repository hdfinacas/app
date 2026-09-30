import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ErrorState from "@/components/feedback/ErrorState";

const ContractRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const redirect = async () => {
      if (!id) { navigate("/clientes", { replace: true }); return; }
      setError(null);
      const { data, error: queryError } = await supabase.from("contracts").select("client_id").eq("id", id).maybeSingle();
      if (queryError) {
        setError(queryError);
        return;
      }
      if (data?.client_id) {
        navigate(`/clientes/${data.client_id}`, { replace: true });
      } else {
        navigate("/clientes", { replace: true });
      }
    };
    redirect();
  }, [attempt, id, navigate]);

  if (error) {
    return <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4"><ErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /></div>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default ContractRedirect;
