import { SITE_URL } from '@/lib/site';

export default function sitemap() {
  const lastModified = new Date();
  const routes = ['', '/play', '/lobby', '/tournaments', '/leaderboard', '/login', '/register'];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}
