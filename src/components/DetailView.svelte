<script lang="ts">
  import { onMount } from 'svelte';
  import AccordionSection from './AccordionSection.svelte';
  import TimelineCard from './TimelineCard.svelte';

  interface Dimensions {
    imageH?: number | null;
    imageW?: number | null;
    supportH?: number | null;
    supportW?: number | null;
  }

  interface Work {
    id: string;
    title: string;
    titleAlt?: string | null;
    titleTrans?: string | null;
    artist: string;
    artistLife?: string | null;
    artistNationality?: string | null;
    after: string[];
    medium: string[];
    support?: string | null;
    marks: string[];
    yearCreated: string;
    yearPrinted?: string | null;
    yearAcquired?: number | null;
    handSig: boolean;
    plateSig: boolean;
    dimensions?: Dimensions | null;
    catalogue?: string | null;
    catNum?: string | null;
    catPage?: number | null;
    images: {
      display: { thumb: string; display: string; zoom: string }[];
      recto: { thumb: string; display: string; zoom: string }[];
      verso: { thumb: string; display: string; zoom: string }[];
      plateSig: { thumb: string; display: string; zoom: string }[];
      handSig: { thumb: string; display: string; zoom: string }[];
      watermark: { thumb: string; display: string; zoom: string }[];
      other: { thumb: string; display: string; zoom: string }[];
    };
  }

  interface RelatedWork {
    id: string;
    title: string;
    artist: string;
    yearCreated: string;
    images: { display: { thumb: string; display: string; zoom: string }[] };
  }

  interface Props {
    work: Work;
    relatedWorks?: RelatedWork[];
  }

  let { work, relatedWorks = [] }: Props = $props();

  // Build available image views
  type ImageSize = { thumb: string; display: string; zoom: string };
  type ImageView = { key: string; label: string; images: ImageSize[] };
  const imageViews: ImageView[] = $derived((() => {
    const views: ImageView[] = [];
    if (work.images.display.length > 0)   views.push({ key: 'display',   label: 'Image',      images: work.images.display });

    // Skip recto if it duplicates the display image
    const rectoIsDupe = work.images.recto.length > 0 &&
      work.images.display.length > 0 &&
      work.images.recto[0].display === work.images.display[0].display;
    if (work.images.recto.length > 0 && !rectoIsDupe) views.push({ key: 'recto', label: 'Recto', images: work.images.recto });

    if (work.images.verso.length > 0)     views.push({ key: 'verso',     label: 'Verso',      images: work.images.verso });
    if (work.images.plateSig.length > 0)  views.push({ key: 'plateSig',  label: 'Plate Sig.', images: work.images.plateSig });
    if (work.images.handSig.length > 0)   views.push({ key: 'handSig',   label: 'Hand Sig.',  images: work.images.handSig });
    if (work.images.watermark.length > 0) views.push({ key: 'watermark', label: 'Watermark',  images: work.images.watermark });
    return views;
  })());

  let activeViewKey = $state(imageViews[0]?.key ?? 'display');
  let activeImageIndex = $state(0);
  let lightboxOpen = $state(false);

  const activeView: ImageView | undefined = $derived(
    imageViews.find(v => v.key === activeViewKey) ?? imageViews[0]
  );
  const activeImage: ImageSize | undefined = $derived(activeView?.images[activeImageIndex]);
  const hasImages: boolean = $derived(imageViews.length > 0);

  function setView(key: string) {
    activeViewKey = key;
    activeImageIndex = 0;
  }

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) lightboxOpen = false;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  $effect(() => {
    document.body.classList.toggle('modal-open', lightboxOpen);
  });

  const displayTitle = $derived(work.title.replace(/^[""]|[""]$/g, ''));

  function fmtDim(h?: number | null, w?: number | null): string | null {
    if (!h && !w) return null;
    return `${w ?? '?'} × ${h ?? '?'} in.`;
  }

  const imageDim = $derived(fmtDim(work.dimensions?.imageH, work.dimensions?.imageW));
  const supportDim = $derived(fmtDim(work.dimensions?.supportH, work.dimensions?.supportW));
  const hasSigMarks = $derived(work.handSig || work.plateSig || work.marks.length > 0);
  const hasCatalogue = $derived(!!(work.catalogue || work.catNum));
</script>

<div>
  <!-- Back bar -->
  <div class="back-bar">
    <a href="/" class="back-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <line x1="13" y1="8" x2="3" y2="8" /><polyline points="7,4 3,8 7,12" />
      </svg>
      Collection
    </a>
  </div>

  <!-- Two-column layout -->
  <div class="detail-grid">
    <!-- Left: Image -->
    <div class="image-col">
      {#if hasImages}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <div
          class="main-image-wrap"
          onclick={() => { if (activeImage) lightboxOpen = true; }}
          style="cursor: {activeImage ? 'zoom-in' : 'default'}"
        >
          {#if activeImage}
            <img src={activeImage.display} alt={displayTitle} class="main-image" />
            <span class="enlarge-hint">Click to enlarge</span>
          {:else}
            <div class="img-ph main-ph">
              <div class="img-ph-inner">
                <span class="img-ph-artist">{work.artist}</span>
                <span class="img-ph-title">{displayTitle}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Thumbnail strip for multi-image views -->
        {#if (activeView?.images.length ?? 0) > 1}
          <div class="multi-thumbs">
            {#each (activeView?.images ?? []) as img, i (i)}
              <button
                class="multi-thumb"
                class:active={activeImageIndex === i}
                onclick={() => activeImageIndex = i}
              >
                <img src={img.thumb} alt="View {i + 1}" />
              </button>
            {/each}
          </div>
        {/if}

        <!-- View switcher -->
        {#if imageViews.length > 1}
          <div class="view-switcher">
            {#each imageViews as view (view.key)}
              <button
                class="view-btn"
                class:active={activeViewKey === view.key}
                onclick={() => setView(view.key)}
              >
                {view.label}
              </button>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="img-ph main-ph">
          <div class="img-ph-inner">
            <span class="img-ph-artist">{work.artist}</span>
            <span class="img-ph-title">{displayTitle}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right: Metadata panel -->
    <div class="detail-meta-col">
      <!-- Title -->
      <div class="title-block">
        <h1 class="work-title">{displayTitle}</h1>
        {#if work.titleAlt}
          <div class="work-title-alt">{work.titleAlt}</div>
        {/if}
        {#if work.titleTrans}
          <div class="work-title-trans">{work.titleTrans}</div>
        {/if}
      </div>

      <!-- Artist -->
      <div class="artist-block">
        <div class="meta-label">Artist</div>
        <div class="artist-name">{work.artist}</div>
        {#if work.artistNationality}
          <div class="artist-life">{work.artistNationality}</div>
        {/if}
        {#if work.artistLife}
          <div class="artist-life">{work.artistLife}</div>
        {/if}
      </div>

      {#if work.after.length > 0}
        <div class="artist-block">
          <div class="meta-label">After</div>
          <div class="artist-name">{work.after.join(', ')}</div>
        </div>
      {/if}

      <div class="divider"></div>

      <!-- Core metadata -->
      <div class="meta-stack">
        <div class="meta-row">
          <div class="meta-label">Date</div>
          <div class="meta-value">{work.yearCreated}</div>
          {#if work.yearPrinted && work.yearPrinted !== work.yearCreated && work.yearPrinted !== 'N/A'}
            <div class="artist-life">Printed {work.yearPrinted}</div>
          {/if}
        </div>

        {#if work.medium.length > 0}
          <div class="meta-row">
            <div class="meta-label">Medium</div>
            <div class="meta-value">{work.medium.join(' and ')}</div>
          </div>
        {/if}

        {#if work.support}
          <div class="meta-row">
            <div class="meta-label">Support</div>
            <div class="meta-value">{work.support}</div>
          </div>
        {/if}

        {#if imageDim || supportDim}
          <div class="meta-row">
            <div class="meta-label">Dimensions</div>
            <div class="meta-value">
              {#if imageDim}<div>Image: {imageDim}</div>{/if}
              {#if supportDim}<div class="meta-sub">Sheet: {supportDim}</div>{/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Accordion: Signatures & Marks -->
      {#if hasSigMarks}
        <AccordionSection label="Signatures & Marks">
          {#if work.handSig || work.plateSig}
            <div class="meta-row">
              <div class="meta-label">Signatures</div>
              <div class="meta-value">
                {[work.handSig && 'Hand-signed', work.plateSig && 'Plate signature'].filter(Boolean).join('; ')}
              </div>
            </div>
          {/if}
          {#if work.marks.length > 0}
            <div class="meta-row">
              <div class="meta-label">Marks / Watermarks</div>
              <div class="meta-value">{work.marks.join('; ')}</div>
            </div>
          {/if}
        </AccordionSection>
      {/if}

      <!-- Accordion: Catalogue -->
      {#if hasCatalogue}
        <AccordionSection label="Catalogue Raisonné">
          <div class="meta-row">
            <div class="meta-label">Reference</div>
            <div class="meta-value">
              {work.catalogue ?? ''}{#if work.catNum}{work.catalogue ? ', ' : ''}no. {work.catNum}{/if}{#if work.catPage}<span class="meta-sub"> (p. {work.catPage})</span>{/if}
            </div>
          </div>
        </AccordionSection>
      {/if}

      <!-- Provenance -->
      {#if work.yearAcquired}
        <AccordionSection label="Provenance">
          <div class="meta-row">
            <div class="meta-label">Acquired</div>
            <div class="meta-value">{work.yearAcquired}</div>
          </div>
        </AccordionSection>
      {/if}
    </div>
  </div>
</div>

<!-- Other works by this artist -->
{#if relatedWorks.length > 0}
  <div class="related-section">
    <div class="related-header">Other works by {work.artist}</div>
    <div class="related-strip">
      {#each relatedWorks as r (r.id)}
        <div class="related-tile">
          <TimelineCard work={r} onSelect={() => window.location.href = `/works/${r.id}`} />
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Lightbox -->
{#if lightboxOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div class="lightbox" onclick={() => lightboxOpen = false}>
    <img src={activeImage?.zoom} alt={displayTitle} class="lightbox-img" />
    <button class="lightbox-close" onclick={(e) => { e.stopPropagation(); lightboxOpen = false; }}>Close</button>
  </div>
{/if}

<style>
  .back-bar {
    padding: 14px 24px;
    border-bottom: 1px solid var(--border);
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--sans);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-btn:hover { color: var(--text); }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    min-height: calc(100vh - 112px);
  }

  /* Image column */
  .image-col {
    padding: 40px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-right: 1px solid var(--border);
    gap: 20px;
  }

  .main-image-wrap {
    position: relative;
    max-width: 600px;
    width: 100%;
  }

  .main-image {
    width: 100%;
    max-height: 65vh;
    object-fit: contain;
    display: block;
  }

  .main-ph {
    width: 100%;
    aspect-ratio: 3 / 4;
    max-height: 65vh;
    max-width: 500px;
  }

  .enlarge-hint {
    position: absolute;
    bottom: 12px;
    right: 12px;
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    background: rgba(244, 239, 232, 0.85);
    padding: 3px 8px;
  }

  .multi-thumbs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    max-width: 600px;
    width: 100%;
  }

  .multi-thumb {
    width: 64px;
    height: 64px;
    padding: 0;
    border: 2px solid transparent;
    cursor: pointer;
    background: none;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .multi-thumb.active { border-color: var(--accent); }
  .multi-thumb:hover:not(.active) { border-color: var(--border); }

  .multi-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .view-switcher {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .view-btn {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 5px 14px;
    background: var(--bg2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.12s;
  }

  .view-btn.active {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  /* Metadata column */
  .detail-meta-col {
    padding: 40px 32px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .title-block { display: flex; flex-direction: column; gap: 4px; }

  .work-title {
    font-family: var(--serif);
    font-size: 32px;
    font-weight: 400;
    font-style: italic;
    color: var(--text);
    line-height: 1.25;
  }

  .work-title-alt {
    font-family: var(--serif);
    font-size: 18px;
    color: var(--text-dim);
    font-style: italic;
  }

  .work-title-trans {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--text-faint);
    letter-spacing: 0.04em;
  }

  .artist-block { display: flex; flex-direction: column; gap: 3px; }

  .artist-name {
    font-family: var(--serif);
    font-size: 20px;
    color: var(--text);
  }

  .artist-life {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--text-dim);
  }

  .after-line {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--text-dim);
    font-style: italic;
    margin-top: 2px;
  }

  .divider {
    height: 1px;
    background: var(--border);
    flex-shrink: 0;
  }

  .meta-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .meta-row { display: flex; flex-direction: column; gap: 3px; }

  .meta-label {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .meta-value {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--text);
    line-height: 1.5;
  }

  .meta-sub {
    color: var(--text-dim);
    font-size: 14px;
  }

  /* Lightbox */
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(10, 8, 6, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }

  .lightbox-img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
  }

  .lightbox-close {
    position: absolute;
    top: 24px;
    right: 24px;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--sans);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: color 0.15s;
  }

  .lightbox-close:hover { color: white; }

  /* Related works */
  .related-section {
    border-top: 1px solid var(--border);
    padding: 32px 48px 40px;
  }

  .related-header {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 20px;
  }

  .related-strip {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .related-tile {
    width: 200px;
    flex-shrink: 0;
  }

  /* Mobile */
  @media (max-width: 768px) {
    .detail-grid { grid-template-columns: 1fr; }
    .image-col { padding: 24px 20px; border-right: none; border-bottom: 1px solid var(--border); }
    .detail-meta-col { padding: 24px 20px; }
    .related-section { padding: 24px 20px 32px; }
    .related-tile { width: 160px; }
  }
</style>
