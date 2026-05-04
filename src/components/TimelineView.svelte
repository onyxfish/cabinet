<script lang="ts">
  import { onMount } from 'svelte';
  import TimelineCard from './TimelineCard.svelte';

  interface Work {
    id: string;
    title: string;
    artist: string;
    yearCreated: string;
    sortYear: number;
    images: { display: string[] };
  }

  interface Props {
    works: Work[];
  }

  let { works }: Props = $props();

  const byDecade: [string, Work[]][] = $derived((() => {
    const sorted = [...works].sort((a, b) => a.sortYear - b.sortYear);
    const workMap = new Map<string, Work[]>();
    const undated: Work[] = [];
    for (const w of sorted) {
      if (!w.sortYear) { undated.push(w); continue; }
      const key = `${Math.floor(w.sortYear / 10) * 10}s`;
      if (!workMap.has(key)) workMap.set(key, []);
      workMap.get(key)!.push(w);
    }

    // Fill every decade between min and max, even if empty
    const datedWorks = sorted.filter(w => w.sortYear > 0);
    const entries: [string, Work[]][] = [];
    if (datedWorks.length > 0) {
      const minDecade = Math.floor(datedWorks[0].sortYear / 10) * 10;
      const maxDecade = Math.floor(datedWorks[datedWorks.length - 1].sortYear / 10) * 10;
      for (let d = minDecade; d <= maxDecade; d += 10) {
        const key = `${d}s`;
        entries.push([key, workMap.get(key) ?? []]);
      }
    }

    if (undated.length > 0) entries.push(['Undated', undated]);
    return entries;
  })());

  const decades = $derived(byDecade.map(([d]) => d));
  const populatedDecades = $derived(byDecade.filter(([, ws]) => ws.length > 0).map(([d]) => d));

  let activeDecade = $state('');
  let sectionRefs: Record<string, HTMLElement | undefined> = {};

  onMount(() => {
    // Set initial active decade
    if (populatedDecades.length > 0) activeDecade = populatedDecades[0];

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const d = (e.target as HTMLElement).dataset.decade ?? '';
            if (populatedDecades.includes(d)) activeDecade = d;
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );

    for (const el of Object.values(sectionRefs)) {
      if (el) obs.observe(el);
    }

    return () => obs.disconnect();
  });

  function jumpTo(decade: string) {
    const el = sectionRefs[decade];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }
</script>

<div class="timeline-root">
  <!-- Sticky decade jump nav -->
  <div class="jump-nav">
    {#each populatedDecades as decade (decade)}
      <button
        class="jump-btn"
        class:active={activeDecade === decade}
        onclick={() => jumpTo(decade)}
      >
        {decade}
      </button>
    {/each}
  </div>

  <!-- Main content -->
  <div class="sections">
    {#each byDecade as [decade, decadeWorks] (decade)}
      <div
        class="decade-section"
        data-decade={decade}
        bind:this={sectionRefs[decade]}
      >
        <div class="decade-header">
          <span class="decade-label" class:undated={decade === 'Undated'}>{decade}</span>
          <div class="decade-rule"></div>
          <span class="decade-count">
            {decadeWorks.length} work{decadeWorks.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div class="decade-grid">
          {#each decadeWorks as work (work.id)}
            <TimelineCard {work} onSelect={() => window.location.href = `/works/${work.id}`} />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .timeline-root {
    display: flex;
    position: relative;
  }

  .jump-nav {
    position: sticky;
    top: var(--header-h);
    align-self: flex-start;
    width: 80px;
    flex-shrink: 0;
    padding: 32px 0 32px 20px;
    border-right: 1px solid var(--border);
    max-height: calc(100vh - var(--header-h));
    overflow-y: auto;
  }

  .jump-btn {
    display: block;
    width: 100%;
    text-align: left;
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 5px 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-faint);
    font-weight: 300;
    transition: color 0.15s;
  }

  .jump-btn.active {
    color: var(--accent);
    font-weight: 500;
  }

  .jump-btn:hover:not(.active) {
    color: var(--text-dim);
  }

  .sections {
    flex: 1;
    padding: 32px 40px;
    max-width: 960px;
  }

  .decade-section {
    margin-bottom: 64px;
  }

  .decade-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
  }

  .decade-label {
    font-family: var(--serif);
    font-size: 44px;
    font-weight: 300;
    color: var(--border);
    line-height: 1;
    flex-shrink: 0;
    letter-spacing: -0.03em;
  }

  .decade-label.undated {
    font-size: 24px;
    font-style: italic;
    letter-spacing: 0;
  }

  .decade-rule {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .decade-count {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .decade-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 3px;
  }

  @media (max-width: 768px) {
    .jump-nav { display: none; }
    .sections { padding: 24px 20px; }
    .decade-label { font-size: 32px; }
  }
</style>
