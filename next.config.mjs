/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Dev-only: seeded demo dog photos come from Unsplash. Real user uploads
      // will go through Supabase Storage (Roadmap Phase 1 Step 8), at which
      // point *.supabase.co will also need whitelisting here.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
