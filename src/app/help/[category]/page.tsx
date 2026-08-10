import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HELP_CATEGORIES, getCategoryById, getCategoryIndex } from "@/lib/help-data";
import { HelpScreenshot } from "@/components/help/help-screenshot";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategoryById(category);
  if (!cat) return { title: "Help Center" };
  return {
    title: `${cat.title} — Evernaro Help Center`,
    description: cat.description,
  };
}

export default async function HelpCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = getCategoryById(category);
  if (!cat) notFound();

  const idx = getCategoryIndex(category);
  const prev = idx > 0 ? HELP_CATEGORIES[idx - 1] : null;
  const next = idx < HELP_CATEGORIES.length - 1 ? HELP_CATEGORIES[idx + 1] : null;

  return (
    <article className="flex flex-col gap-8">
      <div className="border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-sm text-text-muted">
          <Link href="/help" className="hover:text-primary hover:underline">
            Help Center
          </Link>
          <span>/</span>
          <span>{cat.title}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text">{cat.title}</h1>
        <p className="mt-2 text-base text-text-secondary">{cat.description}</p>
        <p className="mt-2 text-xs text-text-muted">{cat.readingTime} read</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">In this guide</p>
        <ul className="flex flex-col gap-1.5">
          {cat.sections.map((section) => (
            <li key={section.title}>
              <a
                href={`#${section.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                className="text-sm text-text-secondary hover:text-primary hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-10">
        {cat.sections.map((section) => {
          const anchor = section.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          return (
            <section key={section.title} id={anchor} className="scroll-mt-24">
              <h2 className="mb-4 text-xl font-bold text-text">{section.title}</h2>
              {section.screenshot && (
                <HelpScreenshot
                  src={`/help/screenshots/${section.screenshot}`}
                  alt={section.title}
                  caption={section.screenshotCaption}
                />
              )}
              <div className="help-article-content text-text-secondary">
                {section.content}
              </div>
            </section>
          );
        })}
      </div>

      {cat.related.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">Related articles</p>
          <div className="flex flex-wrap gap-3">
            {cat.related.map((relatedId) => {
              const related = getCategoryById(relatedId);
              if (!related) return null;
              return (
                <Link
                  key={relatedId}
                  href={`/help/${relatedId}`}
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:border-primary hover:text-primary"
                >
                  {related.title}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 border-t border-border pt-6 sm:flex-row">
        {prev ? (
          <Link
            href={`/help/${prev.id}`}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium">Previous</span>
            <span className="text-text-muted">— {prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/help/${next.id}`}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text"
          >
            <span className="font-medium">Next</span>
            <span className="text-text-muted">— {next.title}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}
