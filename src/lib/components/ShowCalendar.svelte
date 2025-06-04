<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';

  export let shows: Show[] = [];
  export let currentDate: Date = new Date();

  // Get the first day of the current month
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  // Get the last day of the current month
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = firstDay.getDay();
  
  // Create an array of days in the month
  const daysInMonth = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);
  
  // Create an array of empty cells for days before the first day of the month
  const emptyCells = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  
  // Get shows for a specific day
  function getShowsForDay(day: number): Show[] {
    return shows.filter(show => {
      const showDate = new Date(show.start);
      return showDate.getDate() === day && 
             showDate.getMonth() === currentDate.getMonth() &&
             showDate.getFullYear() === currentDate.getFullYear();
    });
  }
</script>

<div class="bg-white rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold mb-4">
    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
  </h2>
  
  <div class="grid grid-cols-7 gap-2">
    {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
      <div class="text-center font-semibold text-gray-600 py-2">{day}</div>
    {/each}
    
    {#each emptyCells as _}
      <div class="aspect-square"></div>
    {/each}
    
    {#each daysInMonth as day}
      <div class="aspect-square border rounded-lg p-1 {getShowsForDay(day).length > 0 ? 'bg-blue-50' : ''}">
        <div class="text-sm font-medium mb-1">{day}</div>
        {#if getShowsForDay(day).length > 0}
          <div class="text-xs text-blue-600">
            {getShowsForDay(day).length} show{getShowsForDay(day).length > 1 ? 's' : ''}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .calendar-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .calendar-day {
    min-height: 80px;
    transition: all 0.2s ease;
  }

  .calendar-day:hover {
    transform: scale(1.02);
  }
</style> 