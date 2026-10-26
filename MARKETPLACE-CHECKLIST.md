# Marketplace publication checklist

## Repository files

Make sure the root of your public GitHub repository contains:

- `passiveAlbumMode.js`
- `manifest.json`
- `README.md`
- `preview.png`

Your existing `install.ps1` may stay in the repository too. Marketplace ignores files it does not need.

## GitHub settings

1. Make the repository **Public**.
2. Open the repository on GitHub.
3. Click the gear icon next to **About**.
4. Add this repository topic exactly:

   `spicetify-extensions`

5. Save the topic.

## Push the Marketplace files

From your local repository:

```powershell
git add passiveAlbumMode.js manifest.json README.md preview.png
git commit -m "Prepare Passive Mode for Spicetify Marketplace"
git push
```

## Verify before waiting for Marketplace discovery

Open the repository on GitHub and verify that:

- `manifest.json` is in the repository root.
- `preview.png` opens normally.
- `passiveAlbumMode.js` opens normally.
- `README.md` renders normally.
- The `spicetify-extensions` topic is visible near the repository description.

## Marketplace discovery

Marketplace discovers public GitHub repositories using the `spicetify-extensions` topic and then reads `manifest.json` from the repository root.

You do not need to submit a pull request to the Marketplace repository for a normal extension.

## Optional improvement

The included `preview.png` is a real screenshot from your current Spotify setup. It demonstrates the album-following use case. Later you can replace it with a screenshot that more clearly shows the Passive Mode, sidebar and Cinema Mode controls. Keep the filename `preview.png` so `manifest.json` does not need to change.
