<script lang="ts">
  interface Props {
    src?: string;
    artist: string;
    title: string;
    style?: string;
    class?: string;
    onClick?: () => void;
    label?: boolean;
  }

  let { src, artist, title, style = '', class: className = '', onClick, label = true }: Props = $props();

  // Strip surrounding smart quotes from title for display
  const displayTitle = title.replace(/^["“]|["”]$/g, '');
</script>

{#if src}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <img
    {src}
    alt="{displayTitle} — {artist}"
    class={className}
    {style}
    loading="lazy"
    onclick={onClick}
  />
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div class="img-ph {className}" {style} onclick={onClick}>
    {#if label}
      <div class="img-ph-inner">
        <span class="img-ph-artist">{artist}</span>
        <span class="img-ph-title">{displayTitle}</span>
      </div>
    {/if}
  </div>
{/if}
