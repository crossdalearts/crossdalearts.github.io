const navbar = document.getElementById("navbar");
const navToggle = navbar ? navbar.querySelector(".nav-toggle") : null;

if (navbar && navToggle) {
    const closeNavMenu = () => {
        navbar.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
    };

    const openNavMenu = () => {
        navbar.classList.add("nav-open");
        navToggle.setAttribute("aria-expanded", "true");
    };

    navToggle.addEventListener("click", () => {
        const isOpen = navbar.classList.contains("nav-open");
        if (isOpen) closeNavMenu();
        else openNavMenu();
    });

    document.addEventListener("click", (event) => {
        if (window.innerWidth > 980) return;
        if (!navbar.classList.contains("nav-open")) return;
        if (navbar.contains(event.target)) return;
        closeNavMenu();
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeNavMenu();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) {
            closeNavMenu();
        }
    });
}

document.querySelectorAll("#navbar a").forEach((link) => {
    link.addEventListener("click", () => {
        if (!navbar || !navToggle || window.innerWidth > 980) return;
        navbar.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
    });
});

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "ogg", "ogv", "m4v"]);
const GALLERY_META_URL = "data/gallery-media.json";

function getFileExtension(path = "") {
    const cleanPath = path.split("?")[0].split("#")[0];
    const parts = cleanPath.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getGalleryStemInfo(path = "") {
    const cleanPath = path.split("?")[0].split("#")[0];
    const fileName = cleanPath.split("/").pop() || "";
    const match = fileName.match(/^(gallery-(image|video)-(\d+))\..+$/i);
    if (!match) return null;
    return {
        stem: match[1].toLowerCase(),
        type: match[2].toLowerCase(),
        index: Number(match[3]),
        fileName
    };
}

function getGalleryAssetKindFromPath(path = "") {
    const info = getGalleryStemInfo(path);
    return info ? info.type : "";
}

function getGalleryTitle(item) {
    const explicitTitle = String(item.title || "").trim();
    if (explicitTitle) return explicitTitle;

    const info = getGalleryStemInfo(item.src || "");
    if (!info) return item.alt || "Gallery item";
    return `${info.type === "video" ? "Video" : "Artwork"} ${info.index}`;
}

function inferMediaType(item) {
    const namedType = getGalleryAssetKindFromPath(item.src || "");
    if (namedType) return namedType;
    if (item.type === "video" || item.type === "image") return item.type;
    return VIDEO_EXTENSIONS.has(getFileExtension(item.src || "")) ? "video" : "image";
}

function normalizeVideoSources(item) {
    if (Array.isArray(item.sources) && item.sources.length > 0) {
        return item.sources
            .map((source) => {
                if (typeof source === "string") return { src: source, type: "" };
                if (!source || !source.src) return null;
                return { src: source.src, type: source.type || "" };
            })
            .filter(Boolean);
    }
    if (item.src) {
        return buildFallbackSources(item.src).map((src) => ({ src, type: "" }));
    }
    return [];
}

function buildGalleryItem(item) {
    const type = inferMediaType(item);
    const titledItem = {
        ...item,
        alt: getGalleryTitle(item),
        title: getGalleryTitle(item),
        category: item.category || (type === "video" ? "Video" : "Artwork")
    };
    if (type === "video") {
        return {
            ...titledItem,
            type,
            sources: normalizeVideoSources(titledItem)
        };
    }
    return { ...titledItem, type };
}

async function probeImageSource(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
    });
}

async function probeVideoSource(src) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        let settled = false;

        const cleanup = (result) => {
            if (settled) return;
            settled = true;
            video.removeAttribute("src");
            video.load();
            resolve(result);
        };

        const timeoutId = window.setTimeout(() => cleanup(false), 3200);

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
            window.clearTimeout(timeoutId);
            cleanup(true);
        };
        video.onerror = () => {
            window.clearTimeout(timeoutId);
            cleanup(false);
        };
        video.src = src;
    });
}

async function loadGalleryConfig() {
    try {
        const response = await fetch(GALLERY_META_URL, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Gallery metadata fetch failed");
        const data = await response.json();

        const normalizedCategories = Array.isArray(data?.categories)
            ? data.categories
                .filter((category) => category && typeof category === "object")
                .map((category) => ({
                    name: String(category.name || category.category || "").trim() || "Uncategorized",
                    preview: category.preview && typeof category.preview === "object"
                        ? category.preview
                        : null,
                    items: Array.isArray(category.items) ? category.items : []
                }))
            : [];

        // Backward compatibility for the old flat structure.
        if (!normalizedCategories.length && Array.isArray(data?.items)) {
            const legacyMap = new Map();

            data.items.forEach((item) => {
                if (!item || typeof item !== "object") return;
                const categoryName = String(item.category || "").trim() || "Uncategorized";
                if (!legacyMap.has(categoryName)) {
                    legacyMap.set(categoryName, {
                        name: categoryName,
                        preview: null,
                        items: []
                    });
                }
                legacyMap.get(categoryName).items.push(item);
            });

            normalizedCategories.push(...legacyMap.values());
        }

        return {
            homepagePreview: data?.homepage_preview && typeof data.homepage_preview === "object"
                ? data.homepage_preview
                : null,
            categories: normalizedCategories
        };
    } catch (_) {
        return {
            homepagePreview: null,
            categories: []
        };
    }
}

async function loadGalleryItems() {
    const config = await loadGalleryConfig();
    const categories = [];
    const items = [];

    for (const category of config.categories) {
        const validEntries = category.items.filter((item) => item && typeof item.path === "string");
        const checks = validEntries.map(async (item) => {
            const src = String(item.path || "").trim().replace(/\\/g, "/");
            const type = String(item.type || "").trim().toLowerCase();
            const title = String(item.title || "").trim();

            if (!src) return null;
            if (type !== "image" && type !== "video") return null;

            const exists = type === "video"
                ? await probeVideoSource(src)
                : await probeImageSource(src);

            if (!exists) return null;

            return buildGalleryItem({
                src,
                type,
                title,
                category: category.name
            });
        });

        const resolvedItems = (await Promise.all(checks)).filter(Boolean);
        if (!resolvedItems.length) continue;

        let previewItem = null;
        if (category.preview) {
            const previewSrc = String(category.preview.path || "").trim().replace(/\\/g, "/");
            const previewType = String(category.preview.type || "").trim().toLowerCase();
            const previewTitle = String(category.preview.title || "").trim();

            if (previewSrc && (previewType === "image" || previewType === "video")) {
                const exists = previewType === "video"
                    ? await probeVideoSource(previewSrc)
                    : await probeImageSource(previewSrc);

                if (exists) {
                    previewItem = buildGalleryItem({
                        src: previewSrc,
                        type: previewType,
                        title: previewTitle,
                        category: category.name
                    });
                }
            }
        }

        categories.push({
            name: category.name,
            thumbnailItem: previewItem || resolvedItems[0],
            items: resolvedItems
        });
        items.push(...resolvedItems);
    }

    let homepagePreview = null;
    if (config.homepagePreview) {
        const directPreview = config.homepagePreview.preview;
        if (directPreview && typeof directPreview === "object") {
            const previewSrc = String(directPreview.path || "").trim().replace(/\\/g, "/");
            const previewType = String(directPreview.type || "").trim().toLowerCase();
            const previewTitle = String(directPreview.title || "").trim();

            if (previewSrc && (previewType === "image" || previewType === "video")) {
                const exists = previewType === "video"
                    ? await probeVideoSource(previewSrc)
                    : await probeImageSource(previewSrc);

                if (exists) {
                    homepagePreview = buildGalleryItem({
                        src: previewSrc,
                        type: previewType,
                        title: previewTitle
                    });
                }
            }
        }

        if (!homepagePreview) {
            const previewCategoryName = String(config.homepagePreview.category || "").trim();
            const matchedCategory = categories.find((category) => category.name === previewCategoryName);
            if (matchedCategory && matchedCategory.items[0]) {
                homepagePreview = matchedCategory.items[0];
            }
        }
    }

    return {
        homepagePreview,
        categories,
        items
    };
}

function renderGalleryPreviewMedia(item, imageLoading = "lazy") {
    const mediaEl = item.type === "video" ? document.createElement("video") : document.createElement("img");
    mediaEl.className = "gallery-preview-media";

    if (item.type === "video") {
        setVideoSources(mediaEl, item.sources, () => {});
        mediaEl.muted = true;
        mediaEl.defaultMuted = true;
        mediaEl.loop = true;
        mediaEl.autoplay = true;
        mediaEl.playsInline = true;
        mediaEl.preload = "auto";
        mediaEl.setAttribute("muted", "");
        mediaEl.setAttribute("autoplay", "");
        mediaEl.setAttribute("playsinline", "");
        mediaEl.setAttribute("aria-hidden", "true");
        mediaEl.addEventListener("canplay", () => {
            mediaEl.play().catch(() => {});
        });
        mediaEl.addEventListener("loadeddata", () => {
            mediaEl.play().catch(() => {});
        });
    } else {
        mediaEl.src = item.src;
        mediaEl.alt = item.title || "Gallery preview";
        mediaEl.loading = imageLoading;
        mediaEl.decoding = "async";
    }

    return mediaEl;
}

function createGalleryBrowserModal() {
    const existing = document.getElementById("gallery-browser-modal");
    if (existing) {
        return {
            root: existing,
            box: existing.querySelector(".gallery-browser-box"),
            grid: existing.querySelector(".gallery-browser-grid"),
            title: existing.querySelector(".gallery-browser-title"),
            closeBtn: existing.querySelector(".gallery-browser-close"),
            backBtn: existing.querySelector(".gallery-browser-back"),
            fullscreenBtn: existing.querySelector(".gallery-browser-fullscreen"),
            counter: existing.querySelector(".gallery-browser-count")
        };
    }

    const root = document.createElement("div");
    root.id = "gallery-browser-modal";
    root.className = "gallery-browser-modal";
    root.setAttribute("aria-hidden", "true");

    const box = document.createElement("div");
    box.className = "gallery-browser-box";

    const header = document.createElement("div");
    header.className = "gallery-browser-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "gallery-browser-title-wrap";

    const title = document.createElement("h3");
    title.className = "gallery-browser-title";
    title.textContent = "CrossdaleArts Gallery";

    const counter = document.createElement("p");
    counter.className = "gallery-browser-count";
    counter.textContent = "0 works";

    titleWrap.appendChild(title);
    titleWrap.appendChild(counter);

    const actions = document.createElement("div");
    actions.className = "gallery-browser-actions";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "gallery-browser-back";
    backBtn.textContent = "Back";
    backBtn.hidden = true;

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "gallery-browser-fullscreen";
    fullscreenBtn.textContent = "Full Screen";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "gallery-browser-close";
    closeBtn.textContent = "Close";

    actions.appendChild(backBtn);
    actions.appendChild(fullscreenBtn);
    actions.appendChild(closeBtn);
    header.appendChild(titleWrap);
    header.appendChild(actions);

    const grid = document.createElement("div");
    grid.className = "gallery-browser-grid";

    box.appendChild(header);
    box.appendChild(grid);
    root.appendChild(box);
    document.body.appendChild(root);

    return { root, box, grid, title, closeBtn, backBtn, fullscreenBtn, counter };
}

async function initGalleryExperience() {
    const showcase = document.getElementById("gallery-showcase");
    const preview = document.getElementById("gallery-showcase-preview");
    const countEl = document.getElementById("gallery-showcase-count");
    if (!showcase || !preview || !countEl) return;

    const galleryConfig = await loadGalleryItems();
    const galleryItems = galleryConfig.items;
    const galleryCategories = galleryConfig.categories;
    const browser = createGalleryBrowserModal();
    const lightbox = createGalleryLightbox();

    const syncOverlayScrollLock = () => {
        const hasOpenOverlay =
            browser.root.classList.contains("is-open") ||
            lightbox.root.classList.contains("is-open");
        document.body.classList.toggle("gallery-lightbox-open", hasOpenOverlay);
    };

    const syncBrowserFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === browser.box;
        browser.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const syncLightboxFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === lightbox.box;
        lightbox.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const closeBrowser = () => {
        if (document.fullscreenElement === browser.box && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        browser.root.classList.remove("is-open");
        browser.root.setAttribute("aria-hidden", "true");
        syncOverlayScrollLock();
        syncBrowserFullscreenButton();
    };

    const closeLightbox = () => {
        if (document.fullscreenElement === lightbox.box && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        lightbox.root.classList.remove("is-open");
        lightbox.root.setAttribute("aria-hidden", "true");
        lightbox.content.innerHTML = "";
        syncOverlayScrollLock();
        syncLightboxFullscreenButton();
    };

    const openLightbox = (item) => {
        if (!item) return;

        lightbox.content.innerHTML = "";
        lightbox.title.textContent = item.title || item.alt || "Gallery item";

        if (item.type === "video") {
            const video = document.createElement("video");
            video.className = "gallery-lightbox-media";
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            video.preload = "metadata";
            video.muted = false;
            const hasVideoSource = setVideoSources(video, item.sources, () => {
                showVideoFallback(lightbox.content, item);
            });
            if (!hasVideoSource) {
                showVideoFallback(lightbox.content, item);
                return;
            }
            lightbox.content.appendChild(video);
            video.play().catch(() => {});
        } else {
            const img = document.createElement("img");
            img.src = item.src;
            img.alt = item.title || item.alt || "Gallery image";
            img.className = "gallery-lightbox-media";
            lightbox.content.appendChild(img);
        }

        lightbox.root.classList.add("is-open");
        lightbox.root.setAttribute("aria-hidden", "false");
        syncOverlayScrollLock();
        syncLightboxFullscreenButton();
    };

    const renderCategoryFolders = () => {
        browser.grid.innerHTML = "";
        browser.title.textContent = "CrossdaleArts Gallery";
        browser.counter.textContent = `${galleryCategories.length} categories • ${galleryItems.length} works`;
        browser.backBtn.hidden = true;

        galleryCategories.forEach((category) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "gallery-browser-card is-category";
            card.setAttribute("aria-label", `Open ${category.name} category`);

            const mediaWrap = document.createElement("div");
            mediaWrap.className = "gallery-browser-media-wrap";
            if (category.thumbnailItem) {
                mediaWrap.appendChild(renderGalleryPreviewMedia(category.thumbnailItem));
            }

            const meta = document.createElement("div");
            meta.className = "gallery-browser-meta";

            const title = document.createElement("p");
            title.className = "gallery-browser-item-title";
            title.textContent = category.name;

            const type = document.createElement("span");
            type.className = "gallery-browser-item-type";
            type.textContent = `${category.items.length} item${category.items.length === 1 ? "" : "s"}`;

            meta.appendChild(title);
            meta.appendChild(type);
            card.appendChild(mediaWrap);
            card.appendChild(meta);

            card.addEventListener("click", () => renderCategoryItems(category));
            browser.grid.appendChild(card);
        });
    };

    const renderCategoryItems = (category) => {
        browser.grid.innerHTML = "";
        browser.title.textContent = category.name;
        browser.counter.textContent = `${category.items.length} works`;
        browser.backBtn.hidden = false;

        category.items.forEach((item) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "gallery-browser-card";
            card.setAttribute("aria-label", `Open ${item.title || item.alt || "gallery item"}`);

            const mediaWrap = document.createElement("div");
            mediaWrap.className = "gallery-browser-media-wrap";
            mediaWrap.appendChild(renderGalleryPreviewMedia(item));

            const meta = document.createElement("div");
            meta.className = "gallery-browser-meta";

            const title = document.createElement("p");
            title.className = "gallery-browser-item-title";
            title.textContent = item.title || item.alt || "Untitled";

            const type = document.createElement("span");
            type.className = "gallery-browser-item-type";
            type.textContent = item.type === "video" ? "Video" : "Image";

            meta.appendChild(title);
            meta.appendChild(type);
            card.appendChild(mediaWrap);
            card.appendChild(meta);

            card.addEventListener("click", () => openLightbox(item));
            browser.grid.appendChild(card);
        });
    };

    const renderShowcase = () => {
        preview.innerHTML = "";

        if (!galleryItems.length) {
            countEl.textContent = "Gallery coming soon";
            showcase.setAttribute("aria-disabled", "true");
            showcase.classList.add("is-disabled");
            return;
        }

        countEl.textContent = `${galleryCategories.length} categories • ${galleryItems.length} works`;

        const heroItem = galleryConfig.homepagePreview || galleryItems[0];
        if (!heroItem) return;

        const tile = document.createElement("div");
        tile.className = "gallery-showcase-tile gallery-showcase-tile-hero";
        tile.appendChild(renderGalleryPreviewMedia(heroItem, "eager"));
        preview.appendChild(tile);
    };

    const openBrowser = () => {
        if (!galleryItems.length) return;
        renderCategoryFolders();
        browser.root.classList.add("is-open");
        browser.root.setAttribute("aria-hidden", "false");
        syncOverlayScrollLock();
        syncBrowserFullscreenButton();
    };

    renderShowcase();
    renderCategoryFolders();

    showcase.addEventListener("click", openBrowser);
    showcase.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openBrowser();
    });
    browser.closeBtn.addEventListener("click", closeBrowser);
    browser.backBtn.addEventListener("click", renderCategoryFolders);
    browser.root.addEventListener("click", (event) => {
        if (event.target === browser.root) closeBrowser();
    });
    browser.fullscreenBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === browser.box) {
                if (document.exitFullscreen) await document.exitFullscreen();
            } else if (browser.box.requestFullscreen) {
                await browser.box.requestFullscreen();
            }
        } catch (_) {
            // no-op fallback
        } finally {
            syncBrowserFullscreenButton();
        }
    });

    lightbox.closeBtn.addEventListener("click", closeLightbox);
    lightbox.root.addEventListener("click", (event) => {
        if (event.target === lightbox.root) closeLightbox();
    });
    lightbox.fullscreenBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === lightbox.box) {
                if (document.exitFullscreen) await document.exitFullscreen();
            } else if (lightbox.box.requestFullscreen) {
                await lightbox.box.requestFullscreen();
            }
        } catch (_) {
            // no-op fallback
        } finally {
            syncLightboxFullscreenButton();
        }
    });

    document.addEventListener("fullscreenchange", () => {
        syncBrowserFullscreenButton();
        syncLightboxFullscreenButton();
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (lightbox.root.classList.contains("is-open")) {
            closeLightbox();
            return;
        }
        if (browser.root.classList.contains("is-open")) {
            closeBrowser();
        }
    });
}

initGalleryExperience();

function createGalleryLightbox() {
    const existing = document.getElementById("gallery-lightbox");
    if (existing) {
        return {
            root: existing,
            closeBtn: existing.querySelector(".gallery-lightbox-close"),
            content: existing.querySelector(".gallery-lightbox-content"),
            title: existing.querySelector(".gallery-lightbox-title"),
            fullscreenBtn: existing.querySelector(".gallery-lightbox-fullscreen"),
            box: existing.querySelector(".gallery-lightbox-box")
        };
    }

    const root = document.createElement("div");
    root.id = "gallery-lightbox";
    root.className = "gallery-lightbox";
    root.setAttribute("aria-hidden", "true");

    const box = document.createElement("div");
    box.className = "gallery-lightbox-box";

    const header = document.createElement("div");
    header.className = "gallery-lightbox-header";

    const title = document.createElement("h3");
    title.className = "gallery-lightbox-title";
    title.textContent = "Gallery Item";

    const actions = document.createElement("div");
    actions.className = "gallery-lightbox-actions";

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "gallery-lightbox-fullscreen";
    fullscreenBtn.setAttribute("aria-label", "Toggle gallery item full screen");
    fullscreenBtn.textContent = "Full Screen";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "gallery-lightbox-close";
    closeBtn.setAttribute("aria-label", "Close full view");
    closeBtn.textContent = "Close";

    const content = document.createElement("div");
    content.className = "gallery-lightbox-content";

    actions.appendChild(fullscreenBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);
    box.appendChild(header);
    box.appendChild(content);
    root.appendChild(box);
    document.body.appendChild(root);

    return { root, closeBtn, content, title, fullscreenBtn, box };
}

function createPdfViewerModal() {
    const existing = document.getElementById("pdf-viewer-modal");
    if (existing) {
        return {
            root: existing,
            closeBtn: existing.querySelector(".pdf-viewer-close"),
            frame: existing.querySelector(".pdf-viewer-frame"),
            title: existing.querySelector(".pdf-viewer-title"),
            externalLink: existing.querySelector(".pdf-viewer-open-link"),
            fullscreenBtn: existing.querySelector(".pdf-viewer-fullscreen"),
            box: existing.querySelector(".pdf-viewer-box")
        };
    }

    const root = document.createElement("div");
    root.id = "pdf-viewer-modal";
    root.className = "pdf-viewer-modal";
    root.setAttribute("aria-hidden", "true");

    const box = document.createElement("div");
    box.className = "pdf-viewer-box";

    const header = document.createElement("div");
    header.className = "pdf-viewer-header";

    const title = document.createElement("h3");
    title.className = "pdf-viewer-title";
    title.textContent = "Course PDF";

    const actions = document.createElement("div");
    actions.className = "pdf-viewer-actions";

    const externalLink = document.createElement("a");
    externalLink.className = "pdf-viewer-open-link";
    externalLink.target = "_blank";
    externalLink.rel = "noopener noreferrer";
    externalLink.textContent = "Open in Drive";

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "pdf-viewer-fullscreen";
    fullscreenBtn.setAttribute("aria-label", "Open PDF viewer in full screen");
    fullscreenBtn.textContent = "Full Screen";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pdf-viewer-close";
    closeBtn.setAttribute("aria-label", "Close PDF viewer");
    closeBtn.textContent = "Close";

    const frame = document.createElement("iframe");
    frame.className = "pdf-viewer-frame";
    frame.loading = "lazy";
    frame.setAttribute("title", "Course PDF Viewer");
    frame.setAttribute("allow", "autoplay");

    actions.appendChild(externalLink);
    actions.appendChild(fullscreenBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);
    box.appendChild(header);
    box.appendChild(frame);
    root.appendChild(box);
    document.body.appendChild(root);

    return { root, closeBtn, frame, title, externalLink, fullscreenBtn, box };
}

function extractGoogleDriveFileId(url = "") {
    const directMatch = url.match(/\/file\/d\/([^/]+)/i);
    if (directMatch && directMatch[1]) return directMatch[1];

    try {
        const parsed = new URL(url, window.location.href);
        return parsed.searchParams.get("id") || "";
    } catch (_) {
        return "";
    }
}

function buildGoogleDrivePreviewUrl(url = "") {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return "";
    return `https://drive.google.com/file/d/${fileId}/preview`;
}

function initEmbeddedPdfViewer() {
    const pdfLinks = [...document.querySelectorAll('a[href*="drive.google.com/file/d/"]')]
        .filter((link) => link.querySelector(".download-course-details-button"));

    if (!pdfLinks.length) return;

    const viewer = createPdfViewerModal();
    const fullscreenTarget = viewer.box;

    const syncFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === fullscreenTarget;
        viewer.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
        viewer.fullscreenBtn.setAttribute(
            "aria-label",
            isFullscreen ? "Exit full screen PDF viewer" : "Open PDF viewer in full screen"
        );
    };

    const closeViewer = () => {
        if (document.fullscreenElement === fullscreenTarget && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        viewer.root.classList.remove("is-open");
        viewer.root.setAttribute("aria-hidden", "true");
        viewer.frame.src = "about:blank";
        document.body.classList.remove("gallery-lightbox-open");
        syncFullscreenButton();
    };

    const openViewer = (link) => {
        const previewUrl = buildGoogleDrivePreviewUrl(link.href);
        if (!previewUrl) {
            window.open(link.href, "_blank", "noopener,noreferrer");
            return;
        }

        const buttonText = link.textContent.trim();
        const courseTitle = document.getElementById("course-title");
        const heading = courseTitle ? courseTitle.textContent.trim() : "Course PDF";

        viewer.title.textContent = buttonText ? `${heading} - ${buttonText}` : heading;
        viewer.externalLink.href = link.href;
        viewer.frame.src = previewUrl;
        viewer.root.classList.add("is-open");
        viewer.root.setAttribute("aria-hidden", "false");
        document.body.classList.add("gallery-lightbox-open");
        syncFullscreenButton();
    };

    pdfLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            openViewer(link);
        });
    });

    viewer.closeBtn.addEventListener("click", closeViewer);
    viewer.fullscreenBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === fullscreenTarget) {
                if (document.exitFullscreen) await document.exitFullscreen();
            } else if (fullscreenTarget.requestFullscreen) {
                await fullscreenTarget.requestFullscreen();
            }
        } catch (_) {
            window.open(viewer.externalLink.href, "_blank", "noopener,noreferrer");
        } finally {
            syncFullscreenButton();
        }
    });
    viewer.root.addEventListener("click", (event) => {
        if (event.target === viewer.root) closeViewer();
    });

    document.addEventListener("fullscreenchange", syncFullscreenButton);

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && viewer.root.classList.contains("is-open")) {
            closeViewer();
        }
    });
}



setupCourseImagePreview();

function setVideoSources(videoEl, sources, onAllFailed) {
    const safeSources = prioritizeSources((sources || []).filter((sourceDef) => sourceDef && sourceDef.src));
    if (safeSources.length === 0) {
        if (typeof onAllFailed === "function") onAllFailed();
        return false;
    }

    let sourceIndex = 0;

    const trySource = () => {
        if (sourceIndex >= safeSources.length) return false;
        videoEl.src = safeSources[sourceIndex].src;
        videoEl.load();
        return true;
    };

    const onError = () => {
        sourceIndex += 1;
        if (!trySource()) {
            videoEl.removeEventListener("error", onError);
            if (typeof onAllFailed === "function") onAllFailed();
        }
    };

    videoEl.addEventListener("error", onError);
    return trySource();
}

function showVideoFallback(container, item) {
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "gallery-video-fallback";

    const text = document.createElement("p");
    text.textContent = "This video format is not supported by your browser.";

    const primary = (item.sources && item.sources[0] && item.sources[0].src) || item.src || "#";
    const link = document.createElement("a");
    link.href = primary;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open or download video";

    wrapper.appendChild(text);
    wrapper.appendChild(link);
    container.appendChild(wrapper);
}

function setupCourseImagePreview() {
    const courseImages = document.querySelectorAll("#course-content img");
    if (!courseImages.length) return;

    const lightbox = createGalleryLightbox();
    let openedFromCourse = false;
    const fullscreenTarget = lightbox.box;

    const syncFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === fullscreenTarget;
        lightbox.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const openCourseImage = (imgEl) => {
        lightbox.content.innerHTML = "";

        const img = document.createElement("img");
        img.src = imgEl.src;
        img.alt = imgEl.alt || "Course image";
        img.className = "gallery-lightbox-media";
        lightbox.content.appendChild(img);
        lightbox.title.textContent = imgEl.alt || "Course image";

        lightbox.root.classList.add("is-open");
        lightbox.root.setAttribute("aria-hidden", "false");
        document.body.classList.add("gallery-lightbox-open");
        openedFromCourse = true;
        syncFullscreenButton();
    };

    const closeCourseImage = () => {
        if (!openedFromCourse) return;
        if (document.fullscreenElement === fullscreenTarget && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        lightbox.root.classList.remove("is-open");
        lightbox.root.setAttribute("aria-hidden", "true");
        lightbox.content.innerHTML = "";
        document.body.classList.remove("gallery-lightbox-open");
        openedFromCourse = false;
        syncFullscreenButton();
    };

    courseImages.forEach((imgEl) => {
        imgEl.setAttribute("role", "button");
        imgEl.setAttribute("tabindex", "0");
        imgEl.setAttribute("aria-label", "Open image in full view");

        imgEl.addEventListener("click", () => openCourseImage(imgEl));
        imgEl.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCourseImage(imgEl);
            }
        });
    });

    lightbox.closeBtn.addEventListener("click", closeCourseImage);
    lightbox.fullscreenBtn.addEventListener("click", async () => {
        if (!openedFromCourse) return;
        try {
            if (document.fullscreenElement === fullscreenTarget) {
                if (document.exitFullscreen) await document.exitFullscreen();
            } else if (fullscreenTarget.requestFullscreen) {
                await fullscreenTarget.requestFullscreen();
            }
        } catch (_) {
            // no-op fallback
        } finally {
            syncFullscreenButton();
        }
    });
    lightbox.root.addEventListener("click", (event) => {
        if (event.target === lightbox.root) closeCourseImage();
    });
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCourseImage();
    });
}

function buildFallbackSources(src = "") {
    const ext = getFileExtension(src);
    const out = [src];
    const dotExt = ext ? `.${ext}` : "";
    const base = dotExt && src.toLowerCase().endsWith(dotExt)
        ? src.slice(0, -dotExt.length)
        : src;

    if (ext === "mov") {
        out.push(`${base}.mp4`, `${base}.webm`);
    } else if (ext === "mp4" || ext === "m4v") {
        out.push(`${base}.webm`, `${base}.mov`);
    } else if (ext === "webm") {
        out.push(`${base}.mp4`, `${base}.mov`);
    }

    return [...new Set(out)];
}

function prioritizeSources(sources) {
    const scoreByExt = { mp4: 3, m4v: 3, webm: 2, ogg: 1, ogv: 1, mov: 0 };
    return [...sources].sort((a, b) => {
        const aExt = getFileExtension(a.src);
        const bExt = getFileExtension(b.src);
        return (scoreByExt[bExt] || 0) - (scoreByExt[aExt] || 0);
    });
}

const FEEDBACK_ROTATION_MS = 400;
const FEEDBACK_TRANSITION_MS = 400;
const FEEDBACK_DATA_URL = "/data/feedbacks.json";
const FEEDBACK_STORAGE_KEY = "crossdale_feedbacks";
const SECTION_LOTTIE_ICONS = [
    {
        selector: "#enrollment > h3",
        src: "https://cdn.prod.website-files.com/5d829bf092d4644f5c42e0ea/5dc235fb73f230cec5ce04c3_cta.json",
        label: "Animated enroll icon"
    },
    {
        selector: "#art-gallery > h3",
        src: "https://cdn.prod.website-files.com/5d829bf092d4644f5c42e0ea/5dc23c9c9dcd8e4752a18118_play.json",
        label: "Animated gallery icon"
    },
    // {
    //     selector: "#recognitions > h3",
    //     src: "https://cdn.prod.website-files.com/5d829bf092d4644f5c42e0ea/5db4616113810cd66044b014_success.json",
    //     label: "Animated recognition icon"
    // }
];
const FEEDBACK_SOCIAL_LINKS = [
    {
        href: "https://www.instagram.com/crossdale_arts/",
        label: "Instagram",
        target: "_blank",
        rel: "noopener noreferrer",
        iconClass: "is-instagram"
    },
    {
        href: "https://wa.me/8858762510",
        label: "WhatsApp",
        target: "_blank",
        rel: "noopener noreferrer",
        iconClass: "is-whatsapp"
    },
    {
        href: "mailto:contact@crossdalearts.com",
        label: "Email",
        target: "_self",
        rel: "",
        iconClass: "is-email"
    }
];

async function initFeedbackWidget() {
    const anchor = document.getElementById("feedback-widget-anchor");
    if (!anchor) return;

    let feedbacks = await loadFeedbackList();

    let currentIndex = 0;
    let rotationTimer = null;
    let pointerActive = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let suppressNextClick = false;
    let isAnimating = false;

    const widget = document.createElement("section");
    widget.className = "feedback-widget";

    const header = document.createElement("div");
    header.className = "feedback-widget-header";

    const title = document.createElement("h4");
    title.textContent = "Learners Feedback";

    const count = document.createElement("span");
    count.className = "feedback-count";

    const card = document.createElement("article");
    card.className = "feedback-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "Open full feedback");

    const cardBody = document.createElement("div");
    cardBody.className = "feedback-card-body";

    const starsEl = document.createElement("div");
    starsEl.className = "feedback-stars";

    const nameEl = document.createElement("div");
    nameEl.className = "feedback-name";

    const messageEl = document.createElement("p");
    messageEl.className = "feedback-message";

    cardBody.appendChild(starsEl);
    cardBody.appendChild(nameEl);
    cardBody.appendChild(messageEl);
    card.appendChild(cardBody);

    header.appendChild(title);
    header.appendChild(count);

    widget.appendChild(header);
    widget.appendChild(card);
    anchor.appendChild(widget);

    const socialLinks = document.createElement("div");
    socialLinks.className = "feedback-social-links";

    const socialLabel = document.createElement("span");
    socialLabel.className = "feedback-social-label";
    socialLabel.textContent = "Chat with us:";
    socialLinks.appendChild(socialLabel);

    FEEDBACK_SOCIAL_LINKS.forEach((item) => {
        const link = document.createElement("a");
        link.className = "feedback-social-link";
        link.href = item.href;
        link.setAttribute("aria-label", item.label);
        if (item.target) link.target = item.target;
        if (item.rel) link.rel = item.rel;

        const icon = document.createElement("span");
        icon.className = `feedback-social-icon ${item.iconClass}`;
        icon.setAttribute("aria-hidden", "true");
        link.appendChild(icon);

        socialLinks.appendChild(link);
    });

    anchor.appendChild(socialLinks);

    const detailModal = createFeedbackModal();

    function renderCurrent() {
        if (!feedbacks.length) {
            starsEl.textContent = renderStars(5);
            nameEl.textContent = "CrossdaleArts";
            messageEl.textContent = "No feedback yet. Be the first to share your experience.";
            count.textContent = "0 reviews";
            return;
        }
        const item = feedbacks[currentIndex];
        starsEl.textContent = renderStars(item.rating);
        nameEl.textContent = item.name;
        messageEl.textContent = item.message;
        count.textContent = `${feedbacks.length} reviews`;
    }

    function animateTo(nextIndex) {
        if (isAnimating) return;
        isAnimating = true;

        cardBody.classList.remove("is-exit", "is-enter");
        cardBody.classList.add("is-transitioning", "is-exit");

        const handleExitEnd = (event) => {
            if (event.animationName !== "feedback-card-exit") return;
            cardBody.removeEventListener("animationend", handleExitEnd);

            currentIndex = nextIndex;
            renderCurrent();

            cardBody.classList.remove("is-exit");
            cardBody.classList.add("is-enter");

            const handleEnterEnd = (enterEvent) => {
                if (enterEvent.animationName !== "feedback-card-enter") return;
                cardBody.removeEventListener("animationend", handleEnterEnd);
                cardBody.classList.remove("is-transitioning", "is-exit", "is-enter");
                isAnimating = false;
            };

            cardBody.addEventListener("animationend", handleEnterEnd);
        };

        cardBody.addEventListener("animationend", handleExitEnd);
    }

    function goNext() {
        if (feedbacks.length <= 1 || isAnimating) return;
        animateTo((currentIndex + 1) % feedbacks.length);
    }

    function goPrev() {
        if (feedbacks.length <= 1 || isAnimating) return;
        animateTo((currentIndex - 1 + feedbacks.length) % feedbacks.length);
    }

    function startRotation() {
        stopRotation();
        rotationTimer = window.setInterval(goNext, FEEDBACK_ROTATION_MS);
    }

    function stopRotation() {
        if (!rotationTimer) return;
        window.clearInterval(rotationTimer);
        rotationTimer = null;
    }

    function openFullFeedback() {
        if (!feedbacks.length) return;
        const selected = feedbacks[currentIndex];
        openFeedbackDetailModal(detailModal, selected);
    }

    async function onSubmitFeedback(entry) {
        const newEntry = sanitizeFeedback(entry);
        if (!newEntry) return { ok: false, message: "Invalid feedback details." };

        const saveResult = await saveFeedbackEntry(newEntry);
        if (!saveResult.ok) return saveResult;

        feedbacks = [newEntry, ...feedbacks];
        currentIndex = 0;
        renderCurrent();
        startRotation();
        return { ok: true, warning: saveResult.warning || "" };
    }

    card.addEventListener("click", () => {
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        openFullFeedback();
    });
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFullFeedback();
        }
    });

    widget.addEventListener("mouseenter", stopRotation);
    widget.addEventListener("mouseleave", startRotation);

    const SWIPE_THRESHOLD = 42;

    function onPointerStart(clientX, clientY) {
        pointerActive = true;
        pointerStartX = clientX;
        pointerStartY = clientY;
        stopRotation();
    }

    function onPointerMove(clientX, clientY) {
        if (!pointerActive) return;
        const dx = clientX - pointerStartX;
        const dy = clientY - pointerStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;

        pointerActive = false;
        suppressNextClick = true;
        if (dx < 0) goNext();
        else goPrev();
        startRotation();
    }

    function onPointerEnd() {
        if (!pointerActive) return;
        pointerActive = false;
        startRotation();
    }

    card.addEventListener(
        "touchstart",
        (event) => {
            const touch = event.changedTouches[0];
            onPointerStart(touch.clientX, touch.clientY);
        },
        { passive: true }
    );

    card.addEventListener(
        "touchmove",
        (event) => {
            const touch = event.changedTouches[0];
            onPointerMove(touch.clientX, touch.clientY);
        },
        { passive: true }
    );

    card.addEventListener(
        "touchend",
        () => {
            onPointerEnd();
        },
        { passive: true }
    );

    card.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        onPointerStart(event.clientX, event.clientY);
    });

    window.addEventListener("mousemove", (event) => {
        onPointerMove(event.clientX, event.clientY);
    });

    window.addEventListener("mouseup", () => {
        onPointerEnd();
    });

    renderCurrent();
    startRotation();
}

function createFeedbackModal() {
    const overlay = document.createElement("div");
    overlay.className = "feedback-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const modal = document.createElement("div");
    modal.className = "feedback-modal";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        modal.innerHTML = "";
        document.body.classList.remove("gallery-lightbox-open");
    }

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
    });

    return { overlay, modal, close };
}

function openFeedbackDetailModal(detailModal, feedback) {
    const safe = sanitizeFeedback(feedback);
    if (!safe) return;
// <div class="feedback-modal-stars">${renderStars(safe.rating)}</div>
    detailModal.modal.innerHTML = `
        <div class="feedback-modal-top">
            <h2>Learners Feedback</h2>
            <button type="button" class="feedback-modal-close">Close</button>
        </div>
        <div class="feedback-modal-name">${escapeHTML(safe.name)}</div>
        <p class="feedback-modal-message">${escapeHTML(safe.message)}</p>
    `;

    detailModal.modal.querySelector(".feedback-modal-close").addEventListener("click", detailModal.close);
    detailModal.overlay.classList.add("is-open");
    detailModal.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
}

function openFeedbackFormModal(detailModal, onSubmit) {
    const saveModeLabel = "Crossdale Arts Database";

    detailModal.modal.innerHTML = `
        <div class="feedback-modal-top">
            <h4>Leave Feedback</h4>
            <button type="button" class="feedback-modal-close">Close</button>
        </div>
        <form class="feedback-form" id="feedback-form">
            <label>
                Your Name
                <input type="text" name="name" maxlength="60" required />
            </label>
            <label>
                Rating
                <select name="rating" required>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                </select>
            </label>
            <label>
                Feedback
                <textarea name="message" maxlength="500" required></textarea>
            </label>
            <button type="submit" class="feedback-form-submit">Submit Feedback</button>
            <p class="feedback-form-note">Saved to ${saveModeLabel}.</p>
        </form>
    `;

    detailModal.modal.querySelector(".feedback-modal-close").addEventListener("click", detailModal.close);

    const form = detailModal.modal.querySelector("#feedback-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitBtn = form.querySelector(".feedback-form-submit");
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        const formData = new FormData(form);
        const payload = {
            name: String(formData.get("name") || "").trim(),
            rating: Number(formData.get("rating")),
            message: String(formData.get("message") || "").trim()
        };

        const result = await onSubmit(payload);
        if (result.ok) {
            detailModal.close();
            if (result.warning) {
                window.alert(result.warning);
            }
            return;
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Feedback";
        window.alert(result.message || "Could not save feedback. Try again.");
    });

    detailModal.overlay.classList.add("is-open");
    detailModal.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
}

async function loadFeedbackList() {
    const localList = getLocalFeedbacks();

    try {
        const response = await fetch(FEEDBACK_DATA_URL, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        const remoteList = Array.isArray(data) ? data : data.feedbacks;
        const normalizedRemote = Array.isArray(remoteList) ? remoteList.map(sanitizeFeedback).filter(Boolean) : [];
        return [...localList, ...normalizedRemote];
    } catch (_) {
        return localList;
    }
}

async function saveFeedbackEntry(entry) {
    const localList = getLocalFeedbacks();
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([entry, ...localList]));
    return { ok: true };
}

function getLocalFeedbacks() {
    try {
        const parsed = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.map(sanitizeFeedback).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function sanitizeFeedback(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().slice(0, 60);
    const message = String(raw.message || "").trim().slice(0, 500);
    const rating = Math.max(1, Math.min(5, Number(raw.rating) || 0));
    if (!name || !message || !rating) return null;
    return { name, message, rating };
}

function renderStars(rating) {
    const safeRating = Math.max(1, Math.min(5, Number(rating) || 0));
    return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
}

function truncateFeedback(text, maxLen) {
    const safe = String(text || "").trim();
    if (safe.length <= maxLen) return safe;
    return `${safe.slice(0, maxLen - 1).trimEnd()}...`;
}

let lottieLibraryPromise = null;

function loadLottieLibrary() {
    if (window.lottie && typeof window.lottie.loadAnimation === "function") {
        return Promise.resolve(window.lottie);
    }

    if (lottieLibraryPromise) return lottieLibraryPromise;

    lottieLibraryPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-lottie-web="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(window.lottie), { once: true });
            existing.addEventListener("error", () => reject(new Error("Failed to load Lottie library")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js";
        script.async = true;
        script.dataset.lottieWeb = "true";
        script.addEventListener("load", () => {
            if (window.lottie && typeof window.lottie.loadAnimation === "function") {
                resolve(window.lottie);
                return;
            }
            reject(new Error("Lottie library loaded without window.lottie"));
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Failed to load Lottie library")), { once: true });
        document.head.appendChild(script);
    });

    return lottieLibraryPromise;
}

function escapeHTML(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

const COURSE_REGION_STORAGE_KEY = "crossdaleArtsCourseRegion";
const INR_PER_USD = 92.96;
const COURSE_ENTRY_PATH_PATTERN = /(?:^|\/)(?:pages\/(?:courses|[^\/]+-payment)\.html|(?:courses|[^\/]+-payment)\.html)$/i;
const COURSE_CURRENCY_TEXT_PATTERN = /(?:₹|â‚¹|INR|Rs\.?)\s*([0-9,]+)|\b([0-9][0-9,]*)\s*\/-/gi;
let courseCurrencyObserver = null;

function clearCourseRegionOnReload() {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    if (navigationEntry && navigationEntry.type === "reload") {
        sessionStorage.removeItem(COURSE_REGION_STORAGE_KEY);
    }
}

function getSelectedCourseRegion() {
    return sessionStorage.getItem(COURSE_REGION_STORAGE_KEY) || "";
}

function setSelectedCourseRegion(region) {
    if (region !== "indian" && region !== "international") return;
    sessionStorage.setItem(COURSE_REGION_STORAGE_KEY, region);
}

function formatUsdFromInr(amountInInr) {
    const converted = amountInInr / INR_PER_USD;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: converted >= 100 ? 0 : 2,
        maximumFractionDigits: 2
    }).format(converted);
}

function convertCoursePriceText(text) {
    COURSE_CURRENCY_TEXT_PATTERN.lastIndex = 0;
    return text.replace(COURSE_CURRENCY_TEXT_PATTERN, (_, rupeeAmount, slashAmount) => {
        const rawAmount = rupeeAmount || slashAmount;
        if (!rawAmount) return _;
        const numericValue = Number(String(rawAmount).replace(/,/g, ""));
        if (!Number.isFinite(numericValue)) return _;
        return formatUsdFromInr(numericValue);
    });
}

function shouldConvertCourseTextNode(node) {
    if (!node || !node.nodeValue) return false;

    COURSE_CURRENCY_TEXT_PATTERN.lastIndex = 0;
    if (!COURSE_CURRENCY_TEXT_PATTERN.test(node.nodeValue)) {
        return false;
    }
    COURSE_CURRENCY_TEXT_PATTERN.lastIndex = 0;

    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest("script, style, noscript, iframe")) return false;
    return true;
}

function collectConvertibleCourseTextNodes(root) {
    const scope = root && root.nodeType === Node.TEXT_NODE ? root.parentNode : root;
    if (!scope) return [];

    if (root && root.nodeType === Node.TEXT_NODE) {
        return shouldConvertCourseTextNode(root) ? [root] : [];
    }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return shouldConvertCourseTextNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
    });

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
    }

    return textNodes;
}

function applyInternationalPricing(root = document.body) {
    if (getSelectedCourseRegion() !== "international") return;

    const textNodes = collectConvertibleCourseTextNodes(root);
    textNodes.forEach((node) => {
        const nextValue = convertCoursePriceText(node.nodeValue);
        if (nextValue !== node.nodeValue) {
            node.nodeValue = nextValue;
        }
    });
}

function startInternationalPricingObserver() {
    if (courseCurrencyObserver || getSelectedCourseRegion() !== "international") return;

    courseCurrencyObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "characterData") {
                applyInternationalPricing(mutation.target);
                return;
            }

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return;
                applyInternationalPricing(node);
            });
        });
    });

    courseCurrencyObserver.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
    });
}

function createCourseRegionModal() {
    const existing = document.getElementById("course-region-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "course-region-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="course-region-title">
            <p class="course-region-eyebrow">Course Pricing</p>
            <h2 id="course-region-title">Select your region</h2>
            <p class="course-region-copy">Choose how you want course prices to be shown for this visit.</p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice" data-region="indian">Indian</button>
                <button type="button" class="course-region-choice is-secondary" data-region="international">International</button>
            </div>
            <p class="course-region-note">International pricing is shown in USD using an approximate conversion rate.</p>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("course-region-modal-open");
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("course-region-modal-open");
    });

    return modal;
}

function openCourseRegionModal(targetUrl) {
    const modal = createCourseRegionModal();
    const choiceButtons = modal.querySelectorAll("[data-region]");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");

    const closeAndNavigate = (region) => {
        setSelectedCourseRegion(region);
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("course-region-modal-open");

        if (region === "international") {
            applyInternationalPricing();
            startInternationalPricingObserver();
        }

        if (targetUrl) {
            window.location.href = targetUrl;
        }
    };

    choiceButtons.forEach((button) => {
        button.onclick = () => {
            closeAndNavigate(button.dataset.region || "indian");
        };
    });
}

function initCourseRegionSelection() {
    clearCourseRegionOnReload();
    applyInternationalPricing();
    startInternationalPricingObserver();

    const courseLinks = document.querySelectorAll("a[href]");
    courseLinks.forEach((link) => {
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref.startsWith("#")) return;

        let resolvedUrl;
        try {
            resolvedUrl = new URL(rawHref, window.location.href);
        } catch (_) {
            return;
        }

        if (!COURSE_ENTRY_PATH_PATTERN.test(resolvedUrl.pathname)) return;

        link.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (getSelectedCourseRegion()) return;

            event.preventDefault();
            openCourseRegionModal(resolvedUrl.href);
        });
    });
}

async function initSectionLottieIcons() {
    const iconTargets = SECTION_LOTTIE_ICONS
        .map((item) => ({ ...item, heading: document.querySelector(item.selector) }))
        .filter((item) => item.heading);

    if (!iconTargets.length) return;

    try {
        const lottie = await loadLottieLibrary();
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        iconTargets.forEach((item) => {
            if (item.heading.querySelector(".section-lottie-icon")) return;

            const icon = document.createElement("span");
            icon.className = "section-lottie-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.dataset.label = item.label;
            item.heading.classList.add("has-lottie-icon");
            item.heading.prepend(icon);

            lottie.loadAnimation({
                container: icon,
                renderer: "svg",
                loop: !prefersReducedMotion,
                autoplay: !prefersReducedMotion,
                path: item.src,
                rendererSettings: {
                    preserveAspectRatio: "xMidYMid meet"
                }
            });
        });
    } catch (error) {
        console.warn("Section Lottie icons could not be initialized.", error);
    }
}

function initQualificationNoteCollapse() {
    const note = document.getElementById("qualification-note");
    const toggle = document.getElementById("qualification-note-toggle");
    if (!note || !toggle) return;

    const mobileBreakpoint = window.matchMedia("(max-width: 576px)");

    const syncState = () => {
        if (!mobileBreakpoint.matches) {
            note.classList.remove("is-expanded");
            toggle.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
            toggle.textContent = "Read more";
            return;
        }

        toggle.hidden = false;
    };

    toggle.addEventListener("click", () => {
        if (!mobileBreakpoint.matches) return;

        const isExpanded = note.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(isExpanded));
        toggle.textContent = isExpanded ? "Read less" : "Read more";
    });

    if (typeof mobileBreakpoint.addEventListener === "function") {
        mobileBreakpoint.addEventListener("change", syncState);
    } else if (typeof mobileBreakpoint.addListener === "function") {
        mobileBreakpoint.addListener(syncState);
    }

    syncState();
}

function initScrollReveal() {
    const selectors = [
        "#alert-banner",
        "#artist-statement",
        "#enrollment",
        "#about-me",
        "#art-expertise",
        "#art-gallery",
        "#exhibitions",
        "#recognitions",
        "#courses-page > *",
        ".course-card",
        "#story-page > *",
        ".story-card",
        ".story-section",
        ".story-quote",
        "#course-content > *"
    ];

    const elements = [...new Set(
        selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    )].filter((element) => element && !element.closest("nav"));

    if (!elements.length) return;

    document.body.classList.add("reveal-ready");

    elements.forEach((element, index) => {
        element.classList.add("scroll-reveal");
        element.style.setProperty("--reveal-delay", `${Math.min(index * 45, 180)}ms`);
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        elements.forEach((element) => element.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        {
            threshold: 0.06,
            rootMargin: "0px 0px 14% 0px"
        }
    );

    elements.forEach((element) => observer.observe(element));
}

initQualificationNoteCollapse();
initScrollReveal();
initFeedbackWidget();
initEmbeddedPdfViewer();
initSectionLottieIcons();
initCourseRegionSelection();
