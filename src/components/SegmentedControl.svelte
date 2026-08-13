<script lang="ts">
  /*
   * OSRS MMG Filter - Filter the OSRS Wiki Money Making Guide table
   * Copyright (C) 2026  Stylianos Gakis
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Affero General Public License as published
   * by the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
   * GNU Affero General Public License for more details.
   *
   * You should have received a copy of the GNU Affero General Public License
   * along with this program. If not, see https://www.gnu.org/licenses/
   *
   * Source: https://github.com/StylianosGakis/osrs-mmg-filter
   */


  type Option = { value: string; label: string; title?: string; dotColor?: string };
  
  let {
    options,
    value = $bindable(),
    onchange
  }: {
    options: Option[];
    value: string;
    onchange: (value: string) => void;
  } = $props();

  function handleClick(val: string) {
    value = val;
    onchange(val);
  }
</script>

<div class="osrs-segmented-control">
  {#each options as option}
    <button
      class="osrs-pill-btn"
      class:active={value === option.value}
      title={option.title}
      onclick={() => handleClick(option.value)}
    >
      {#if option.dotColor}
        <span class="osrs-dot {option.dotColor}"></span>
      {/if}
      {option.label}
    </button>
  {/each}
</div>
