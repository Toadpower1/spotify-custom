// Passive Mode v3.2 for Spicetify
// Designed to keep working even when the profile-menu API or other extensions differ.
//
// Main features:
// - Passive Mode: follow Album / Artist automatically
// - Adaptive icons (light/dark themes)
// - Hide/show LEFT library sidebar
// - Optional hide/show RIGHT panel
// - Cinema Mode: large art + metadata in the center while keeping right panel
// - Profile menu is OPTIONAL; core extension never waits for it.
//
// Keep the installed filename as: passiveAlbumMode.js

(function passiveModeV32() {
    const CORE_RETRY_MS = 200;

    function coreReady() {
        return !!(
            window.Spicetify?.Player &&
            window.Spicetify?.Platform?.History &&
            window.Spicetify?.URI &&
            window.Spicetify?.LocalStorage &&
            window.Spicetify?.Playbar?.Button
        );
    }

    if (!coreReady()) {
        setTimeout(passiveModeV32, CORE_RETRY_MS);
        return;
    }

    // Prevent double registration after UI reloads / duplicated injection.
    if (window.__PassiveModeV32Loaded) return;
    window.__PassiveModeV32Loaded = true;

    const K_ENABLED = "passiveAlbumMode:enabled";
    const K_FOLLOW = "passiveAlbumMode:follow";
    const K_LEFT = "passiveAlbumMode:leftSidebarCollapsed";
    const K_RIGHT = "passiveAlbumMode:rightSidebarCollapsed";

    const CLASS_LEFT = "pam32-hide-left";
    const CLASS_RIGHT = "pam32-hide-right";
    const STYLE_ID = "pam32-style";
    const OVERLAY_ID = "pam32-cinema";

    let enabled = Spicetify.LocalStorage.get(K_ENABLED) === "true";
    let follow = Spicetify.LocalStorage.get(K_FOLLOW) || "album";
    if (follow !== "artist") follow = "album";

    let leftHidden = Spicetify.LocalStorage.get(K_LEFT) === "true";
    let rightHidden = Spicetify.LocalStorage.get(K_RIGHT) === "true";
    let cinema = false;

    // Save whatever the theme/other extensions had configured.
    const root = document.documentElement;
    const originalLeftVar = {
        value: root.style.getPropertyValue("--left-sidebar-width"),
        priority: root.style.getPropertyPriority("--left-sidebar-width")
    };
    const originalRightVar = {
        value: root.style.getPropertyValue("--right-sidebar-width"),
        priority: root.style.getPropertyPriority("--right-sidebar-width")
    };

    const ALBUM_ICON = `<path fill="currentColor" fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 2.25a7.25 7.25 0 1 1 0 14.5 7.25 7.25 0 0 1 0-14.5Zm0 4.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Zm0 1.75a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>`;

    const LEFT_ICON = `<path fill="currentColor" fill-rule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15Zm2 0v15h4v-15H5Zm6 0v15h8v-15h-8Z"/>`;

    const RIGHT_ICON = `<path fill="currentColor" fill-rule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15Zm2 0v15h8v-15H5Zm10 0v15h4v-15h-4Z"/>`;

    const CINEMA_ICON = `<path fill="currentColor" d="M4 3h5v2H5v4H3V4a1 1 0 0 1 1-1Zm11 0h5a1 1 0 0 1 1 1v5h-2V5h-4V3ZM3 15h2v4h4v2H4a1 1 0 0 1-1-1v-5Zm16 0h2v5a1 1 0 0 1-1 1h-5v-2h4v-4Z"/>`;

    installCss();

    // ---------- Theme-compatible sidebar control ----------

    function restoreRootVar(name, saved) {
        if (saved.value) {
            root.style.setProperty(name, saved.value, saved.priority || "");
        } else {
            root.style.removeProperty(name);
        }
    }

    function applySidebars() {
        const effectiveLeftHidden = leftHidden || cinema;

        root.classList.toggle(CLASS_LEFT, effectiveLeftHidden);
        root.classList.toggle(CLASS_RIGHT, rightHidden);

        // Spotify currently uses these variables for the grid widths.
        // Keeping them in sync also helps when a theme uses the same vars.
        if (effectiveLeftHidden) {
            root.style.setProperty("--left-sidebar-width", "0px", "important");
        } else {
            restoreRootVar("--left-sidebar-width", originalLeftVar);
        }

        if (rightHidden) {
            root.style.setProperty("--right-sidebar-width", "0px", "important");
        } else {
            restoreRootVar("--right-sidebar-width", originalRightVar);
        }

        // Force a reflow so themes which calculate panel layout update now.
        void document.body?.offsetWidth;

        requestAnimationFrame(() => {
            positionCinema();
            refreshButtons();
        });
    }

    function installCss() {
        document.getElementById("pam-v2-styles")?.remove();
        document.getElementById("pam-v3-styles")?.remove();
        document.getElementById("pam31-style")?.remove();

        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            /* Custom buttons follow Spotify/Spicetify theme text colors. */
            .pam32-button {
                color: var(--spice-subtext, var(--text-subdued, currentColor)) !important;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
            }
            .pam32-button:hover {
                color: var(--spice-text, var(--text-base, currentColor)) !important;
            }
            .pam32-button svg,
            .pam32-button svg path {
                color: inherit !important;
                fill: currentColor !important;
            }

            /* Current Spotify desktop IDs + semantic Spicetify fallbacks. */
            html.${CLASS_LEFT} #Desktop_LeftSidebar_Id,
            html.${CLASS_LEFT} .Root__nav-bar {
                display: none !important;
                width: 0 !important;
                min-width: 0 !important;
                max-width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                opacity: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            html.${CLASS_RIGHT} #Desktop_PanelContainer_Id,
            html.${CLASS_RIGHT} .Root__right-sidebar {
                display: none !important;
                width: 0 !important;
                min-width: 0 !important;
                max-width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                opacity: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            html.${CLASS_LEFT} #Desktop_LeftSidebar_Id .LayoutResizer__resize-bar,
            html.${CLASS_LEFT} .Root__nav-bar .LayoutResizer__resize-bar,
            html.${CLASS_RIGHT} #Desktop_PanelContainer_Id .LayoutResizer__resize-bar,
            html.${CLASS_RIGHT} .Root__right-sidebar .LayoutResizer__resize-bar {
                display: none !important;
            }

            /* Cinema is a standalone overlay, so it is not tied to Spotify's
               React main-view hierarchy and survives most themes/extensions. */
            #${OVERLAY_ID} {
                position: fixed;
                display: none;
                z-index: 99990;
                overflow: hidden;
                isolation: isolate;
                color: #fff;
                border-radius: 8px;
                background: #101012;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
            }

            #${OVERLAY_ID}.active {
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #${OVERLAY_ID} .pam32-bg {
                position: absolute;
                inset: -55px;
                z-index: -3;
                background-size: cover;
                background-position: center;
                filter: blur(46px) saturate(1.35);
                transform: scale(1.12);
                opacity: .75;
            }

            #${OVERLAY_ID} .pam32-shade {
                position: absolute;
                inset: 0;
                z-index: -2;
                background:
                    radial-gradient(circle at 25% 40%, rgba(255,255,255,.12), transparent 33%),
                    linear-gradient(105deg, rgba(5,5,8,.35), rgba(5,5,8,.76));
                backdrop-filter: blur(2px);
            }

            #${OVERLAY_ID} .pam32-content {
                width: min(1120px, 90%);
                display: grid;
                grid-template-columns: minmax(220px, min(40vw, 53vh)) minmax(0, 1fr);
                gap: clamp(28px, 5vw, 70px);
                align-items: center;
            }

            #${OVERLAY_ID} .pam32-cover {
                width: 100%;
                aspect-ratio: 1;
                object-fit: cover;
                border-radius: 14px;
                box-shadow: 0 28px 90px rgba(0,0,0,.5);
                background: rgba(255,255,255,.07);
            }

            #${OVERLAY_ID} .pam32-eyebrow {
                margin-bottom: 14px;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: .18em;
                text-transform: uppercase;
                opacity: .72;
            }

            #${OVERLAY_ID} .pam32-title {
                margin: 0;
                font-size: clamp(34px, 5vw, 76px);
                line-height: .98;
                letter-spacing: -.04em;
                overflow-wrap: anywhere;
                text-shadow: 0 2px 18px rgba(0,0,0,.25);
            }

            #${OVERLAY_ID} .pam32-artist {
                margin-top: 20px;
                font-size: clamp(19px, 2.1vw, 31px);
                font-weight: 700;
            }

            #${OVERLAY_ID} .pam32-album {
                margin-top: 7px;
                font-size: 16px;
                opacity: .72;
            }

            #${OVERLAY_ID} .pam32-progress {
                margin-top: 30px;
                height: 4px;
                border-radius: 99px;
                overflow: hidden;
                background: rgba(255,255,255,.23);
            }

            #${OVERLAY_ID} .pam32-fill {
                width: 0%;
                height: 100%;
                border-radius: inherit;
                background: #fff;
            }

            #${OVERLAY_ID} .pam32-times {
                margin-top: 8px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                font-variant-numeric: tabular-nums;
                opacity: .72;
            }

            #${OVERLAY_ID} .pam32-hint {
                margin-top: 25px;
                font-size: 12px;
                opacity: .52;
            }

            @media (max-width: 760px), (max-height: 600px) {
                #${OVERLAY_ID} .pam32-content {
                    grid-template-columns: minmax(170px, 34vh) minmax(0, 1fr);
                    gap: 26px;
                }

                #${OVERLAY_ID} .pam32-title {
                    font-size: clamp(28px, 5vw, 50px);
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ---------- Passive navigation ----------

    const METADATA_RETRIES = 16;
    const METADATA_RETRY_MS = 125;

    function getTargetUri(item) {
        const m = item?.metadata || {};

        if (follow === "artist") {
            return m.artist_uri || m.artist_uri_0 || null;
        }

        return m.album_uri || null;
    }

    function uriToPath(uri) {
        if (!uri) return null;

        try {
            const parsed = Spicetify.URI.from(uri);
            if (!parsed) return null;

            const wanted =
                follow === "artist"
                    ? Spicetify.URI.Type.ARTIST
                    : Spicetify.URI.Type.ALBUM;

            if (parsed.type !== wanted) return null;
            return parsed.toURLPath(true);
        } catch (error) {
            console.warn("[Passive Mode v3.2] URI error", error);
            return null;
        }
    }

    function followTrack(trackUri, eventItem, attempt = 0) {
        if (!enabled || !trackUri) return;

        const current = Spicetify.Player.data?.item;
        if (!current || current.uri !== trackUri) return;

        const item =
            eventItem?.uri === trackUri && getTargetUri(eventItem)
                ? eventItem
                : current;

        const targetUri = getTargetUri(item);

        if (!targetUri) {
            if (
                trackUri.startsWith("spotify:track:") &&
                attempt < METADATA_RETRIES
            ) {
                setTimeout(
                    () => followTrack(trackUri, null, attempt + 1),
                    METADATA_RETRY_MS
                );
            }
            return;
        }

        const path = uriToPath(targetUri);
        if (!path) return;

        if (Spicetify.Platform.History.location?.pathname !== path) {
            Spicetify.Platform.History.push(path);
        }
    }

    function followCurrent() {
        const item = Spicetify.Player.data?.item;
        if (item?.uri) followTrack(item.uri, item);
    }

    // ---------- Cinema ----------

    function ensureOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = `
            <div class="pam32-bg"></div>
            <div class="pam32-shade"></div>
            <div class="pam32-content">
                <img class="pam32-cover" alt="">
                <div>
                    <div class="pam32-eyebrow">Now playing</div>
                    <h1 class="pam32-title">Nothing playing</h1>
                    <div class="pam32-artist"></div>
                    <div class="pam32-album"></div>
                    <div class="pam32-progress">
                        <div class="pam32-fill"></div>
                    </div>
                    <div class="pam32-times">
                        <span class="pam32-current">0:00</span>
                        <span class="pam32-total">0:00</span>
                    </div>
                    <div class="pam32-hint">Esc · exit Cinema Mode</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    function findMainView() {
        return (
            document.querySelector(".Root__main-view") ||
            document.querySelector("[data-testid='main-view-container']") ||
            document.querySelector(".main-view-container") ||
            document.querySelector("#main main") ||
            document.querySelector("#main")
        );
    }

    function findRightPanel() {
        return (
            document.querySelector("#Desktop_PanelContainer_Id") ||
            document.querySelector(".Root__right-sidebar")
        );
    }

    function findPlayerBar() {
        return (
            document.querySelector(".Root__now-playing-bar") ||
            document.querySelector(".main-nowPlayingBar-container")
        );
    }

    function findGlobalNav() {
        return (
            document.querySelector(".Root__globalNav") ||
            document.querySelector("[data-testid='global-nav-bar']")
        );
    }

    function positionCinema() {
        const overlay = ensureOverlay();
        overlay.classList.toggle("active", cinema);

        if (!cinema) return;

        const main = findMainView();
        let rect = main?.getBoundingClientRect();

        if (!rect || rect.width < 150 || rect.height < 150) {
            const top = findGlobalNav()?.getBoundingClientRect();
            const player = findPlayerBar()?.getBoundingClientRect();
            const right = !rightHidden
                ? findRightPanel()?.getBoundingClientRect()
                : null;

            const topY = top?.bottom ?? 60;
            const bottomY = player?.top ?? innerHeight - 90;
            const rightX =
                right && right.width > 10 ? right.left : innerWidth;

            rect = {
                left: 8,
                top: topY + 6,
                width: Math.max(200, rightX - 14),
                height: Math.max(200, bottomY - topY - 12)
            };
        }

        overlay.style.left = `${Math.max(0, rect.left)}px`;
        overlay.style.top = `${Math.max(0, rect.top)}px`;
        overlay.style.width = `${Math.max(200, rect.width)}px`;
        overlay.style.height = `${Math.max(200, rect.height)}px`;
    }

    function imageUrl(item) {
        const m = item?.metadata || {};

        let url =
            m.image_xlarge_url ||
            m.image_large_url ||
            m.image_url ||
            item?.images?.[0]?.url ||
            "";

        if (url.startsWith("spotify:image:")) {
            url = `https://i.scdn.co/image/${url.slice("spotify:image:".length)}`;
        }

        return url;
    }

    function artistName(item) {
        const m = item?.metadata || {};

        return (
            m.artist_name ||
            item?.artists
                ?.map((artist) => artist?.name)
                .filter(Boolean)
                .join(", ") ||
            ""
        );
    }

    function albumName(item) {
        const m = item?.metadata || {};
        return m.album_title || item?.album?.name || "";
    }

    function formatMs(ms) {
        const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${minutes}:${seconds}`;
    }

    function updateCinemaTrack() {
        if (!cinema) return;

        const overlay = ensureOverlay();
        const item = Spicetify.Player.data?.item;
        if (!item) return;

        overlay.querySelector(".pam32-title").textContent =
            item.name || item.metadata?.title || "Unknown track";
        overlay.querySelector(".pam32-artist").textContent = artistName(item);
        overlay.querySelector(".pam32-album").textContent = albumName(item);

        const art = imageUrl(item);
        const cover = overlay.querySelector(".pam32-cover");
        const bg = overlay.querySelector(".pam32-bg");

        if (art) {
            cover.src = art;
            cover.style.visibility = "visible";
            bg.style.backgroundImage =
                `url("${art.replace(/"/g, '\\"')}")`;
        } else {
            cover.removeAttribute("src");
            cover.style.visibility = "hidden";
            bg.style.backgroundImage = "none";
        }

        updateProgress();
    }

    function updateProgress() {
        if (!cinema) return;

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;

        const duration = Math.max(
            0,
            Number(Spicetify.Player.getDuration?.() || 0)
        );
        const progress = Math.max(
            0,
            Number(Spicetify.Player.getProgress?.() || 0)
        );

        const percent =
            duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

        overlay.querySelector(".pam32-fill").style.width = `${percent}%`;
        overlay.querySelector(".pam32-current").textContent =
            formatMs(progress);
        overlay.querySelector(".pam32-total").textContent =
            formatMs(duration);
    }

    // ---------- Buttons ----------

    function passiveLabel() {
        return `Passive Mode: ${enabled ? "On" : "Off"} · ${
            follow === "artist" ? "Artist" : "Album"
        }`;
    }

    const passiveButton = new Spicetify.Playbar.Button(
        passiveLabel(),
        ALBUM_ICON,
        () => setEnabled(!enabled, true),
        false,
        enabled
    );

    const leftButton = new Spicetify.Playbar.Button(
        leftHidden ? "Show left sidebar" : "Hide left sidebar",
        LEFT_ICON,
        () => setLeft(!leftHidden, true),
        false,
        leftHidden
    );

    const cinemaButton = new Spicetify.Playbar.Button(
        "Cinema Mode",
        CINEMA_ICON,
        () => setCinema(!cinema, true),
        false,
        cinema
    );

    // Don't let a missing element break the entire extension.
    for (const button of [passiveButton, leftButton, cinemaButton]) {
        try {
            button.element?.classList?.add("pam32-button");
        } catch {}
    }

    // Useful shortcuts without relying on the profile menu:
    // right-click Passive = Album/Artist
    // right-click Left Sidebar = toggle RIGHT sidebar
    try {
        passiveButton.element?.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            setFollow(follow === "album" ? "artist" : "album", true);
        });

        leftButton.element?.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            setRight(!rightHidden, true);
        });
    } catch {}

    function refreshButtons() {
        passiveButton.active = enabled;
        passiveButton.label = passiveLabel();

        leftButton.active = leftHidden || cinema;
        leftButton.label = cinema
            ? "Left sidebar hidden by Cinema Mode · right-click: right sidebar"
            : `${
                  leftHidden ? "Show" : "Hide"
              } left sidebar · right-click: right sidebar`;

        cinemaButton.active = cinema;
        cinemaButton.label = cinema
            ? "Exit Cinema Mode"
            : "Cinema Mode";
    }

    // ---------- State setters ----------

    function setEnabled(value, notify = false) {
        enabled = Boolean(value);
        Spicetify.LocalStorage.set(K_ENABLED, String(enabled));
        refreshButtons();
        syncMenu();

        if (notify) {
            Spicetify.showNotification(
                enabled
                    ? `Passive Mode aan · ${
                          follow === "artist" ? "artiest" : "album"
                      }`
                    : "Passive Mode uit"
            );
        }

        if (enabled) followCurrent();
    }

    function setFollow(value, notify = false) {
        follow = value === "artist" ? "artist" : "album";
        Spicetify.LocalStorage.set(K_FOLLOW, follow);
        refreshButtons();
        syncMenu();

        if (notify) {
            Spicetify.showNotification(
                follow === "artist"
                    ? "Passive Mode volgt nu artiesten"
                    : "Passive Mode volgt nu albums"
            );
        }

        if (enabled) followCurrent();
    }

    function setLeft(value, notify = false) {
        leftHidden = Boolean(value);
        Spicetify.LocalStorage.set(K_LEFT, String(leftHidden));
        applySidebars();
        syncMenu();

        if (notify) {
            Spicetify.showNotification(
                leftHidden
                    ? "Linker sidebar verborgen"
                    : "Linker sidebar zichtbaar"
            );
        }
    }

    function setRight(value, notify = false) {
        rightHidden = Boolean(value);
        Spicetify.LocalStorage.set(K_RIGHT, String(rightHidden));
        applySidebars();
        syncMenu();

        if (notify) {
            Spicetify.showNotification(
                rightHidden
                    ? "Rechter sidebar verborgen"
                    : "Rechter sidebar zichtbaar"
            );
        }
    }

    function setCinema(value, notify = false) {
        cinema = Boolean(value);

        const overlay = ensureOverlay();
        overlay.classList.toggle("active", cinema);

        applySidebars();

        if (cinema) {
            requestAnimationFrame(() => {
                updateCinemaTrack();
                positionCinema();
            });
        }

        refreshButtons();
        syncMenu();

        if (notify) {
            Spicetify.showNotification(
                cinema
                    ? "Cinema Mode aan · Esc om af te sluiten"
                    : "Cinema Mode uit"
            );
        }
    }

    // ---------- OPTIONAL profile menu ----------
    // The extension must keep working even if this API is absent/broken.

    let menuObjects = null;
    let menuRegistered = false;

    function tryRegisterMenu() {
        if (menuRegistered) return;

        if (!window.Spicetify?.Menu?.Item || !window.Spicetify?.Menu?.SubMenu) {
            return;
        }

        try {
            const mPassive = new Spicetify.Menu.Item(
                "Passive Mode",
                enabled,
                () => setEnabled(!enabled, true),
                ALBUM_ICON
            );

            const mAlbum = new Spicetify.Menu.Item(
                "Follow album",
                follow === "album",
                () => setFollow("album", true)
            );

            const mArtist = new Spicetify.Menu.Item(
                "Follow artist",
                follow === "artist",
                () => setFollow("artist", true)
            );

            const mLeft = new Spicetify.Menu.Item(
                "Hide left sidebar",
                leftHidden,
                () => setLeft(!leftHidden, true),
                LEFT_ICON
            );

            const mRight = new Spicetify.Menu.Item(
                "Hide right sidebar",
                rightHidden,
                () => setRight(!rightHidden, true),
                RIGHT_ICON
            );

            const mCinema = new Spicetify.Menu.Item(
                "Cinema Mode",
                cinema,
                () => setCinema(!cinema, true),
                CINEMA_ICON
            );

            const menu = new Spicetify.Menu.SubMenu("Passive Mode v3.2", [
                mPassive,
                mAlbum,
                mArtist,
                mLeft,
                mRight,
                mCinema
            ]);

            menu.register();

            menuObjects = {
                mPassive,
                mAlbum,
                mArtist,
                mLeft,
                mRight,
                mCinema,
                menu
            };

            menuRegistered = true;
            console.log("[Passive Mode v3.2] Profile menu registered");
        } catch (error) {
            console.warn(
                "[Passive Mode v3.2] Profile menu unavailable; core controls still work",
                error
            );
        }
    }

    function syncMenu() {
        if (!menuObjects) return;

        try {
            menuObjects.mPassive.setState(enabled);
            menuObjects.mAlbum.setState(follow === "album");
            menuObjects.mArtist.setState(follow === "artist");
            menuObjects.mLeft.setState(leftHidden);
            menuObjects.mRight.setState(rightHidden);
            menuObjects.mCinema.setState(cinema);
        } catch {}
    }

    // Retry menu registration separately. It can fail forever without harming core.
    let menuAttempts = 0;
    const menuTimer = setInterval(() => {
        menuAttempts += 1;
        tryRegisterMenu();

        if (menuRegistered || menuAttempts >= 120) {
            clearInterval(menuTimer);
        }
    }, 500);

    tryRegisterMenu();

    // ---------- Events ----------

    Spicetify.Player.addEventListener("songchange", (event) => {
        const item = event?.data?.item || Spicetify.Player.data?.item;

        if (enabled && item?.uri) {
            followTrack(item.uri, item, 0);
        }

        if (cinema) {
            setTimeout(updateCinemaTrack, 0);
        }
    });

    try {
        Spicetify.Player.addEventListener("onprogress", updateProgress);
    } catch {}

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape" && cinema) {
                event.preventDefault();
                setCinema(false, false);
            }
        },
        true
    );

    window.addEventListener("resize", () => {
        if (cinema) positionCinema();
    });

    // React/extension remounts can recreate sidebar DOM.
    let remountTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(remountTimer);
        remountTimer = setTimeout(() => {
            applySidebars();

            if (cinema) {
                updateCinemaTrack();
                positionCinema();
            }
        }, 120);
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Progress fallback.
    setInterval(() => {
        if (cinema) {
            updateProgress();
            positionCinema();
        }
    }, 500);

    // Small diagnostic API for troubleshooting without editing the file.
    window.PassiveModeV32 = {
        debug() {
            const info = {
                version: "3.2",
                enabled,
                follow,
                leftHidden,
                rightHidden,
                cinema,
                menuAPI: !!window.Spicetify?.Menu?.SubMenu,
                menuRegistered,
                leftElement: !!(
                    document.querySelector("#Desktop_LeftSidebar_Id") ||
                    document.querySelector(".Root__nav-bar")
                ),
                rightElement: !!(
                    document.querySelector("#Desktop_PanelContainer_Id") ||
                    document.querySelector(".Root__right-sidebar")
                ),
                mainElement: !!findMainView(),
                leftWidthVar:
                    getComputedStyle(document.documentElement)
                        .getPropertyValue("--left-sidebar-width")
                        .trim(),
                rightWidthVar:
                    getComputedStyle(document.documentElement)
                        .getPropertyValue("--right-sidebar-width")
                        .trim()
            };

            console.table(info);
            return info;
        },
        toggleLeft: () => setLeft(!leftHidden, true),
        toggleRight: () => setRight(!rightHidden, true),
        toggleCinema: () => setCinema(!cinema, true)
    };

    ensureOverlay();
    applySidebars();
    refreshButtons();

    console.log(
        "[Passive Mode v3.2] Core loaded successfully. " +
        "Right-click Passive = Album/Artist; right-click Left Sidebar = Right Sidebar."
    );
})();
