<script lang="ts">
  import { onMount } from 'svelte';
  import historicalShows from '../../data/historical-shows.json';
  import teamsData from '../../data/teams.json';
  import showLineupsData from '../../data/show-lineups.json';

  interface Show {
    date: string;
    dayOfWeek: string;
    time: string;
    title: string;
    hostedBy?: string;
  }

  interface Team {
    name: string;
    aliases?: string[];
    members: string[];
    type: string;
  }

  interface ShowLineup {
    date: string;
    show: string;
    type: 'team' | 'rotating';
    teamName?: string;
    performers?: string[];
    hosts?: string[];
    teams?: string[];
  }

  const shows: Show[] = historicalShows as Show[];
  const teams: Team[] = teamsData.teams as Team[];
  const showLineups: ShowLineup[] = showLineupsData.showLineups as ShowLineup[];

  // Normalize jam host names (combine similar spellings)
  function normalizeHostName(name: string): string {
    const normalized = name.trim().toLowerCase();

    // Define canonical names for hosts with variations
    const mappings: Record<string, string> = {
      'piss baby': 'Piss Baby',
      'pissbaby': 'Piss Baby',
      'truth paste': 'Truth Paste',
      'truthpaste': 'Truth Paste',
      'wet teeth': 'Wet Teeth',
      'bear milk': 'Full Fat Bear Milk',
      'full fat bear milk': 'Full Fat Bear Milk',
      'dackel, hopefully': 'Dackel',
      'dackel': 'Dackel',
      "ivana's birthday team": "Ivana's Birthday Team",
      'brace! brace!': 'Brace! Brace!',
    };

    return mappings[normalized] || name.trim();
  }

  // Build team name lookup (including aliases)
  const teamsByName = new Map<string, Team>();
  for (const team of teams) {
    teamsByName.set(team.name.toLowerCase(), team);
    if (team.aliases) {
      for (const alias of team.aliases) {
        teamsByName.set(alias.toLowerCase(), team);
      }
    }
  }

  // Calculate performer appearances
  const performerAppearances = new Map<string, { count: number; teams: Set<string>; shows: Set<string> }>();
  const teamShowCounts = new Map<string, number>();
  const processedShowKeys = new Set<string>(); // Track which shows we've already counted

  for (const show of shows) {
    const titleLower = show.title.toLowerCase();
    const showKey = `${show.date}|${titleLower}`;

    // Skip if we've already processed this exact show
    if (processedShowKeys.has(showKey)) continue;

    // First check if we have specific lineup data for this show+date
    let foundLineup = false;
    for (const lineup of showLineups) {
      if (show.date === lineup.date && titleLower.includes(lineup.show.toLowerCase())) {
        foundLineup = true;
        processedShowKeys.add(showKey);

        // Add performers from rotating shows
        if (lineup.performers && lineup.performers.length > 0) {
          for (const performer of lineup.performers) {
            const existing = performerAppearances.get(performer) || { count: 0, teams: new Set(), shows: new Set() };
            existing.count += 1;
            existing.shows.add(lineup.show);
            performerAppearances.set(performer, existing);
          }
        }

        // Add hosts from rotating shows
        if (lineup.hosts && lineup.hosts.length > 0) {
          for (const host of lineup.hosts) {
            const existing = performerAppearances.get(host) || { count: 0, teams: new Set(), shows: new Set() };
            existing.count += 1;
            existing.shows.add(`${lineup.show} (Host)`);
            performerAppearances.set(host, existing);
          }
        }

        // If it's a team show or has team reference, count team members
        if (lineup.teamName) {
          const team = teamsByName.get(lineup.teamName.toLowerCase());
          if (team && team.members.length > 0) {
            teamShowCounts.set(team.name, (teamShowCounts.get(team.name) || 0) + 1);
            for (const member of team.members) {
              const existing = performerAppearances.get(member) || { count: 0, teams: new Set(), shows: new Set() };
              existing.count += 1;
              existing.teams.add(team.name);
              performerAppearances.set(member, existing);
            }
          }
        }

        // Also expand teams array if present (e.g., for shows like Kringel)
        if (lineup.teams && lineup.teams.length > 0) {
          for (const teamRef of lineup.teams) {
            const team = teamsByName.get(teamRef.toLowerCase());
            if (team && team.members.length > 0) {
              teamShowCounts.set(team.name, (teamShowCounts.get(team.name) || 0) + 1);
              for (const member of team.members) {
                const existing = performerAppearances.get(member) || { count: 0, teams: new Set(), shows: new Set() };
                existing.count += 1;
                existing.teams.add(team.name);
                performerAppearances.set(member, existing);
              }
            }
          }
        }
        break;
      }
    }

    // If no specific lineup, fall back to team name matching
    if (!foundLineup) {
      for (const team of teams) {
        const names = [team.name, ...(team.aliases || [])];
        for (const name of names) {
          if (titleLower.includes(name.toLowerCase())) {
            processedShowKeys.add(showKey);
            teamShowCounts.set(team.name, (teamShowCounts.get(team.name) || 0) + 1);
            for (const member of team.members) {
              const existing = performerAppearances.get(member) || { count: 0, teams: new Set(), shows: new Set() };
              existing.count += 1;
              existing.teams.add(team.name);
              performerAppearances.set(member, existing);
            }
            break;
          }
        }
      }
    }

    // Count jam host team members - but only if we haven't already processed this show via lineup data
    if (!foundLineup && show.hostedBy && /Improv Jam/i.test(show.title)) {
      const hostName = normalizeHostName(show.hostedBy);
      const hostTeam = teamsByName.get(hostName.toLowerCase());
      if (hostTeam && hostTeam.members.length > 0) {
        for (const member of hostTeam.members) {
          const existing = performerAppearances.get(member) || { count: 0, teams: new Set(), shows: new Set() };
          existing.count += 1;
          existing.teams.add(hostTeam.name + ' (Jam Host)');
          performerAppearances.set(member, existing);
        }
      }
    }
  }

  // Sort performers by appearance count
  const topPerformers = [...performerAppearances.entries()]
    .map(([name, data]) => ({
      name,
      count: data.count,
      teams: [...data.teams],
      shows: [...data.shows]
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Sort teams by show count
  const topTeams = [...teamShowCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Calculate stats
  const showCounts = new Map<string, number>();
  const jamHosts = new Map<string, number>();
  const monthlyShows = new Map<string, number>();

  for (const show of shows) {
    // Count shows by title (normalize slightly)
    const normalizedTitle = show.title
      .replace(/\s*[-–:]\s*.*$/, '') // Remove subtitles
      .replace(/\s+/g, ' ')
      .trim();
    showCounts.set(normalizedTitle, (showCounts.get(normalizedTitle) || 0) + 1);

    // Count jam hosts (with normalization)
    if (show.hostedBy && /Improv Jam/i.test(show.title)) {
      const host = normalizeHostName(show.hostedBy);
      jamHosts.set(host, (jamHosts.get(host) || 0) + 1);
    }

    // Monthly distribution
    const month = show.date.substring(0, 7); // YYYY-MM
    monthlyShows.set(month, (monthlyShows.get(month) || 0) + 1);
  }

  // Sort and get top shows
  const topShows = [...showCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Sort jam hosts
  const topJamHosts = [...jamHosts.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Get date range
  const dates = shows.map(s => s.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // Monthly data for chart
  const months = [...monthlyShows.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthly = Math.max(...months.map(m => m[1]));

  // Day of week distribution
  const dayDistribution = new Map<string, number>();
  for (const show of shows) {
    const day = show.dayOfWeek;
    dayDistribution.set(day, (dayDistribution.get(day) || 0) + 1);
  }
  const orderedDays = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayData = orderedDays.map(d => ({ day: d, count: dayDistribution.get(d) || 0 }));
  const maxDay = Math.max(...dayData.map(d => d.count));

  // Active tab state
  let activeTab = $state<'shows' | 'hosts' | 'performers' | 'timeline'>('shows');
</script>

<div class="min-h-screen bg-[var(--tw-midnight)] text-[var(--tw-electric-cyan)] p-8">
  <div class="grain-overlay"></div>

  <div class="relative z-10 max-w-7xl mx-auto">
    <!-- Header -->
    <header class="mb-12">
      <h1 class="font-[var(--font-display)] text-6xl md:text-8xl tracking-tight text-[var(--tw-neon-pink)] neon-glow mb-4">
        CCB ANALYTICS
      </h1>
      <p class="font-[var(--font-mono)] text-lg text-[var(--tw-electric-cyan)] opacity-80">
        {shows.length} shows tracked from {firstDate} to {lastDate}
      </p>
    </header>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <div class="font-[var(--font-display)] text-5xl text-[var(--tw-neon-pink)]">{shows.length}</div>
        <div class="font-[var(--font-mono)] text-sm uppercase tracking-wider opacity-70">Total Shows</div>
      </div>
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <div class="font-[var(--font-display)] text-5xl text-[var(--tw-electric-cyan)]">{showCounts.size}</div>
        <div class="font-[var(--font-mono)] text-sm uppercase tracking-wider opacity-70">Unique Shows</div>
      </div>
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <div class="font-[var(--font-display)] text-5xl text-[var(--nw-burning-orange)]">{performerAppearances.size}</div>
        <div class="font-[var(--font-mono)] text-sm uppercase tracking-wider opacity-70">Performers</div>
      </div>
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <div class="font-[var(--font-display)] text-5xl text-[var(--nw-hot-pink)]">{jamHosts.size}</div>
        <div class="font-[var(--font-mono)] text-sm uppercase tracking-wider opacity-70">Jam Hosts</div>
      </div>
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <div class="font-[var(--font-display)] text-5xl text-[var(--nw-neon-yellow)]">{months.length}</div>
        <div class="font-[var(--font-mono)] text-sm uppercase tracking-wider opacity-70">Months Tracked</div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="flex gap-2 mb-8">
      <button
        class="px-6 py-3 font-[var(--font-display)] text-xl uppercase tracking-wider transition-all
               {activeTab === 'shows' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
        onclick={() => activeTab = 'shows'}>
        Top Shows
      </button>
      <button
        class="px-6 py-3 font-[var(--font-display)] text-xl uppercase tracking-wider transition-all
               {activeTab === 'hosts' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
        onclick={() => activeTab = 'hosts'}>
        Jam Hosts
      </button>
      <button
        class="px-6 py-3 font-[var(--font-display)] text-xl uppercase tracking-wider transition-all
               {activeTab === 'performers' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
        onclick={() => activeTab = 'performers'}>
        Performers
      </button>
      <button
        class="px-6 py-3 font-[var(--font-display)] text-xl uppercase tracking-wider transition-all
               {activeTab === 'timeline' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
        onclick={() => activeTab = 'timeline'}>
        Timeline
      </button>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'shows'}
      <div class="grid md:grid-cols-2 gap-8">
        <!-- Top Shows Chart -->
        <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
          <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">MOST FREQUENT SHOWS</h2>
          <div class="space-y-3">
            {#each topShows as [title, count], i}
              {@const maxCount = topShows[0][1]}
              {@const width = (count / maxCount) * 100}
              <div class="group">
                <div class="flex justify-between items-center mb-1">
                  <span class="font-[var(--font-mono)] text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors">
                    {i + 1}. {title}
                  </span>
                  <span class="font-[var(--font-display)] text-lg text-[var(--tw-neon-pink)]">{count}</span>
                </div>
                <div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--tw-electric-cyan)] transition-all duration-500"
                    style="width: {width}%">
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Day Distribution -->
        <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
          <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">SHOWS BY DAY</h2>
          <div class="flex items-end justify-between gap-4" style="height: 256px;">
            {#each dayData as { day, count }}
              {@const heightPx = Math.max(20, (count / maxDay) * 200)}
              <div class="flex-1 flex flex-col items-center">
                <div class="font-[var(--font-display)] text-xl text-[var(--tw-electric-cyan)] mb-2">
                  {count}
                </div>
                <div class="w-full bg-gradient-to-t from-[var(--nw-burning-orange)] to-[var(--nw-hot-pink)]" style="height: {heightPx}px;"></div>
                <span class="font-[var(--font-mono)] text-xs uppercase tracking-wider opacity-70 mt-2">
                  {day.slice(0, 3)}
                </span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === 'hosts'}
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">JAM HOST LEADERBOARD</h2>
        <p class="font-[var(--font-mono)] text-sm opacity-70 mb-6">
          Teams that have hosted the Sunday CCB Improv Jam
        </p>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each topJamHosts as [host, count], i}
            <div class="flex items-center gap-4 p-4 bg-[var(--tw-concrete)] hover:bg-[var(--tw-midnight)] transition-colors group">
              <div class="font-[var(--font-display)] text-4xl w-12 text-center
                         {i === 0 ? 'text-[var(--nw-neon-yellow)]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--tw-concrete)]'}">
                {i + 1}
              </div>
              <div class="flex-1">
                <div class="font-[var(--font-mono)] text-lg group-hover:text-[var(--tw-neon-pink)] transition-colors">
                  {host}
                </div>
                <div class="font-[var(--font-mono)] text-sm opacity-50">
                  {count} {count === 1 ? 'time' : 'times'}
                </div>
              </div>
            </div>
          {/each}
        </div>
        {#if topJamHosts.length === 0}
          <p class="font-[var(--font-mono)] text-center opacity-50 py-8">
            No jam host data available yet
          </p>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'performers'}
      <div class="grid md:grid-cols-2 gap-8">
        <!-- Top Performers -->
        <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
          <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">TOP PERFORMERS</h2>
          <p class="font-[var(--font-mono)] text-sm opacity-70 mb-6">
            Estimated stage appearances based on team shows
          </p>
          <div class="space-y-3 max-h-[600px] overflow-y-auto">
            {#each topPerformers as performer, i}
              {@const maxCount = topPerformers[0]?.count || 1}
              {@const width = (performer.count / maxCount) * 100}
              {@const allCredits = [...performer.teams, ...performer.shows]}
              <div class="group">
                <div class="flex justify-between items-center mb-1">
                  <span class="font-[var(--font-mono)] text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors">
                    {i + 1}. {performer.name}
                  </span>
                  <span class="font-[var(--font-display)] text-lg text-[var(--tw-neon-pink)]">{performer.count}</span>
                </div>
                <div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-[var(--nw-burning-orange)] to-[var(--nw-neon-yellow)] transition-all duration-500"
                    style="width: {width}%">
                  </div>
                </div>
                <div class="font-[var(--font-mono)] text-xs opacity-50 mt-1">
                  {allCredits.slice(0, 3).join(', ')}{allCredits.length > 3 ? ` +${allCredits.length - 3} more` : ''}
                </div>
              </div>
            {/each}
          </div>
          {#if topPerformers.length === 0}
            <p class="font-[var(--font-mono)] text-center opacity-50 py-8">
              No performer data available yet
            </p>
          {/if}
        </div>

        <!-- Top Teams by Shows -->
        <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
          <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">MOST ACTIVE TEAMS</h2>
          <p class="font-[var(--font-mono)] text-sm opacity-70 mb-6">
            Teams with the most shows in the dataset
          </p>
          <div class="space-y-3 max-h-[600px] overflow-y-auto">
            {#each topTeams as [teamName, count], i}
              {@const maxCount = topTeams[0]?.[1] || 1}
              {@const width = (count / maxCount) * 100}
              {@const team = teamsByName.get(teamName.toLowerCase())}
              <div class="group">
                <div class="flex justify-between items-center mb-1">
                  <span class="font-[var(--font-mono)] text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors">
                    {i + 1}. {teamName}
                  </span>
                  <span class="font-[var(--font-display)] text-lg text-[var(--tw-electric-cyan)]">{count}</span>
                </div>
                <div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] transition-all duration-500"
                    style="width: {width}%">
                  </div>
                </div>
                {#if team && team.members.length > 0}
                  <div class="font-[var(--font-mono)] text-xs opacity-50 mt-1">
                    {team.members.slice(0, 4).join(', ')}{team.members.length > 4 ? ` +${team.members.length - 4} more` : ''}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          {#if topTeams.length === 0}
            <p class="font-[var(--font-mono)] text-center opacity-50 py-8">
              No team show data available yet
            </p>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'timeline'}
      <div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
        <h2 class="font-[var(--font-display)] text-3xl text-[var(--tw-electric-cyan)] mb-6">MONTHLY ACTIVITY</h2>
        <div class="overflow-x-auto pb-4">
          <div class="flex items-end gap-2 min-w-max" style="height: 280px; padding-bottom: 40px;">
            {#each months as [month, count]}
              {@const heightPx = Math.max(20, (count / maxMonthly) * 200)}
              {@const [year, m] = month.split('-')}
              {@const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleString('en', { month: 'short' })}
              <div class="flex flex-col items-center group">
                <div class="font-[var(--font-mono)] text-xs text-[var(--tw-electric-cyan)] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {count}
                </div>
                <div
                  class="w-10 bg-gradient-to-t from-[var(--tw-deep-purple)] via-[var(--tw-neon-pink)] to-[var(--tw-electric-cyan)] transition-all hover:opacity-80 cursor-pointer"
                  style="height: {heightPx}px;"
                  title="{monthName} {year}: {count} shows">
                </div>
                <div class="mt-2 font-[var(--font-mono)] text-xs opacity-50 whitespace-nowrap" style="transform: rotate(-45deg); transform-origin: top left; width: 50px;">
                  {monthName} '{year.slice(2)}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Footer -->
    <footer class="mt-12 text-center font-[var(--font-mono)] text-sm opacity-50">
      Data sourced from CCB Online Community via Beeper MCP
    </footer>
  </div>
</div>
