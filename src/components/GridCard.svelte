<script lang="ts">
  interface Work {
    id: string;
    title: string;
    artist: string;
    medium: string[];
    yearCreated: string;
    images: { display: { thumb: string; display: string; zoom: string }[] };
  }

  interface Props {
    work: Work;
    onSelect: () => void;
  }

  let { work, onSelect }: Props = $props();
  let hovered = $state(false);

  const thumb = $derived(work.images.display[0]?.thumb);
  const hasImage = $derived(!!thumb);
  const displayTitle = work.title.replace(/^[""]|[""]$/g, '');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="card"
  class:is-placeholder={!hasImage}
  onclick={onSelect}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
>
  {#if hasImage}
    <img
      src={thumb}
      alt="{displayTitle} — {work.artist}"
      class="card-img"
      style="transform: {hovered ? 'scale(1.02)' : 'scale(1)'}; transition: transform 0.5s cubic-bezier(0.25,0,0,1);"
      loading="lazy"
    />

  {:else}
    <div class="card-stripe"></div>
    <div class="ph-label">
      <div class="ph-title" style="color: {hovered ? '#f0ebe3' : 'var(--text-dim)'}">{displayTitle}</div>
      <div class="ph-meta" style="color: {hovered ? 'rgba(240,235,227,0.7)' : 'var(--text-faint)'}"><span class="uc">{work.artist}</span>{work.yearCreated ? ` · ${work.yearCreated}` : ''}</div>
    </div>
  {/if}

  {#if hasImage}
    <div class="overlay" style="opacity: {hovered ? 1 : 0}">
      <div class="overlay-title">{displayTitle}</div>
      <div class="overlay-meta"><span class="uc">{work.artist}</span>{work.yearCreated ? ` · ${work.yearCreated}` : ''}</div>
    </div>
  {:else}
    <div class="overlay overlay-ph" style="opacity: {hovered ? 1 : 0}"></div>
  {/if}
</div>

<style>
  .card {
    cursor: pointer;
    break-inside: avoid;
    margin-bottom: 3px;
    position: relative;
    overflow: hidden;
    background: var(--bg2);
    display: block;
  }

  .card.is-placeholder {
    aspect-ratio: 4 / 3;
  }

  .card-img {
    width: 100%;
    height: auto;
    display: block;
  }

  .card-stripe {
    position: absolute;
    inset: 0;
    background: var(--bg3);
  }

  .card-stripe::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.025) 10px,
      rgba(0, 0, 0, 0.025) 11px
    );
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(28, 24, 20, 0.88) 0%, rgba(28, 24, 20, 0.15) 55%, transparent 100%);
    transition: opacity 0.3s;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 14px 12px;
  }

  .overlay-title {
    font-family: var(--serif);
    font-size: 17px;
    font-style: italic;
    color: #f0ebe3;
    line-height: 1.3;
    margin-bottom: 4px;
  }

  .overlay-meta {
    font-family: var(--sans);
    font-size: 12px;
    color: rgba(240, 235, 227, 0.7);
    letter-spacing: 0.06em;
  }

  .ph-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 14px 12px;
    z-index: 1;
  }

  .ph-title {
    font-family: var(--serif);
    font-size: 17px;
    font-style: italic;
    line-height: 1.3;
    margin-bottom: 4px;
    transition: color 0.3s;
  }

  .ph-meta {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.06em;
    transition: color 0.3s;
  }

  .uc {
    text-transform: uppercase;
  }

  .overlay-ph {
    pointer-events: none;
  }

  .year-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    transition: opacity 0.2s;
  }
</style>
