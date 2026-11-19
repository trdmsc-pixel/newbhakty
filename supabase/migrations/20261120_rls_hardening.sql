-- =========================================================================
-- THE CHANTING STUDIO (thechantingstudio.in) - RLS HARDENING MIGRATION
-- Migration Date: 2026-11-20
-- Purpose:
--   1. Secure all content tables so public anon key can only SELECT.
--   2. Restrict INSERT / UPDATE / DELETE to authenticated users (auth.role() = 'authenticated').
--   3. Allow public visitors to INSERT into bookings, analytics_events, and visitor_locations.
--   4. Restrict SELECT / UPDATE / DELETE on bookings and client records to authenticated users.
-- =========================================================================

-- Helper macro to ensure tables have RLS enabled
-- ----------------------------------------------------
-- 1. CONTENT TABLES: Public SELECT, Authenticated Full Access
-- ----------------------------------------------------

DO $$
DECLARE
    tbl text;
    content_tables text[] := ARRAY[
        'site_settings',
        'navigation_menu',
        'portfolio_works',
        'portfolio_tabs',
        'pricing_tiers',
        'media_assets',
        'brand_logos',
        'testimonials'
    ];
BEGIN
    FOREACH tbl IN ARRAY content_tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Drop existing permissive policies
            EXECUTE format('DROP POLICY IF EXISTS "Allow public read access to %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow admin write access to %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Read Only" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I;', tbl);

            -- Create hardened policies
            EXECUTE format('CREATE POLICY "Public Read Only" ON public.%I FOR SELECT USING (true);', tbl);
            EXECUTE format('CREATE POLICY "Admin Full Access" ON public.%I FOR ALL TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');', tbl);
        END IF;
    END LOOP;
END $$;


-- ----------------------------------------------------
-- 2. INQUIRY / BOOKINGS TABLE
-- ----------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings') THEN
        ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow public insert to bookings" ON public.bookings;
        DROP POLICY IF EXISTS "Allow admin access to bookings" ON public.bookings;
        DROP POLICY IF EXISTS "Public Insert Only" ON public.bookings;
        DROP POLICY IF EXISTS "Admin Bookings Full Access" ON public.bookings;

        -- Public can insert new inquiries
        CREATE POLICY "Public Insert Only" ON public.bookings 
            FOR INSERT 
            WITH CHECK (true);

        -- Only authenticated users (studio admin) can read or modify bookings
        CREATE POLICY "Admin Bookings Full Access" ON public.bookings 
            FOR ALL 
            TO authenticated 
            USING (auth.role() = 'authenticated') 
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;


-- ----------------------------------------------------
-- 3. ANALYTICS & VISITOR LOGS
-- ----------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_events') THEN
        ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public Insert Analytics" ON public.analytics_events;
        DROP POLICY IF EXISTS "Admin Analytics Access" ON public.analytics_events;

        CREATE POLICY "Public Insert Analytics" ON public.analytics_events 
            FOR INSERT 
            WITH CHECK (true);

        CREATE POLICY "Admin Analytics Access" ON public.analytics_events 
            FOR ALL 
            TO authenticated 
            USING (auth.role() = 'authenticated') 
            WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visitor_locations') THEN
        ALTER TABLE public.visitor_locations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public Insert Visitor Locations" ON public.visitor_locations;
        DROP POLICY IF EXISTS "Admin Visitor Locations Access" ON public.visitor_locations;

        CREATE POLICY "Public Insert Visitor Locations" ON public.visitor_locations 
            FOR INSERT 
            WITH CHECK (true);

        CREATE POLICY "Admin Visitor Locations Access" ON public.visitor_locations 
            FOR ALL 
            TO authenticated 
            USING (auth.role() = 'authenticated') 
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;


-- ----------------------------------------------------
-- 4. CHAT SESSIONS & MESSAGES (if active in database)
-- ----------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
        ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public Chat Sessions Insert" ON public.chat_sessions;
        DROP POLICY IF EXISTS "Public Chat Sessions Select" ON public.chat_sessions;
        DROP POLICY IF EXISTS "Admin Chat Sessions All" ON public.chat_sessions;

        CREATE POLICY "Public Chat Sessions Insert" ON public.chat_sessions FOR INSERT WITH CHECK (true);
        CREATE POLICY "Public Chat Sessions Select" ON public.chat_sessions FOR SELECT USING (true);
        CREATE POLICY "Admin Chat Sessions All" ON public.chat_sessions FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
        ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public Chat Messages Insert" ON public.chat_messages;
        DROP POLICY IF EXISTS "Public Chat Messages Select" ON public.chat_messages;
        DROP POLICY IF EXISTS "Admin Chat Messages All" ON public.chat_messages;

        CREATE POLICY "Public Chat Messages Insert" ON public.chat_messages FOR INSERT WITH CHECK (true);
        CREATE POLICY "Public Chat Messages Select" ON public.chat_messages FOR SELECT USING (true);
        CREATE POLICY "Admin Chat Messages All" ON public.chat_messages FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
