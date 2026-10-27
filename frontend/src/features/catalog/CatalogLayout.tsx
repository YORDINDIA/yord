'use client';

import type { ReactNode } from 'react';
import { Container } from '@/features/ui/Container';
import { ActiveFilters } from './ActiveFilters';
import { FilterDrawer } from './FilterDrawer';
import { FilterPanel, type FacetData } from './FilterPanel';
import { SortMenu } from './SortMenu';
import { useCatalogFiltersOptional } from './CatalogFilterContext';

interface CatalogLayoutProps {
  title: string;
  /** SSR result count; the live count from the filter context wins once hydrated. */
  count: number;
  description?: string;
  /** Above the title, e.g. a breadcrumb. */
  before?: ReactNode;
  /** With facets: side panel (lg+), drawer (below), sort and active filters. */
  facets?: FacetData;
  children: ReactNode;
}

/**
 * The listing page frame shared by `/products` and the collection pages.
 *
 * The title is one line in the Stagelight display face with the result count
 * set beside it as a muted numeral. With facets, the filters sit in a sticky
 * side panel from `lg` and in a bottom sheet below it, beside the sort, in one
 * short sticky bar. Without facets the grid owns its own sort bar.
 *
 * Client-side because the count, the active-facet badge and the controls all
 * read `CatalogFilterProvider`. The route itself stays statically rendered.
 */
export function CatalogLayout({ title, count, description, before, facets, children }: CatalogLayoutProps) {
  const live = useCatalogFiltersOptional();
  const shownCount = live?.count ?? count;
  const activeCount = live?.activeCount ?? 0;

  return (
    <div className="min-h-screen bg-surface-page">
      <Container className="pt-28 pb-20">
        <header className="mb-8 lg:mb-10">
          {before}
          <h1 className="font-display-alt text-[clamp(2.4rem,5.2vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.01em] text-text-primary">
            {title}
            <span className="ml-3 align-top font-body text-[0.3em] font-semibold tracking-normal text-text-muted tabular-nums">
              {shownCount}
            </span>
          </h1>
          {description && <p className="mt-4 max-w-2xl font-body text-base text-text-muted">{description}</p>}
        </header>

        {facets ? (
          <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-12">
            <aside
              aria-label="Filters"
              className="hidden lg:block lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-2 lg:pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FilterPanel artists={facets.artists} types={facets.types} sizes={facets.sizes} />
            </aside>

            <div className="min-w-0">
              {/* One short bar: filters (below lg) and sort. Sticky so both stay
                  in reach while the grid scrolls; the old bar stacked three rows
                  of pills and covered most of a phone screen. */}
              <div className="sticky top-20 z-30 -mx-6 mb-5 flex items-center justify-between gap-4 bg-surface-page px-6 py-3 lg:static lg:mx-0 lg:mb-6 lg:px-0 lg:py-0">
                <FilterDrawer count={shownCount} activeCount={activeCount}>
                  <FilterPanel artists={facets.artists} types={facets.types} sizes={facets.sizes} />
                </FilterDrawer>
                <div className="hidden min-w-0 lg:block">
                  <ActiveFilters artists={facets.artists} />
                </div>
                <SortMenu />
              </div>
              <div className="mb-6 lg:hidden">
                <ActiveFilters artists={facets.artists} />
              </div>
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </Container>
    </div>
  );
}
