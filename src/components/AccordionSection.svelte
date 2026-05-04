<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    defaultOpen?: boolean;
    children: Snippet;
  }

  let { label, defaultOpen = false, children }: Props = $props();
  let open = $state(defaultOpen);
</script>

<div class="accordion">
  <button class="accordion-header" onclick={() => open = !open}>
    <span>{label}</span>
    <svg
      width="14" height="14" viewBox="0 0 14 14"
      fill="none" stroke="currentColor" stroke-width="1.5"
      style="transform: {open ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s;"
    >
      <polyline points="2,5 7,10 12,5" />
    </svg>
  </button>
  {#if open}
    <div class="accordion-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .accordion {
    border-top: 1px solid var(--border);
    padding-top: 4px;
  }

  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .accordion-body {
    padding-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
