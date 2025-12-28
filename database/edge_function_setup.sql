-- ============================================
-- EDGE FUNCTION SETUP FOR BACKGROUND PROCESSING
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add new columns to inquiries table
ALTER TABLE inquiries
ADD COLUMN IF NOT EXISTS form_data_json jsonb,
ADD COLUMN IF NOT EXISTS approval_token text;

-- 2. Create index on status for efficient queries
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

-- 3. Create storage bucket for inquiry files (tech riders)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-files', 'inquiry-files', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policy - allow service role to upload/read
CREATE POLICY "Service role can manage inquiry files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'inquiry-files')
WITH CHECK (bucket_id = 'inquiry-files');

-- 5. Enable pg_net extension for HTTP calls (needed to invoke Edge Function)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 6. Create function to invoke Edge Function when inquiry is inserted
CREATE OR REPLACE FUNCTION invoke_process_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Only trigger for pending_quote status
  IF NEW.status = 'pending_quote' THEN
    -- Get your Supabase project URL (replace with your actual values or use vault)
    edge_function_url := 'https://rgbpwfoeakumchnovbkj.supabase.co/functions/v1/process-inquiry';

    -- Call the Edge Function asynchronously
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('inquiry_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger on inquiries table
DROP TRIGGER IF EXISTS trigger_process_inquiry ON inquiries;
CREATE TRIGGER trigger_process_inquiry
  AFTER INSERT ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION invoke_process_inquiry();

-- ============================================
-- IMPORTANT: Set your service role key in Supabase
-- Go to: Project Settings > Database > Connection String
-- Run: ALTER DATABASE postgres SET "app.settings.service_role_key" = 'your-service-role-key';
-- ============================================
