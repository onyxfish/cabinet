<script lang="ts">
  import WorkImage from './WorkImage.svelte';

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

  const displayTitle = work.title.replace(/^[""]|[""]$/g, '');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="card"
  onclick={onSelect}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
>
  <WorkImage
    src={work.images.display[0]?.thumb}
    artist={work.artist}
    title={work.title}
    style="width: 100%; height: auto; display: block; transform: {hovered ? 'scale(1.02)' : 'scale(1)'}; transition: transform 0.5s cubic-bezier(0.25,0,0,1);"
  />

  <!-- Hover overlay -->
  <div class="overlay" style="opacity: {hovered ? 1 : 0}">
    <div class="overlay-title">{displayTitle}</div>
    <div class="overlay-meta">{work.artist} · {work.yearCreated}</div>
  </div>

  <!-- Year badge -->
  <div class="year-badge" style="opacity: {hovered ? 0 : 0.7}">{work.yearCreated}</div>
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
    min-height: 180px;
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
    font-size: 15px;
    font-style: italic;
    color: #f0ebe3;
    line-height: 1.3;
    margin-bottom: 4px;
  }

  .overlay-meta {
    font-family: var(--sans);
    font-size: 10px;
    color: rgba(240, 235, 227, 0.7);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .year-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    transition: opacity 0.2s;
  }
</style>
