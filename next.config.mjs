/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Dev-only: seeded demo dog photos come from Unsplash.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Real user uploads (dog photos, shelter logos, foster avatars) live
      // in Supabase Storage. `*.supabase.co` covers projects in all regions.
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};

export default nextConfig;
