<script lang="ts">
  import BrowseGroup from './BrowseGroup.svelte';

  interface Work {
    id: string;
    title: string;
    artist: string;
    medium: string[];
    images: { display: string[] };
  }

  interface Props {
    works: Work[];
  }

  let { works }: Props = $props();

  type Section = 'artists' | 'medium';
  let activeSection = $state<Section>('artists');

  const byArtist: [string, Work[]][] = $derived(
    Object.entries(
      works.reduce((acc: Record<string, Work[]>, w) => {
        (acc[w.artist] = acc[w.artist] ?? []).push(w);
        return acc;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b))
  );

  const byMedium: [string, Work[]][] = $derived(
    Object.entries(
      works.reduce((acc: Record<string, Work[]>, w) => {
        for (const m of w.medium) {
          (acc[m] = acc[m] ?? []).push(w);
        }
        return acc;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b))
  );

  const groups = $derived(activeSection === 'artists' ? byArtist : byMedium);
</script>

<div class="browse-root">
  <!-- Tab bar -->
  <div class="tabs">
    {#each [['artists', 'By Artist'], ['medium', 'By Medium']] as [id, label] (id)}
      <button
        class="tab"
        class:active={activeSection === id}
        onclick={() => activeSection = id as Section}
      >
        {label}
      </button>
    {/each}
  </div>

  <!-- Groups -->
  <div class="groups">
    {#each groups as [groupLabel, groupWorks] (groupLabel)}
      <BrowseGroup label={groupLabel} works={groupWorks} />
    {/each}
  </div>
</div>

<style>
  .browse-root {
    padding: 32px 24px;
    max-width: 1100px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: 40px;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-dim);
    cursor: pointer;
    transition: color 0.15s;
    margin-bottom: -1px;
  }

  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .tab:hover:not(.active) {
    color: var(--text);
  }

  .groups {
    display: flex;
    flex-direction: column;
  }
</style>
