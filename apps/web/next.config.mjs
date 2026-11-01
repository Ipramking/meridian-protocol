/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: isGithubPages ? '/meridian-protocol' : '',
  assetPrefix: isGithubPages ? '/meridian-protocol/' : '',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@meridian-protocol/sdk'],
};

export default nextConfig;
