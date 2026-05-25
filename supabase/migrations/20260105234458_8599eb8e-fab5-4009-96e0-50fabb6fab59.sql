-- Create storage bucket for company assets (logos, banners, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow users to update their own files
CREATE POLICY "Users can update own company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);