-- Migra somente as cores antigas padrão; marcas personalizadas permanecem intactas.
ALTER TABLE public.settings ALTER COLUMN primary_color SET DEFAULT '#f5f5f5';
ALTER TABLE public.settings ALTER COLUMN accent_color SET DEFAULT '#a3a3a3';
UPDATE public.settings
SET primary_color = '#f5f5f5', accent_color = '#a3a3a3'
WHERE lower(coalesce(primary_color, '')) IN ('#4a86c8', '#1e3a8a', '#d97706')
  AND lower(coalesce(accent_color, '')) IN ('#6ba3d6', '#3b82f6', '#f59e0b');
