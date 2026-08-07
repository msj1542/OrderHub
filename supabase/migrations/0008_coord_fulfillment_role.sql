-- Add combined coordinator + fulfillment role
INSERT INTO public.roles (role_code, display_name, is_internal) VALUES
  ('coord_fulfillment', 'Coordinator + Fulfillment', true)
ON CONFLICT (role_code) DO NOTHING;
