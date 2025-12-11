import Link from 'next/link'
import { prisma } from '@/lib/db'

export default async function BlogIndexPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  })

  return (
    <main className="bg-white dark:bg-black">
      <section className="px-6 pb-10 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Automation, AI, and operator playbooks.
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Short, tactical posts on building reliable automations and
            AI-assisted operations.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No posts yet. Add some entries to <code>BlogPost</code> in your
            database.
          </p>
        ) : (
          <div className="space-y-6">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/marketing/blog/${post.slug}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h2 className="text-lg font-semibold">{post.title}</h2>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {post.excerpt}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
                  {post.publishedAt && (
                    <span>{post.publishedAt.toLocaleDateString()}</span>
                  )}
                  {post.tags && post.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {post.tags.map((tag: any) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-900"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
