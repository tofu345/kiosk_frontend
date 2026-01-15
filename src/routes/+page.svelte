<script lang="ts">
	import * as z from "zod";
	import axios from '$lib/utils/axios';

	import { KioskSchema, type KioskType } from "$lib/types/kiosk";
	import { highlight } from "$lib/utils/highlight";
	import Kiosk from "$lib/components/Kiosk.svelte";

	let kiosk: KioskType | null = $state(null);

	let input = $state('');
	let error: string | null = $state(null);
	let disabled = $state(false);

	function setError(err: string) {
		disabled = false;
		error = err;
	}

	async function getKiosk() {
		if (input.trim() === '') { return; }
		disabled = true;

		let response;
		try {
			response = await axios.get(input);
			if (response.status !== 200 || !response.data?.kiosk) {
				return setError(`invalid content management system response\n ${highlight(response)}`);
			}
		} catch (error) {
			return setError(`${input} returned\n${highlight(error.response)}`);
		}

		let result = KioskSchema.safeParse(response.data?.kiosk);
		if (!result.success) {
			return setError(`${highlight(response.data)}\n\n${z.prettifyError(result.error)}`);
		}
		if (!result.data) {
			return setError(`invalid response\n${response}`);
		}

		kiosk = result.data;
	}

	function clearKiosk(err?: string) {
		if (err) { 
			error = err; 
		} else {
			error = null;
		}

		kiosk = null;
		disabled = false;
	}
</script>

{#if kiosk}
	<Kiosk bind:kiosk={kiosk} {clearKiosk} />
	<button id="remove-kiosk" onclick={() => clearKiosk()}>
		<img src="close.svg" alt="close">
	</button>

{:else}
	{#if error}
		<pre id="cms-error"> {@html error} </pre>
	{/if}

	<form
		id="cms-input-wrapper"
		style={error === null ? '' : 'bottom: 10%;'}
		onsubmit={(e) => { e.preventDefault(); getKiosk() }}
	>
		<input
			bind:value={input}
			{disabled}
			id="cms-input"
			type="text"
			placeholder="Content Management System Kiosk URL"
		/>
		<button id="cms-button" type="submit"> Start </button>
	</form>
{/if}
