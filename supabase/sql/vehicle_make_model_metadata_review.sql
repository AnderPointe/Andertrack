-- REVIEW-ONLY migration — DO NOT run until preview and maintenance window approved.
-- Adds optional manufacturer metadata to existing inventory. No auth/RLS grants or
-- existing dispatch assignments are modified. RLS remains as-is.
BEGIN;
ALTER TABLE public.at_vehicles ADD COLUMN IF NOT EXISTS make text;
ALTER TABLE public.at_vehicles ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.at_vehicles ADD COLUMN IF NOT EXISTS model_year integer;
ALTER TABLE public.at_vehicles ADD COLUMN IF NOT EXISTS paint_hex text;
ALTER TABLE public.at_vehicles DROP CONSTRAINT IF EXISTS at_vehicles_model_year_range;
ALTER TABLE public.at_vehicles ADD CONSTRAINT at_vehicles_model_year_range
  CHECK (model_year IS NULL OR model_year BETWEEN 1980 AND 2100);
ALTER TABLE public.at_vehicles DROP CONSTRAINT IF EXISTS at_vehicles_paint_hex_format;
ALTER TABLE public.at_vehicles ADD CONSTRAINT at_vehicles_paint_hex_format
  CHECK (paint_hex IS NULL OR paint_hex ~ '^#[[:xdigit:]]{6}$');
COMMENT ON COLUMN public.at_vehicles.make IS 'Manufacturer name entered from verified fleet inventory. Optional.';
COMMENT ON COLUMN public.at_vehicles.model IS 'Vehicle model entered from verified fleet inventory. Optional.';
COMMENT ON COLUMN public.at_vehicles.model_year IS 'Manufacturer model year. Optional, not decoded from VIN.';
COMMENT ON COLUMN public.at_vehicles.paint_hex IS 'Preview color in #RRGGBB notation, not a verified paint-code.';
COMMIT;
