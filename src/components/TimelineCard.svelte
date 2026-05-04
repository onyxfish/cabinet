<script lang="ts">
  import WorkImage from './WorkImage.svelte';

  interface Work {
    id: string;
    title: string;
    artist: string;
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
    style="width: 100%; height: 200px; object-fit: contain; background: var(--bg3); display: block; transform: {hovered ? 'scale(1.03)' : 'scale(1)'}; transition: transform 0.4s cubic-bezier(0.25,0,0,1);"
  />
  <div class="overlay">
    <div class="title">{displayTitle}</div>
    <div class="artist">{work.artist}</div>
  </div>
  <div class="year">{work.yearCreated}</div>
</div>

<style>
  .card {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    outline: 2px solid transparent;
    transition: outline-color 0.2s;
  }

  .card:hover {
    outline-color: var(--accent-lt);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(28, 24, 20, 0.85) 0%, transparent 55%);
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .title {
    font-family: var(--serif);
    font-size: 13px;
    font-style: italic;
    color: #f0ebe3;
    line-height: 1.25;
    margin-bottom: 3px;
    text-wrap: pretty;
  }

  .artist {
    font-family: var(--sans);
    font-size: 9px;
    color: rgba(240, 235, 227, 0.65);
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .year {
    position: absolute;
    top: 8px;
    left: 8px;
    font-family: var(--sans);
    font-size: 9px;
    letter-spacing: 0.08em;
    background: rgba(244, 239, 232, 0.88);
    color: var(--text-dim);
    padding: 2px 7px;
  }
</style>
