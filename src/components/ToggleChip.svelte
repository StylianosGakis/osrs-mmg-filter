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
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    active = $bindable(),
    title,
    icon,
    ontoggle,
    children
  }: {
    active: boolean;
    title: string;
    icon: string;
    ontoggle: () => void;
    children: Snippet;
  } = $props();
</script>

<button
  class="osrs-toggle-chip"
  class:active={active}
  title={title}
  onclick={ontoggle}
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d={icon} />
  </svg>
  {@render children()}
</button>
