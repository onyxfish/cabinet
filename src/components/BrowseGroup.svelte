<script lang="ts">
  import WorkImage from './WorkImage.svelte';

  interface Work {
    id: string;
    title: string;
    artist: string;
    images: { display: { thumb: string; display: string; zoom: string }[] };
  }

  interface Props {
    label: string;
    works: Work[];
  }

  let { label, works }: Props = $props();
  let open = $state(true);
</script>

<div class="group">
  <button class="group-header" onclick={() => open = !open}>
    <div class="group-header-left">
      <span class="group-label">{label}</span>
      <span class="group-count">{works.length} work{works.length !== 1 ? 's' : ''}</span>
    </div>
    <svg
      width="14" height="14" viewBox="0 0 14 14"
      fill="none" stroke="currentColor" stroke-width="1.5"
      style="transform: {open ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s; color: var(--text-faint);"
    >
      <polyline points="2,5 7,10 12,5" />
    </svg>
  </button>

  {#if open}
    <div class="thumbs">
      {#each works as work (work.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <a href="/works/{work.id}" class="thumb-link browse-thumb">
          <WorkImage
            src={work.images.display[0]?.thumb}
            artist={work.artist}
            title={work.title}
            style="width: 120px; height: 120px; object-fit: contain; background: var(--bg3); display: block;"
          />
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .group {
    border-bottom: 1px solid var(--border);
  }

  .group-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text);
  }

  .group-header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .group-label {
    font-family: var(--serif);
    font-size: 18px;
    font-style: italic;
  }

  .group-count {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--text-faint);
    letter-spacing: 0.06em;
  }

  .thumbs {
    display: flex;
    gap: 3px;
    padding-bottom: 16px;
    flex-wrap: wrap;
  }

  .thumb-link {
    display: block;
    overflow: hidden;
    transition: outline-color 0.2s;
    outline: 2px solid transparent;
    width: 120px;
    height: 120px;
  }

  .thumb-link:hover {
    outline-color: var(--accent-lt);
  }
</style>
