<script lang="ts">
  import QrCode from 'svelte-qrcode';
  let logoError = false;
  export let nextWeek: boolean = false;
  export let theme: 'blue' | 'orange' = 'blue';
</script>

<section class="flex flex-col justify-between items-center h-full px-2 rounded-2xl shadow-2xl overflow-auto
  bg-gradient-to-b
  {theme === 'orange' ? 'from-orange-900 via-orange-700 to-orange-500 border-orange-400' : 'from-blue-900 via-blue-700 to-blue-500 border-blue-400'}
  border-4">
  <!-- Top: Logo -->
  <div class="w-full flex flex-col items-center mt-4">
    {#if !logoError}
      <div class="bg-black rounded-full p-2 shadow-lg">
        <img src="/cropped-CCB-Logos_white_LG.png" alt="Comedy Cafe Berlin Logo" class="w-40 h-40 object-contain" on:error={() => logoError = true} />
      </div>
    {/if}
    <div class="text-4xl font-black text-white text-center tracking-widest drop-shadow-lg mt-4">
      {nextWeek ? 'Next Week at' : 'This Week at'}<br />Comedy Cafe Berlin
    </div>
    <div class="text-2xl font-medium text-white leading-relaxed text-center mt-6 mb-2 max-w-md mx-auto">Berlin's first international, alternative comedy stage, school and bar.</div>
    <div class="text-lg {theme === 'orange' ? 'text-orange-100' : 'text-blue-100'} text-center mt-2 mb-4 max-w-md mx-auto">Open Every Wednesday to Sunday</div>
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
  <div class="mb-4 text-2xl {theme === 'orange' ? 'text-orange-100' : 'text-white/80'} font-bold text-center">😂 Improv • 🎤 Standup • 🎭 Sketch</div>
  <slot />
</section> 