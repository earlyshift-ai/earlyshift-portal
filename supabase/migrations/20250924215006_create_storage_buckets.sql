-- =============================================
-- STORAGE BUCKETS FOR COMPANY ASSETS
-- =============================================

-- Insert storage buckets for tenant assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('tenant-logos', 'tenant-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('tenant-assets', 'tenant-assets', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

-- =============================================
-- STORAGE POLICIES FOR TENANT LOGOS
-- =============================================

-- Policy: Anyone can view tenant logos (public bucket)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tenant-logos' );

-- Policy: Only authenticated users can upload to their tenant's folder
CREATE POLICY "Authenticated users can upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

-- Policy: Only admins can update/delete tenant logos
CREATE POLICY "Admins can update tenant logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

CREATE POLICY "Admins can delete tenant logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

-- =============================================
-- STORAGE POLICIES FOR TENANT ASSETS
-- =============================================

-- Policy: Anyone can view tenant assets (public bucket)
CREATE POLICY "Public Asset Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tenant-assets' );

-- Policy: Only authenticated users can upload to their tenant's folder
CREATE POLICY "Authenticated users can upload tenant assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

-- Policy: Only admins can update/delete tenant assets
CREATE POLICY "Admins can update tenant assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

CREATE POLICY "Admins can delete tenant assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT t.slug FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.status = 'active'
  )
);

-- =============================================
-- HELPER FUNCTIONS FOR LOGO MANAGEMENT
-- =============================================

-- Function to update tenant logo URL after upload
CREATE OR REPLACE FUNCTION public.update_tenant_logo(
  p_tenant_id UUID,
  p_logo_filename TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid UUID := auth.uid();
  tenant_slug TEXT;
  logo_url TEXT;
BEGIN
  -- Check if user is admin/owner of this tenant
  IF NOT auth.user_is_admin(p_tenant_id, user_uuid) THEN
    RAISE EXCEPTION 'Only admins can update tenant logos';
  END IF;

  -- Get tenant slug
  SELECT slug INTO tenant_slug FROM public.tenants WHERE id = p_tenant_id;
  
  IF tenant_slug IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Construct the logo URL
  logo_url := format('https://%s/storage/v1/object/public/tenant-logos/%s/%s', 
                     current_setting('app.settings.supabase_url', true), 
                     tenant_slug, 
                     p_logo_filename);

  -- Update the tenant logo_url
  UPDATE public.tenants 
  SET logo_url = logo_url, updated_at = NOW()
  WHERE id = p_tenant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete old logo when updating
CREATE OR REPLACE FUNCTION public.delete_old_tenant_logo(
  p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid UUID := auth.uid();
  tenant_slug TEXT;
  old_logo_path TEXT;
BEGIN
  -- Check if user is admin/owner of this tenant
  IF NOT auth.user_is_admin(p_tenant_id, user_uuid) THEN
    RAISE EXCEPTION 'Only admins can delete tenant logos';
  END IF;

  -- Get tenant info
  SELECT slug, logo_url INTO tenant_slug, old_logo_path
  FROM public.tenants 
  WHERE id = p_tenant_id;
  
  IF tenant_slug IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- If there's an existing logo, try to delete it from storage
  IF old_logo_path IS NOT NULL AND old_logo_path LIKE '%tenant-logos%' THEN
    -- Extract filename from URL
    -- This will be handled by the application layer since we can't directly call storage APIs from SQL
    NULL; -- Placeholder for storage deletion
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_tenant_logo TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_tenant_logo TO authenticated;
