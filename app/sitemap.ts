import type { MetadataRoute } from 'next'

const baseUrl = 'https://skillify.tech'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If you want dynamic blog URLs, you can load from Prisma here.
  // const posts = await prisma.blogPost.findMany({ where: { published: true } })

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/marketing',
    '/marketing/features',
    '/marketing/solutions',
    '/marketing/pricing',
    '/marketing/demo',
    '/marketing/resources',
    '/marketing/blog',
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' || path === '/marketing' ? 1 : 0.7,
  }))

  return staticRoutes
}
