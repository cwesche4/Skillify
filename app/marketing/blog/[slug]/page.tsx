import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

type BlogPostPageProps = {
  params: { slug: string }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
  })

  if (!post || !post.published) {
    notFound()
  }

  return (
    <main className="bg-white dark:bg-black">
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
          Blog
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {post.publishedAt && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            {post.publishedAt.toLocaleDateString()}
          </p>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-zinc-800 dark:text-zinc-100">
          {/* For now, treat `content` as markdown-ish plain text. Later you can integrate a markdown renderer. */}
          {post.content.split('\n\n').map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </div>
      </article>
    </main>
  )
}
