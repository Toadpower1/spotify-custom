# Passive Mode for Spicetify

Passive Mode automatically follows what you are listening to in Spotify and adds a few compact playback-focused controls.

## Features

- **Passive Mode** — automatically opens the currently playing track's album or artist page when the track changes.
- **Album / Artist follow mode** — right-click the Passive Mode button to switch between following albums and artists.
- **Left sidebar toggle** — quickly hide or restore Spotify's left library sidebar.
- **Right sidebar toggle** — right-click the left-sidebar button to hide or restore the right panel.
- **Cinema Mode** — shows large artwork and track metadata in a focused overlay while keeping playback controls available.
- **Theme-friendly icons** — icons use the current Spotify/Spicetify text color.
- **Persistent preferences** — Passive Mode, follow target, and sidebar state are stored with Spicetify LocalStorage.
- **Optional profile menu** — when `Spicetify.Menu.SubMenu` is available, the same controls also appear under the profile menu.
- **Debug helper** — run `PassiveModeV32.debug()` in Spotify DevTools when troubleshooting.

## Controls

| Control | Left click | Right click |
| --- | --- | --- |
| Passive Mode | Toggle Passive Mode | Switch Album / Artist |
| Left Sidebar | Hide / show left sidebar | Hide / show right sidebar |
| Cinema Mode | Enter / exit Cinema Mode | — |

Press **Esc** to exit Cinema Mode.

## Install from Marketplace

Once this repository is indexed by Spicetify Marketplace:

1. Open **Marketplace** in Spotify.
2. Search for **Passive Mode**.
3. Click **Install**.
4. Reload/apply Spicetify if Marketplace asks you to.

## Manual installation

Copy `passiveAlbumMode.js` into your Spicetify Extensions directory.

On Windows this is normally:

```text
%APPDATA%\spicetify\Extensions\
```

Then run:

```powershell
spicetify config extensions passiveAlbumMode.js
spicetify apply
```

If the extension is already configured, replacing the file and running this is enough:

```powershell
spicetify apply
```

## Troubleshooting

If the extension does not appear, first make sure Spicetify itself is applied correctly.

For diagnostics, enable Spotify DevTools and run:

```js
PassiveModeV32.debug()
```

The output shows which sidebar and main-view elements were detected.

Spotify can change its internal UI structure without notice. Passive Mode uses several current Spotify/Spicetify hooks and fallbacks, but a future Spotify update may still require an extension update.

## Version

Current Marketplace package: **Passive Mode v3.2**

## Disclaimer

This is a community Spicetify extension and is not affiliated with Spotify or Spicetify.
