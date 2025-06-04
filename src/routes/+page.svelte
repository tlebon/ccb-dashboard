<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchShowsFromICal, type Show } from '$lib/utils/icalParser';
  import Countdown from '$lib/components/Countdown.svelte';
  import ShowCarousel from '$lib/components/ShowCarousel.svelte';
  import QrCode from 'svelte-qrcode';

  let shows: Show[] = [];
  let loading = true;
  let error: string | null = null;
  let logoError = false;

  onMount(async () => {
    try {
      shows = await fetchShowsFromICal();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  // Group shows by day, but only for today + next 4 days
  function groupShowsByDayLimited(shows: Show[]) {
    const groups: Record<string, Show[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const show of shows) {
      const date = new Date(show.start);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 5) {
        const dayKey = date.toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(show);
      }
    }
    return groups;
  }

  $: groupedShows = groupShowsByDayLimited(shows);

  // Find the next show
  $: now = new Date();
  $: nextShow = shows.filter(s => new Date(s.start) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];

  $: dayCount = Object.keys(groupedShows).length;
  $: dayHeadingClass = dayCount < 5 ? 'text-5xl' : 'text-4xl';
  $: timeClass = dayCount < 5 ? 'text-4xl' : 'text-3xl';
  $: titleClass = dayCount < 5 ? 'text-2xl' : 'text-xl';
</script>

<div class="min-h-screen bg-black text-white px-2 py-4 flex flex-col">
  <main class="flex-1 max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
    <!-- First Column: Info/Branding -->
    <section class="flex flex-col justify-between items-center h-full px-2 rounded-2xl shadow-2xl bg-gradient-to-b from-blue-900 via-blue-700 to-blue-500 border-4 border-blue-400">
      <!-- Top: Logo -->
      <div class="w-full flex flex-col items-center mt-4">
        {#if !logoError}
          <div class="bg-black rounded-full p-2 shadow-lg">
            <img src="/cropped-CCB-Logos_white_LG.png" alt="Comedy Cafe Berlin Logo" class="w-40 h-40 object-contain" on:error={() => logoError = true} />
          </div>
        {/if}
        <div class="text-4xl font-black text-white text-center tracking-widest drop-shadow-lg mt-4">
          This Week at<br />Comedy Cafe Berlin
        </div>
        <div class="text-3xl font-semibold text-white/90 text-center mt-6 mb-2 max-w-xs">Berlin's first international, alternative comedy stage, school and bar.</div>
        <div class="text-xl font-medium text-white/80 text-center mt-2 mb-2 max-w-xs">Open Every Wednesday to Sunday</div>
      </div>
      <!-- Middle: QR codes only, side by side -->
      <div class="w-full flex flex-row items-end justify-center gap-8 flex-1 mt-2">
        <div class="flex flex-col items-center">
          <div class="text-white text-lg font-bold mb-2">Scan for shows</div>
          <div class="w-[160px] h-[160px] flex items-center justify-center">
            <QrCode value="https://www.comedycafeberlin.com" size={150} color="#fff" background="#1e293b" style="width: 100%; height: 100%;" />
          </div>
        </div>
        <div class="flex flex-col items-center">
          <div class="text-white text-lg font-bold mb-2">Scan for classes</div>
          <div class="w-[160px] h-[160px] flex items-center justify-center">
            <QrCode value="https://training.comedycafeberlin.com" size={150} color="#fff" background="#1e293b" style="width: 100%; height: 100%;" />
          </div>
        </div>
      </div>
      <!-- Bottom: Tagline -->
      <div class="mb-4 text-2xl text-white/80 font-bold text-center">😂 Improv • 🎤 Standup • 🎭 Sketch</div>
    </section>

    <!-- Second Column: Upcoming Shows Grouped by Day (limited) -->
    <section class="space-y-4">
      {#if loading}
        <p class="text-center text-2xl font-bold">Loading shows...</p>
      {:else if error}
        <p class="text-center text-red-400 text-2xl font-bold">Error: {error}</p>
      {:else}
        {#each Object.entries(groupedShows) as [day, dayShows], i (day)}
          <div>
            <h2 class={`font-extrabold mb-1 text-blue-300 drop-shadow ${dayHeadingClass}`} style="letter-spacing:0.05em;">{day}</h2>
            <hr class="mb-4 border-t-4 border-blue-500 opacity-80" />
            <ul>
              {#each dayShows as show, j (show.id)}
                <li>
                  <div class="flex items-center gap-4 px-1 py-1">
                    <div class={`font-mono font-extrabold text-orange-400 min-w-[90px] text-center drop-shadow ${timeClass}`}> 
                      {new Date(show.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="flex-1">
                      <div class={`font-bold mb-0.5 ${titleClass}`}>{show.title}</div>
                    </div>
                  </div>
                  {#if j < dayShows.length - 1}
                    <hr class="border-t border-gray-600 opacity-60 mx-1" />
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      {/if}
    </section>

    <!-- Third Column: Next show and carousel -->
    <section class="flex flex-col items-center justify-start gap-4 w-full">
      {#if nextShow}
        <div class="w-full bg-gray-900 rounded-2xl shadow-2xl overflow-hidden mb-4 border-4 border-blue-500">
          <img src={nextShow.imageUrl} alt={nextShow.title} class="w-full h-72 object-cover" />
          <div class="p-4">
            <div class="text-lg font-bold uppercase tracking-widest text-orange-400 mb-1">Up Next</div>
            <h2 class="text-3xl font-extrabold mb-1 text-blue-300 drop-shadow">{nextShow.title}</h2>
            <div class="text-xl text-white/80">
              {new Date(nextShow.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {' '}
              <span class="text-orange-400 font-bold">{new Date(nextShow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      {/if}
      <ShowCarousel {shows} nextShowId={nextShow?.id} />
    </section>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background: #000;
  }
</style>
