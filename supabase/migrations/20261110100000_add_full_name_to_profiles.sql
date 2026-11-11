-- ========================================================================
-- MIGRATION: Add full_name compatibility column to public.profiles
-- Prevents 400 Bad Request errors when clients query profiles(full_name)
-- ========================================================================

-- 1. Add full_name column to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Backfill existing full_name from display_name
UPDATE public.profiles 
SET full_name = display_name 
WHERE full_name IS NULL AND display_name IS NOT NULL;

-- 3. Trigger to keep display_name and full_name automatically in sync
CREATE OR REPLACE FUNCTION public.sync_profile_names()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name IS NULL AND NEW.display_name IS NOT NULL THEN
        NEW.full_name := NEW.display_name;
    ELSIF NEW.display_name IS NULL AND NEW.full_name IS NOT NULL THEN
        NEW.display_name := NEW.full_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_profile_names ON public.profiles;
CREATE TRIGGER tr_sync_profile_names
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_names();

