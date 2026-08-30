# iris-ext

Chrome extension for Iris. Open the side panel on an application page to scan fields, fill answers from your profile, and review before you submit. It does not submit for you.

Auth uses the same session cookie as [iris-client](https://github.com/SomtoJF/iris-client). Sign in at the client first.

## Run

```bash
cp sample.env .env
pnpm install
pnpm dev
```

In Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → `dist/chrome-mv3-dev`.

That folder is only valid while `pnpm dev` is running. Production build:

```bash
pnpm build
```

Load unpacked from `dist/chrome-mv3`. Manifest changes need the extension removed and re-added.
