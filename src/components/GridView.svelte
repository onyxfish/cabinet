<script lang="ts">
    import { onMount } from "svelte";
    import GridCard from "./GridCard.svelte";

    interface Work {
        id: string;
        title: string;
        titleTrans?: string | null;
        artist: string;
        after: string[];
        medium: string[];
        yearCreated: string;
        sortYear: number;
        dimensions?: { imageH?: number; imageW?: number } | null;
        images: { display: { thumb: string; display: string; zoom: string }[] };
    }

    interface Props {
        works: Work[];
    }

    let { works }: Props = $props();

    const allMedia: string[] = $derived(
        [...new Set(works.flatMap((w) => w.medium))].sort(),
    );

    let activeFilter = $state("All");
    let query = $state("");

    const filtered: Work[] = $derived(
        (() => {
            const q = query.trim().toLowerCase();
            return works.filter((w) => {
                const matchesMedium =
                    activeFilter === "All" || w.medium.includes(activeFilter);
                if (!matchesMedium) return false;
                if (!q) return true;
                return (
                    w.title.toLowerCase().includes(q) ||
                    (w.titleTrans?.toLowerCase().includes(q) ?? false) ||
                    w.artist.toLowerCase().includes(q) ||
                    w.after.some((a) => a.toLowerCase().includes(q))
                );
            });
        })(),
    );

    // Responsive column count — mirrors CSS breakpoints
    let columnCount = $state(4);

    onMount(() => {
        const update = () => {
            const w = window.innerWidth;
            columnCount = w <= 768 ? 2 : w <= 1200 ? 3 : 4;
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    });

    // Distribute works left-to-right (round-robin) so reading order matches sort order
    const columns: Work[][] = $derived(
        (() => {
            const cols: Work[][] = Array.from(
                { length: columnCount },
                () => [],
            );
            filtered.forEach((work, i) => cols[i % columnCount].push(work));
            return cols;
        })(),
    );
</script>

<div>
    <div class="filter-bar">
        <div class="search-wrap">
            <input
                class="search-input"
                type="search"
                placeholder="Search artist or title…"
                bind:value={query}
            />
            {#if query}
                <button
                    class="search-clear"
                    onclick={() => (query = "")}
                    aria-label="Clear search">×</button
                >
            {/if}
        </div>
        {#each ["All", ...allMedia] as medium (medium)}
            <button
                class="filter-chip"
                class:active={activeFilter === medium}
                onclick={() => (activeFilter = medium)}
            >
                {medium}
            </button>
        {/each}
        <span class="work-count"
            >{filtered.length} work{filtered.length !== 1 ? "s" : ""}</span
        >
    </div>

    <div class="grid-masonry">
        {#each columns as col}
            <div class="grid-col">
                {#each col as work (work.id)}
                    <GridCard
                        {work}
                        onSelect={() =>
                            (window.location.href = `/works/${work.id}`)}
                    />
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .filter-bar {
        padding: 16px 28px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        margin-right: 16px;
    }

    .search-input {
        font-family: var(--sans);
        font-size: 14px;
        color: var(--text);
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--border);
        padding: 2px 20px 2px 0;
        width: 180px;
        outline: none;
        transition: border-color 0.15s;
    }

    .search-input::placeholder {
        color: var(--text-faint);
    }

    .search-input:focus {
        border-bottom-color: var(--accent);
    }

    /* Hide browser-native clear button on search inputs */
    .search-input::-webkit-search-cancel-button {
        display: none;
    }

    .search-clear {
        position: absolute;
        right: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-faint);
        font-size: 18px;
        line-height: 1;
        padding: 0 2px;
        transition: color 0.15s;
    }

    .search-clear:hover {
        color: var(--text-dim);
    }

    .filter-label {
        font-family: var(--sans);
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-faint);
        margin-right: 6px;
    }

    .filter-chip {
        font-family: var(--sans);
        font-size: 12px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        padding: 3px 11px;
        background: transparent;
        color: var(--text-dim);
        border: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.12s;
    }

    .filter-chip.active {
        background: var(--text);
        color: var(--bg);
        border-color: var(--text);
    }

    .filter-chip:hover:not(.active) {
        border-color: var(--text-dim);
        color: var(--text);
    }

    .work-count {
        margin-left: auto;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--text-faint);
    }

    .grid-masonry {
        padding: 3px;
        display: flex;
        gap: 3px;
        align-items: flex-start;
    }

    .grid-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    @media (max-width: 480px) {
        .filter-bar {
            padding: 12px 14px;
        }
    }
</style>
