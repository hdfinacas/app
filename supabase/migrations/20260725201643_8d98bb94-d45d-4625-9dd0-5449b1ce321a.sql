
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key TEXT PRIMARY KEY,
  tokens DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) touches this table via the SECURITY DEFINER function below.

CREATE OR REPLACE FUNCTION public.try_consume_rate_limit(
  _key TEXT,
  _capacity DOUBLE PRECISION,
  _refill_per_sec DOUBLE PRECISION
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _tokens DOUBLE PRECISION;
  _last TIMESTAMPTZ;
  _elapsed DOUBLE PRECISION;
  _deficit DOUBLE PRECISION;
  _retry_ms INT;
BEGIN
  INSERT INTO public.rate_limit_hits (key, tokens, updated_at)
  VALUES (_key, _capacity, _now)
  ON CONFLICT (key) DO NOTHING;

  SELECT tokens, updated_at INTO _tokens, _last
  FROM public.rate_limit_hits
  WHERE key = _key
  FOR UPDATE;

  _elapsed := GREATEST(0, EXTRACT(EPOCH FROM (_now - _last)));
  _tokens := LEAST(_capacity, _tokens + _elapsed * _refill_per_sec);

  IF _tokens >= 1 THEN
    UPDATE public.rate_limit_hits
       SET tokens = _tokens - 1, updated_at = _now
     WHERE key = _key;
    RETURN jsonb_build_object('allowed', true, 'remaining', floor(_tokens - 1), 'retry_after_ms', 0);
  END IF;

  UPDATE public.rate_limit_hits
     SET tokens = _tokens, updated_at = _now
   WHERE key = _key;

  _deficit := 1 - _tokens;
  _retry_ms := CEIL((_deficit / NULLIF(_refill_per_sec, 0)) * 1000)::INT;
  RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after_ms', COALESCE(_retry_ms, 60000));
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_rate_limit(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM public;
GRANT EXECUTE ON FUNCTION public.try_consume_rate_limit(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
