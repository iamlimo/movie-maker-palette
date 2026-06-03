
-- Ensure missing roles exist
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Full system access'),
  ('admin', 'Administrative access'),
  ('sales', 'Sales and marketing operations'),
  ('accounting', 'Financial operations'),
  ('support', 'Customer support and tickets'),
  ('creator', 'Content creator / producer')
ON CONFLICT (name) DO NOTHING;

-- Seed permission catalog grouped by module
INSERT INTO public.permissions (name, description, module) VALUES
  ('user.view',                'View users',                            'User Management'),
  ('user.create',              'Create users',                          'User Management'),
  ('user.edit',                'Edit users',                            'User Management'),
  ('user.delete',              'Delete users',                          'User Management'),
  ('user.suspend',             'Suspend users',                         'User Management'),
  ('role.manage',              'Manage roles and permissions',          'User Management'),

  ('content.movie.create',     'Create movies',                         'Platform Management'),
  ('content.movie.edit',       'Edit movies',                           'Platform Management'),
  ('content.movie.delete',     'Delete movies',                         'Platform Management'),
  ('content.tv.create',        'Create TV shows',                       'Platform Management'),
  ('content.tv.edit',          'Edit TV shows',                         'Platform Management'),
  ('content.tv.delete',        'Delete TV shows',                       'Platform Management'),
  ('content.publish',          'Publish content',                       'Platform Management'),
  ('homepage.section.manage',  'Manage homepage sections',              'Platform Management'),
  ('homepage.hero.manage',     'Manage hero slider',                    'Platform Management'),
  ('homepage.banner.manage',   'Manage banners and CTAs',               'Platform Management'),

  ('wallet.view',              'View wallets',                          'Financial Operations'),
  ('wallet.adjust',            'Adjust wallet balances',                'Financial Operations'),
  ('wallet.audit',             'View wallet audit logs',                'Financial Operations'),
  ('rental.manage',            'Manage rentals',                        'Financial Operations'),
  ('referral.manage',          'Manage referral codes',                 'Financial Operations'),
  ('payout.manage',            'Manage payouts',                        'Financial Operations'),
  ('finance.audit',            'View finance audit trail',              'Financial Operations'),

  ('support.ticket.view',      'View support tickets',                  'Support & Compliance'),
  ('support.ticket.respond',   'Respond to tickets',                    'Support & Compliance'),
  ('careers.job.manage',       'Manage job listings',                   'Support & Compliance'),
  ('careers.application.view', 'View job applications',                 'Support & Compliance'),
  ('notification.send',        'Send push notifications',               'Support & Compliance'),
  ('audit.view',               'View compliance/audit logs',            'Support & Compliance'),
  ('settings.manage',          'Manage system settings',                'Support & Compliance')
ON CONFLICT (name) DO NOTHING;

-- Add unique constraint on role_permissions if missing
DO $$ BEGIN
  ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Seed default mappings: super_admin -> all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- admin: everything except role.manage / audit.view / settings.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.name NOT IN ('role.manage','audit.view','settings.manage')
ON CONFLICT DO NOTHING;

-- accounting
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'accounting'
  AND p.name IN ('user.view','wallet.view','wallet.adjust','wallet.audit','rental.manage','referral.manage','payout.manage','finance.audit')
ON CONFLICT DO NOTHING;

-- sales
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'sales'
  AND p.name IN ('user.view','homepage.section.manage','homepage.hero.manage','homepage.banner.manage','referral.manage','rental.manage')
ON CONFLICT DO NOTHING;

-- support
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'support'
  AND p.name IN ('user.view','support.ticket.view','support.ticket.respond','careers.job.manage','careers.application.view')
ON CONFLICT DO NOTHING;

-- creator
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'creator'
  AND p.name IN ('content.movie.create','content.movie.edit','content.tv.create','content.tv.edit')
ON CONFLICT DO NOTHING;
