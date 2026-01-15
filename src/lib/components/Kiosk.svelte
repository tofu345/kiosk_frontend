<script lang="ts">
	import { tick } from 'svelte';
	import * as z from "zod";
	import axios from '$lib/utils/axios';

	import { type KioskType } from "$lib/types/kiosk";
	import { AnnouncementSchema, type Announcement } from "$lib/types/announcement";
	import { onMount, onDestroy } from "svelte";
	import { MediaSchema } from "$lib/types/media";
	import { generateSensorData } from '$lib/utils/generateSensorData';
	import { highlight } from '$lib/utils/highlight';

	type Props = {
		kiosk: KioskType
		clearKiosk: (err?: string) => void
	};

	let { kiosk = $bindable(), clearKiosk }: Props = $props();
	const sendSensorDataInterval = 30000; // every minute

	let chatbotShown = $state(false);

	// show, hide media
	let currentMedia = 0;
	let mediaTimeoutId: number | null = null; // null if there is a no setTimeout pending

	// setAnnouncement()
	let announcement: Announcement | null = $state(null);
	let announcementCanPlay = $derived(announcement !== null);

	// submitMessage(), createConversation()
	let conversationId: number | null = $state(null);
	let currentConversation = $derived(kiosk.conversations.find((c) => c.pk == conversationId));

	/// Media Display

	function currentMediaElement(): Element | undefined {
		const container = document.querySelector("div#kiosk-container");
		if (container === null) {
			console.error("could not find media container");
			return undefined;
		}

		let elem = container.children[currentMedia];
		if (elem.id === "no-media") { return undefined; }
		return elem;
	}

	async function showMedia() {
		mediaTimeoutId = null;

		const el = currentMediaElement()
		if (!el) {
			mediaTimeoutId = setTimeout(nextMedia, kiosk.image_duration_ms);
			return;
		}

		el.classList.remove("hidden");
		el.classList.add("fade-in");

		if (kiosk.media[currentMedia].type.startsWith("video")) {
			const video = el.children[0] as HTMLVideoElement;
			if (video.tagName !== "VIDEO") {
				console.error(`media at index ${currentMedia} is not a video`);
				return;
			}

			await video.play()
				.then()
				.catch((error) => {
					console.error("error playing video at index", currentMedia, error);
				})

			video.addEventListener("ended", () => {
				nextMedia()
			}, { once: true });

		} else {
			mediaTimeoutId = setTimeout(nextMedia, kiosk.image_duration_ms);
		}
	}

	async function hideMedia() {
		if (kiosk.media.length === 1) { return; }

		let el = currentMediaElement();
		if (!el) { return; }

		el.classList.remove("hidden");
		el.classList.remove("fade-in");
		el.classList.add("fade-out");
		el.addEventListener("animationend", function() {
			el.classList.add("hidden");
			el.classList.remove("fade-out");
		}, { once: true });
	}

	async function nextMedia() {
		hideMedia();

		currentMedia++;
		if (currentMedia >= kiosk.media.length) {
			currentMedia = 0;
		}

		showMedia();
	}

	/// Announcements

	const synthesis = window.speechSynthesis;
	function setAnnouncement(a: Announcement) {
		let voices = synthesis.getVoices();
		if (voices.length == 0) {
			console.error("no available voices for speech synthesis");

		} else {
			let utterance = new SpeechSynthesisUtterance(a.text);
			utterance.voice = voices[0];

			synthesis.speak(utterance);
			utterance.addEventListener("end", () => {
				if (announcementCanPlay) {
					synthesis.speak(utterance)
				}
			});
		}

		announcement = a;
		if (a.duration_ms) {
			setTimeout(() => {
				announcement = null;
				synthesis.cancel();
			}, a.duration_ms)
		}
	}

	/// Web Socket Communication

	const webSocket = new WebSocket(kiosk.backend.websocket);
	webSocket.onopen = function(_) {
		webSocket.send(JSON.stringify({ "kiosk": kiosk.id }))
	}
	webSocket.onerror = function(ev) {
		clearKiosk(`websocket error:\n${highlight(ev)}`);
	}
	webSocket.onclose = function(ev) {
		let err = undefined;
		if (!ev.wasClean) {
			err = `connection to backend was closed: ${ev.reason}`
		}
		clearKiosk(err);
	}

	let msgInput = $state('');
	let msgInputDisabled = $state(false);

	webSocket.onmessage = async function(ev) {
		const data = JSON.parse(ev.data);

		if (data.hasOwnProperty("announcement")) {
			let result = AnnouncementSchema.safeParse(data.announcement);
			if (!result.success) {
				return console.error(`invalid announcement\n${z.prettifyError(result.error)}`)
			}
			setAnnouncement(result.data);

		} else if (data.hasOwnProperty("announcement_cancel")) {
			synthesis.cancel();
			announcement = null;

		} else if (data.hasOwnProperty("kiosk_changed")) {
			const changes = data.kiosk_changed;

			if (changes.hasOwnProperty("name")) {
				kiosk.name = changes.name;
			}
			if (changes.hasOwnProperty("chat_placeholder")) {
				kiosk.chat_placeholder = changes.chat_placeholder;
			}
			if (changes.hasOwnProperty("image_duration_ms")) {
				// reset timeout
				if (mediaTimeoutId) {
					clearTimeout(mediaTimeoutId);
					mediaTimeoutId = setTimeout(nextMedia, changes.image_duration_ms);
					kiosk.image_duration_ms = changes.image_duration_ms;
				}
			}

		} else if (data.hasOwnProperty("media_changed")) {
			const result = MediaSchema.safeParse(data.media_changed);
			if (!result.success) {
				return console.error(`invalid media change command\n${z.prettifyError(result.error)}`)
			}

			let idx = kiosk.media.findIndex((m) => m.pk == result.data.pk)
			if (idx === -1) {
				kiosk.media.push(result.data);
				idx = kiosk.media.length - 1;
			} else {
				kiosk.media[idx] = result.data;
			}

			// reset current video if present
			if (kiosk.media[currentMedia].type.startsWith("video")) {
				const element = currentMediaElement()
				if (!element) { return; }

				const video = element.children[0] as HTMLVideoElement | undefined;
				if (video && video.tagName === "VIDEO") {
					video.pause();
					video.currentTime = 0;
				} else {
					console.error(`media at index ${currentMedia} is not a video`);
				}
			}

		} else if (data.hasOwnProperty("media_deleted")) {
			const result = z.int().positive().safeParse(data.media_deleted);
			if (!result.success) {
				return console.error(`invalid media delete command\n${z.prettifyError(result.error)}`)
			}
			const idx = kiosk.media.findIndex((m) => m.pk == result.data)
			if (idx !== -1) {
				kiosk.media.splice(idx, 1); // delete
				await tick(); // wait for DOM update
				if (currentMedia >= kiosk.media.length) {
					currentMedia = 0;
					showMedia();
				}
			}

		} else if (data.hasOwnProperty("message_changed")) {
			const schema = z.object({
				conv: z.int().positive(),
				id: z.int().positive(),
				text: z.string(),
			});
			const result = schema.safeParse(data.message_changed);
			if (!result.success) {
				return console.error(`invalid message change command\n${z.prettifyError(result.error)}`)
			}

			const msg = result.data;
			const conv = kiosk.conversations.find((c) => c.pk == msg.conv)
			if (!conv) {
				return console.error(`message_change: could not find conversation with id ${msg.conv}`)
			}

			const idx = conv.messages.findIndex((m) => m.pk == msg.id)
			if (idx === -1) {
				conv.messages.push({
					pk: msg.id,
					text: msg.text,
					is_usr_msg: false
				})
			} else {
				conv.messages[idx].text = msg.text;
			}

		} else if (data.hasOwnProperty("error")) {
			console.error(data["error"]);

		} else {
			console.error("unknown message:", data);
		}
	}

	/// Chat Bot

	// This is not sent over the websocket to allow for easier error handling.
	async function submitMessage() {
		const message = msgInput.trim();
		if (message === '') { return; }
		msgInputDisabled = true;

		let response;
		try {
			response = await axios.post(`${kiosk.backend.api}/conversation/${conversationId}/`,
				{ text: message, is_usr_msg: true }
			);
			msgInputDisabled = false;
			if (response.status !== 200 || response.data.hasOwnProperty("error")) {
				return console.error(response);
			}
		} catch (error) {
			msgInputDisabled = false;
			return console.error(error);
		}

		if (!response.data.hasOwnProperty("id")) {
			return console.error(`submitMessage: expect response with message id`);
		}

		currentConversation?.messages.push({ pk: response.data.id, text: msgInput, is_usr_msg: true })
		msgInput = '';
	}

	let selectConvDisabled = $state(false);
	async function createConversation() {
		selectConvDisabled = true;

		let response;
		try {
			response = await axios.post(`${kiosk.backend.api}/kiosk/${kiosk.id}/conversation/`);
			selectConvDisabled = false;
			if (response.status !== 200 || !response.data.hasOwnProperty("id")) {
				return console.error(response);
			}
		} catch (error) {
			selectConvDisabled = false;
			return console.error(error);
		}

		conversationId = response.data.id;
		kiosk.conversations.push({ pk: response.data.id, messages: [] })
	}

	/// Sensor Data

	let sensorIntervalId = setInterval(sendSensorData, sendSensorDataInterval) // run every [sendSensorDataInterval] ms
	async function sendSensorData() {
		const data = generateSensorData(kiosk.id);
		webSocket.send(JSON.stringify({ "sensor_data": data }))
	}

	function focusOnCreate(el: HTMLElement) { el.focus(); }
	onMount(() => {
		showMedia();
	})
	onDestroy(() => {
		if (mediaTimeoutId) {
			clearTimeout(mediaTimeoutId);
		}
		clearInterval(sensorIntervalId);
		synthesis.cancel();
		webSocket.close();
	})
</script>

<div id="kiosk-container">
	{#each kiosk.media as item, index}
		<div class={index === 0 ? '' : "hidden"}>
			{#if item.type == "image"}
				<img class="media-img" src={item.src} alt={`image: ${item.src}`}>

			{:else if item.type.startsWith("video")}
				<video class="media-video" id={`video-${index}`}>
					<source src={item.src} type={item.type} />

					Your browser doesn't support HTML video.
					Download it
					<a href={item.src} target="_blank" onclick={() => { nextMedia() }}>
						here
					</a>
				</video>
			{/if}
		</div>
	{:else}
		<div id="no-media">
			<p> No Media </p>
		</div>
	{/each}
</div>

{#if chatbotShown}
	<div id="chat-widget">
		<div id="chat-box">
			{#if conversationId === null}
				<form
					onsubmit={(e) => { e.preventDefault() }}
					id="select-conversation"
				>
					<button onclick={createConversation} disabled={selectConvDisabled} >
						Create New
					</button>
					<select bind:value={conversationId}>
						{#each kiosk.conversations as conv}
							<option value={conv.pk}> {conv.pk} </option>
						{/each}
					</select>
					<button type="button" onclick={() => chatbotShown = false}> Close </button>
				</form>

			{:else}
				<div id="messages">
					{#each currentConversation?.messages as msg}
						<p class={[ 'message-text', { 'is_usr_msg' : msg.is_usr_msg } ]}> { msg.text } </p>
					{/each}
				</div>
				<form id="user-input" onsubmit={(e) => { e.preventDefault(); submitMessage() }}>
					<input
						bind:value={msgInput}
						disabled={msgInputDisabled}
						type="text"
						placeholder={kiosk.chat_placeholder}
						use:focusOnCreate
					/>
					<button type="submit">Send</button>
					<button type="button" onclick={() => conversationId = null}>Exit</button>
				</form>
			{/if}
		</div>
	</div>

{:else}
	<button id="chat-btn" onclick={() => chatbotShown = true}>
		<img src="chat.svg" alt="ChatBot">
	</button>
{/if}

{#if announcement}
	<!-- positioned later in the HTML so that it shows on top -->
	<div class="announcement-wrapper">
		<div class="announcement">
			<h3> { announcement.title } </h3>
			<p> { announcement.text } </p>
		</div>
	</div>
{/if}
