-- Atualiza o progresso sem o ciclo inseguro ler -> somar -> gravar do cliente.
-- O bloqueio da linha impede que cliques ou abas concorrentes percam valores.
CREATE OR REPLACE FUNCTION public.increment_goal_amount(_goal_id uuid, _delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _current numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _delta IS NULL OR _delta::text IN ('NaN', 'Infinity', '-Infinity') OR round(_delta, 2) = 0 THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  SELECT current_amount INTO _current
  FROM public.goals
  WHERE id = _goal_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'goal_not_found'; END IF;

  _current := greatest(0, round((coalesce(_current, 0) + _delta)::numeric, 2));
  UPDATE public.goals SET current_amount = _current
  WHERE id = _goal_id AND user_id = auth.uid();
  RETURN _current;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_goal_amount(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_goal_amount(uuid, numeric) TO authenticated;
