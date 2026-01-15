# Kiosk Website (Frontend)

## Frameworks

I designed the frontend with [Svelte](https://svelte.dev/). I made this
decision because svelte is the framework I am most familiar with, I have also
used it in another project.

I made use of [Axios](https://axios-http.com/docs/intro) for GET/POST requests,
[Zod](https://zod.dev/) for request data validation and
[Faker](https://fakerjs.dev/) to generate the dummy sensor data.

## Running Locally

Install dependencies with `npm install` (or `pnpm install` or `yarn`), then

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Assumptions

When opened, the Kiosk Website expects a url to the an api endpoint in the
Content Management System which returns a `Kiosk` object with the following
Schema:

```typescript
type KioskType = {
    id: number;
    name: string;
    image_duration_ms: number;
    media: {
        pk: number;
        type: "image" | "video/mp4";
        src: string;
    }[];
    chat_placeholder: string;
    conversations: {
        pk: number;
        messages: {
            pk: number;
            text: string;
            is_usr_msg: boolean;
        }[];
    }[];
    backend: {
        websocket: string;
        api: string;
    };
};
```

_Zod Schema is located in src/lib/types/kiosk.ts_

### Web Socket

The Kiosk connect to the CMS over a websocket using `Kiosk.backend.websocket`.
Immediately after connecting the Kiosk send its Kiosk ID.

The Kiosk listens for these events over the websocket connection:

- "announcement": an announcement was created.
- "announcement_cancel": the current announcement (if present) is removed.

- "kiosk_changed": data in the `Kiosk` object that was changed. NOTE: only "name",
  "chat_placeholder" and "image_duration_ms" can be updated this way.

> This is because "media" and "conversations" are implemented as ForeignKeys,
> and to prevent possibly adding unknown properties.

- "media_changed": new media was created or updated.
- "media_deleted": media was deleted
- "message_changed": a message in a conversation was created or updated.

The Kiosk also sends to the CMS dummy sensor data every 30 seconds.

### Text-to-speech

I made use of the [Speech Synthesis
API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) for
text-to-speech.

It is widely available but may require optional modules not installed by
default.

When an announcement is received from the CMS, it is synthesized (converted
from text to speech) **locally**, the audio is not stored in the CMS.

Only the announcement text is synthesized with the first available voice on the
device.
