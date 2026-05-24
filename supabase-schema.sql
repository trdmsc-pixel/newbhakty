-- =========================================================================
-- BHAKTY.STUDIO SUPABASE SCHEMA & SEED MIGRATION
-- Paste this script into the Supabase SQL Editor to initialize your database.
-- =========================================================================

-- Enable UUID generation extension if not already active
create extension if exists "uuid-ossp";

-- 1. SITE SETTINGS (Key-Value State)
create table if exists site_settings (
    key text primary key,
    value text not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for site_settings
alter table site_settings enable row level security;
create policy "Allow public read access to site_settings" on site_settings for select using (true);
create policy "Allow admin write access to site_settings" on site_settings for all using (true); -- Custom password/session validation can be handled client-side or with custom auth

-- 2. NAVIGATION MENU
create table if exists navigation_menu (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    target_url text not null,
    display_order integer not null default 0
);

-- Enable RLS for navigation_menu
alter table navigation_menu enable row level security;
create policy "Allow public read access to navigation_menu" on navigation_menu for select using (true);
create policy "Allow admin write access to navigation_menu" on navigation_menu for all using (true);

-- 3. PORTFOLIO WORKS (Videos & Metadata)
create table if exists portfolio_works (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text not null,
    video_url text not null,
    high_res_video_url text,
    description text not null,
    creator text default 'bhakty.synth',
    duration text default '0:15',
    ratio text default 'landscape',
    aspect_ratio_class text default 'aspect-video md:col-span-2',
    tags text[] not null default '{}'::text[],
    display_order integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for portfolio_works
alter table portfolio_works enable row level security;
create policy "Allow public read access to portfolio_works" on portfolio_works for select using (true);
create policy "Allow admin write access to portfolio_works" on portfolio_works for all using (true);

-- 4. PRICING TIERS
create table if exists pricing_tiers (
    id uuid primary key default gen_random_uuid(),
    tier_name text not null,
    tagline text,
    price text not null,
    period text default 'month',
    popular boolean default false,
    features text[] not null default '{}'::text[],
    button_label text not null,
    turnaround text,
    revision_round text,
    glow_theme text default 'saffron',
    offer_text text default '',
    offer_text_color text default '',
    offer_bg_color text default '',
    offer_animation text default 'none',
    display_order integer not null default 0
);

-- Enable RLS for pricing_tiers
alter table pricing_tiers enable row level security;
create policy "Allow public read access to pricing_tiers" on pricing_tiers for select using (true);
create policy "Allow admin write access to pricing_tiers" on pricing_tiers for all using (true);


-- 5. INITIAL SEED DATA
-- Populate site_settings
insert into site_settings (key, value) values
('hero_badge_text', 'Synthetic Arts Studio v4.1'),
('hero_title_1', 'The Next Epoch'),
('hero_title_2', 'of Cinema.'),
('hero_title_3', 'Synthesized.'),
('hero_description', 'We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers. From prompt orchestration to temporal coherence upscaling, bhakty.studio redefines moving media.'),
('hero_cta_booking_text', 'Book Creative Spot'),
('hero_cta_work_text', 'Explore Curation'),
('hero_stat1_value', '400+'),
('hero_stat1_label', 'Synth Hours'),
('hero_stat2_value', '8K UHD'),
('hero_stat2_label', 'Upscale Target'),
('hero_stat3_value', '0%'),
('hero_stat3_label', 'Physical Camera'),
('hero_video_bg_url', 'https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4'),
('footer_copyright', '© 2026 bhakty.studio. Generative Temporal Coherence in Aesthetics.')
on conflict (key) do update set value = excluded.value;

-- Populate navigation_menu
insert into navigation_menu (label, target_url, display_order) values
('Our Work', 'work-section', 1),
('Production Tiers', 'pricing-section', 2)
on conflict do nothing;

-- Populate portfolio_works
insert into portfolio_works (title, category, video_url, high_res_video_url, description, creator, duration, ratio, aspect_ratio_class, tags, display_order) values
('Ethereal Alchemy', 'AI Commercial / Fluid Dynamics', 'https://assets.mixkit.co/videos/preview/mixkit-organic-liquid-gold-floating-fluid-bubbles-48283-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-organic-liquid-gold-floating-fluid-bubbles-48283-large.mp4', 'An AI-guided exploration of digital gold cohesion and surface tension simulation, engineered for a luxury haute couture brand''s digital storefront.', 'bhakty.synth-08', '0:15', 'landscape', 'aspect-video md:col-span-2', array['Fluid Simulation', 'Neural Render', 'Luxury'], 1),
('Hyper-Drive Synthetics', 'Sci-Fi Cinematic / Opening Title', 'https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-background-34288-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-background-34288-large.mp4', 'A generative cosmic voyage through starfields made with neural differential equations. Perfect looping backdrop representing infinite depth.', 'bhakty.core', '0:20', 'landscape', 'aspect-square md:col-span-1', array['Cosmology', 'Stable Diffusion XL', 'CineScale'], 2),
('Quantum Flow Fields', 'Creative Music Video / Motion Art', 'https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4', 'Millions of sound-reactive golden particles calculated using custom vector flow fields, rendering live AI-driven responses to progressive sub-bass frequencies.', 'bhakty.audio-reactive', '0:12', 'landscape', 'aspect-square md:col-span-1', array['Audio-Reactive', 'C4D Cinema', 'Deep-Noise'], 3),
('Neuro-Chroma City', 'Speculative Film / Concept Stage', 'https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-neon-city-street-with-cars-and-rain-41221-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-neon-city-street-with-cars-and-rain-41221-large.mp4', 'A neo-noir rainfall over virtual metropolis, using generative temporal consistency seeds. Shows rain-refractive physics on wet virtual asphalt.', 'bhakty.temporal', '0:18', 'landscape', 'aspect-video md:col-span-2', array['Sora Prototype', 'Ray-Tracing', 'Cyberpunk'], 4),
('Vector Horizon State', 'Live Stage Production / Laser Visuals', 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-31718-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-31718-large.mp4', 'Multidimensional vector coordinate lasers folding over virtual theatrical surfaces. Synthesized dynamically using localized projection AI algorithms.', 'bhakty.projection', '0:16', 'landscape', 'aspect-square md:col-span-1', array['Projection Mapping', 'Vector Synth', 'Luminous'], 5),
('Chrono-Fluid Pulse', 'Premium Identity / Brand Splash', 'https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4', 'https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4', 'An organic glassified neon core swelling rhythmically. Engineered with physical jelly dynamics to match bhakty''s visual branding aesthetic.', 'bhakty.identity', '0:15', 'landscape', 'aspect-square md:col-span-1', array['Organic Physics', '4K Video Loop', 'Jelly Core'], 6)
on conflict do nothing;

-- Populate pricing_tiers
insert into pricing_tiers (tier_name, tagline, price, period, popular, features, button_label, turnaround, revision_round, glow_theme, display_order) values
('Short-Form Creative', 'High-octane viral AI media tailored for ultimate digital retention.', '$2,450', 'month', false, array['10x AI-generated Short Reels/TikToks', 'Dynamic auto-captions & sound-design', 'High temporal consistency rendering', 'Aspect ratios: 9:16 vertical & 1:1 square', 'Source prompt setups & custom style-weights'], 'Acquire Creative Pipeline', '5 working days', '2 Rounds', 'emerald', 1),
('Full Cinematic Studio', 'The complete cinematic suite for commercials, trailers & visual epics.', '$5,800', 'project', true, array['1x High-fidelity 60-90s cinematic trailer', 'AI vector upscaling (Up to 8K resolution)', 'Premium custom audio score & SFX alignment', 'Concept art storyboards & vocal synthesizers', 'Full digital rights and 4K delivery layers', 'Interactive feedback workspace access'], 'Acquire Studio spot', '12 working days', '4 Rounds', 'saffron', 2),
('Enterprise Pipeline', 'Bespoke fine-tuned AI diffusion models and full custom pipeline setup.', '$14,500', 'setup', false, array['1x Custom style LoRA trained on brand assets', 'Up to 3 minutes of dedicated 4K cinematic footage', 'Dedicated creative visual supervisor', 'Bespoke audio composer & voice-clone profiles', 'VRAM hardware pipeline optimization advice', 'Priority project renders & instant pipeline access'], 'Acquire Enterprise access', '24 working days', 'Unlimited Revisions', 'violet', 3)
on conflict do nothing;


-- 6. MEDIA ASSETS
create table if exists media_assets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    url text not null,
    type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for media_assets
alter table media_assets enable row level security;
create policy "Allow public read access to media_assets" on media_assets for select using (true);
create policy "Allow admin write access to media_assets" on media_assets for all using (true);

