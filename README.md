# ALDaily AI Summarizer

A Chrome extension that adds an **AI Summary** button beside article links on [Arts & Letters Daily](https://www.aldaily.com/). It retrieves article text, asks Groq for a concise summary, and displays the article title and publication/source.

## Features

- Summarizes article links from the ALDaily home page.
- Shows the article title and source, including when a summary cannot be produced.
- Supports a direct page fetch, with a reader-service fallback for pages that block direct requests.
- Lets each user configure their own Groq API key and model in the extension Options page.

## Requirements

- Google Chrome with Manifest V3 extension support.
- A Groq account and API key.
- A chat-completion model enabled for that Groq account. The default model ID is `openai/gpt-oss-20b`; it can be changed in Options.

## Install from this repository

1. Clone or download this repository.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the repository folder containing `manifest.json`.
4. Open the extension's **Details** page, then select **Extension options**.
5. Enter your Groq API key and an enabled Groq model ID, then select **Save settings**.
6. Open or reload [Arts & Letters Daily](https://www.aldaily.com/).
7. Select **AI Summary** beside an article link.

After changing extension files, reload the extension from `chrome://extensions`. After changing only the key or model, save the settings and retry.

## API key storage and GitHub publishing

The API key is entered through the extension Options page and saved as `groqApiKey` in `chrome.storage.local` in that user's Chrome profile. The key is not part of this repository, does not need a local source file, and should never be pasted into `background.js`, committed, or shared publicly. Each person installing the extension supplies their own key and pays for their own Groq usage.

Chrome extension local storage is local to the browser profile, but it is not an encrypted secrets vault. Anyone with access to that profile or the running browser may be able to inspect extension data. Do not use this design to distribute a shared API key. If a key has already been committed or shared, revoke it in Groq and create a replacement.

## Data and permissions

The extension uses Chrome's `storage`, `scripting`, and `tabs` permissions. It requests access to article URLs so it can retrieve their text. Retrieved article text is sent to Groq to generate the summary. If a direct request fails, the extension may request the article through `r.jina.ai` as a reader fallback. Do not use it with content you do not want sent to these services.

## Troubleshooting

- **Missing API key:** Open the extension Options page and save a Groq API key.
- **Model does not exist or is unavailable:** Enter an exact chat model ID shown as enabled for your account in the Groq console.
- **Some articles cannot be summarized:** Publishers may block automated access, require a subscription, or return content that cannot be extracted. The extension still shows the title and source when available.
- **No button appears:** Confirm you are on `https://www.aldaily.com/`, then refresh the page after reloading the extension.
