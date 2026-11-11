# AI Form-Filler Agent

A browser-console agent that fills multi-step job application forms (Workday, SuccessFactors, Greenhouse, Lever, custom portals) using the Gemini API. It reads the page, asks the LLM what to do next as structured JSON, executes those actions, and repeats. **A human always presses the final Submit.**

> Personal project. Use it on your own applications, and check each site's terms before automating it.

## How it works

1. The script reads every visible form element (including iframes) and turns it into a compact list.
2. It sends that list, the page text, your resume and your profile to Gemini with a strict system prompt.
3. Gemini replies with JSON: `{ "thought": "...", "actions": [ { "do": "type" | "choose" | "check" | "click" | "ask" ... } ] }`.
4. The script runs the actions, waits for the page to settle, and loops (max 80 turns).

## GenAI design choices

- **Structured output:** JSON-only replies, a tolerant parser, and one automatic retry with a correction message.
- **Grounding:** the prompt says never to invent facts. Missing values are asked from the user (`do=ask`) and remembered for the rest of the run.
- **Human in the loop:** `AUTO_SUBMIT = false`. The agent stops before the final Submit. CAPTCHA and OTP are handed to the user.
- **Reliability:** model fallback chain on 429 and 404 errors, request timeouts, backoff on 5xx, and network-error feedback so a failed upload is retried.
- **Session memory:** run state lives in `sessionStorage`, so a page reload does not restart the run.
- **Secrets:** the password is never sent to the LLM. Nothing is stored after the run finishes.

## Setup

1. Edit `RESUME` and `PROFILE` at the top of `form-filler.js` with your own details. **Do not commit your real data.**
2. Leave `PASSWORD` empty (recommended).
3. Get a free Gemini API key from Google AI Studio.
4. Open the application page, open DevTools Console, paste the script, press Enter, and paste your key when asked.

## Limitations

- Single 800-line file. CI only runs a syntax check (`node --check`); there are no behavioural tests yet.
- Some sites block calls to external APIs from the page.
- Free-tier Gemini rate limits can slow long forms.
- It answers legal and background declarations only from your PROFILE. Review every answer before you submit.

## Roadmap

- Split into modules (page reader, LLM client, action executor).
- Add jsdom tests and CI.
- Translate the remaining UI strings to English.
