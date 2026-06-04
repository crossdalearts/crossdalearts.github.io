const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "ogg", "ogv", "m4v"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf"]);
const GALLERY_META_URL = "data/gallery-media.json";
const GALLERY_SESSION_CACHE_PREFIX = "crossdalearts:session:";
const galleryItemsCache = new Map();
const artworksForSaleCache = new Map();
const artworksForSalePaymentCache = new Map();
const galleryImageBlobUrlCache = new Map();
const galleryImageLoadPromiseCache = new Map();
const ARTWORKS_BUY_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxkoaAKb7VWL3dOPPHBB2CpbnUyNwceMUdtZQNiBhm07YgPnlSlxHPxKLEuf1pt-mT4/exec";

window.addEventListener("beforeunload", () => {
    galleryImageBlobUrlCache.forEach((objectUrl) => {
        try {
            URL.revokeObjectURL(objectUrl);
        } catch (_) {
            // no-op
        }
    });
    galleryImageBlobUrlCache.clear();
    galleryImageLoadPromiseCache.clear();
});

function getSessionCacheKey(key = "") {
    return `${GALLERY_SESSION_CACHE_PREFIX}${String(key || "").trim()}`;
}

function readSessionJSON(key) {
    try {
        const raw = sessionStorage.getItem(getSessionCacheKey(key));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function writeSessionJSON(key, value) {
    try {
        sessionStorage.setItem(getSessionCacheKey(key), JSON.stringify(value));
    } catch (_) {
        // Ignore storage failures (private mode, quota, etc.)
    }
}

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
    if (item.type === "video" || item.type === "image" || item.type === "pdf") return item.type;
    const extension = getFileExtension(item.src || "");
    if (VIDEO_EXTENSIONS.has(extension)) return "video";
    if (DOCUMENT_EXTENSIONS.has(extension)) return "pdf";
    return "image";
}

function normalizeVideoSources(item) {
    if (Array.isArray(item.sources) && item.sources.length > 0) {
        return item.sources
            .map((source) => {
                if (typeof source === "string") return { src: resolveGalleryAssetPath(source), type: "" };
                if (!source || !source.src) return null;
                return { src: resolveGalleryAssetPath(source.src), type: source.type || "" };
            })
            .filter(Boolean);
    }
    if (item.src) {
        return buildFallbackSources(resolveGalleryAssetPath(item.src)).map((src) => ({ src, type: "" }));
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
            sources: normalizeVideoSources(titledItem),
            descriptionHTML: String(item.description_html || item.description || "").trim(),
            buttonText: String(item.button_text || "").trim(),
            buttonUrl: String(item.button_url || "").trim()
        };
    }
    return {
        ...titledItem,
        type,
        descriptionHTML: String(item.description_html || item.description || "").trim(),
        buttonText: String(item.button_text || "").trim(),
        buttonUrl: String(item.button_url || "").trim()
    };
}

async function loadGalleryConfig(url = GALLERY_META_URL) {
    try {
        const response = await fetch(getAssetUrl(url), { method: "GET", cache: "force-cache" });
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
            categories: normalizedCategories,
            artworksForSaleConfig: String(data?.artworks_for_sale_config || "").trim(),
            artworksForSalePaymentConfig: String(data?.artworks_for_sale_payment_config || "").trim()
        };
    } catch (_) {
        return {
            homepagePreview: null,
            categories: [],
            artworksForSaleConfig: "",
            artworksForSalePaymentConfig: ""
        };
    }
}

async function loadGalleryItems(url = GALLERY_META_URL) {
    const normalizedUrl = String(url || GALLERY_META_URL).trim();
    const cacheKey = `gallery-items:${normalizedUrl}`;
    if (galleryItemsCache.has(cacheKey)) return galleryItemsCache.get(cacheKey);

    const sessionCached = readSessionJSON(cacheKey);
    if (sessionCached && Array.isArray(sessionCached.items) && Array.isArray(sessionCached.categories)) {
        galleryItemsCache.set(cacheKey, sessionCached);
        return sessionCached;
    }

    const config = await loadGalleryConfig(url);
    const categories = [];
    const items = [];

    for (const category of config.categories) {
        const validEntries = category.items.filter((item) => item && typeof item.path === "string");
        const resolvedItems = validEntries
            .map((item) => {
                const rawSrc = String(item.path || "").trim().replace(/\\/g, "/");
                const src = resolveGalleryAssetPath(rawSrc);
                const type = String(item.type || "").trim().toLowerCase();
                const title = String(item.title || "").trim();
                if (!src) return null;
                if (type !== "image" && type !== "video" && type !== "pdf") return null;
                return buildGalleryItem({
                    src,
                    type,
                    title,
                    category: category.name
                });
            })
            .filter(Boolean);
        if (!resolvedItems.length) continue;

        let previewItem = null;
        if (category.preview) {
            const previewSrc = String(category.preview.path || "").trim().replace(/\\/g, "/");
            const previewType = String(category.preview.type || "").trim().toLowerCase();
            const previewTitle = String(category.preview.title || "").trim();

            if (previewSrc && (previewType === "image" || previewType === "video" || previewType === "pdf")) {
                const resolvedPreviewSrc = resolveGalleryAssetPath(previewSrc);
                previewItem = buildGalleryItem({
                    src: resolvedPreviewSrc,
                    type: previewType,
                    title: previewTitle,
                    category: category.name
                });
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

            if (previewSrc && (previewType === "image" || previewType === "video" || previewType === "pdf")) {
                const resolvedPreviewSrc = resolveGalleryAssetPath(previewSrc);
                homepagePreview = buildGalleryItem({
                    src: resolvedPreviewSrc,
                    type: previewType,
                    title: previewTitle
                });
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

    const result = {
        homepagePreview,
        categories,
        items,
        artworksForSaleConfig: String(config?.artworksForSaleConfig || "").trim(),
        artworksForSalePaymentConfig: String(config?.artworksForSalePaymentConfig || "").trim()
    };
    galleryItemsCache.set(cacheKey, result);
    writeSessionJSON(cacheKey, result);
    return result;
}

async function loadArtworksForSaleConfig(url) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    if (artworksForSaleCache.has(cleanUrl)) return artworksForSaleCache.get(cleanUrl);

    try {
        const response = await fetch(getAssetUrl(cleanUrl), { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Artworks config fetch failed");
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : [];

        const normalizedItems = items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
                path: String(item.path || "").trim(),
                title: String(item.title || "").trim(),
                description: String(item.description || "").trim(),
                price: String(item.price || "").trim(),
                dimensions_notes: String(item.dimensions_notes || "").trim(),
                button_text: String(item.button_text || "Enquire / Buy").trim(),
                button_url: String(item.button_url || "#").trim(),
                watch_video_url: String(item.watch_video_url || "#").trim(),
                instagram_url: String(item.instagram_url || "#").trim()
            }));
        const hydrated = hydrateArtworksForSaleCache(normalizedItems);
        artworksForSaleCache.set(cleanUrl, hydrated);
        return hydrated;
    } catch (_) {
        return { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    }
}

function hydrateArtworksForSaleCache(items) {
    const byPath = new Map();
    const byTitle = new Map();
    const byFileName = new Map();

    items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const pathKey = normalizeArtworkConfigPath(String(item.path || ""));
        const titleKey = String(item.title || "").trim().toLowerCase();
        const fileNameKey = getNormalizedFileName(pathKey);
        const normalized = {
            title: String(item.title || "").trim(),
            description: String(item.description || "").trim(),
            price: String(item.price || "").trim(),
            dimensionsNotes: String(item.dimensions_notes || "").trim(),
            buttonText: String(item.button_text || "Enquire / Buy").trim(),
            buttonUrl: String(item.button_url || "#").trim(),
            watchVideoUrl: String(item.watch_video_url || "#").trim(),
            instagramUrl: String(item.instagram_url || "#").trim()
        };
        if (pathKey) byPath.set(pathKey, normalized);
        if (titleKey) byTitle.set(titleKey, normalized);
        if (fileNameKey) byFileName.set(fileNameKey, normalized);
    });

    return { byPath, byTitle, byFileName };
}

async function loadArtworksForSalePaymentConfig(url) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    if (artworksForSalePaymentCache.has(cleanUrl)) return artworksForSalePaymentCache.get(cleanUrl);

    try {
        const response = await fetch(getAssetUrl(cleanUrl), { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Artworks payment config fetch failed");
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalizedItems = items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
                path: String(item.path || "").trim(),
                title: String(item.title || "").trim(),
                payment_links: {
                    indian: String(item?.payment_links?.indian || "").trim(),
                    international: String(item?.payment_links?.international || "").trim()
                }
            }));
        const hydrated = hydrateArtworksForSalePaymentCache(normalizedItems);
        artworksForSalePaymentCache.set(cleanUrl, hydrated);
        return hydrated;
    } catch (_) {
        return { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    }
}

function hydrateArtworksForSalePaymentCache(items) {
    const byPath = new Map();
    const byTitle = new Map();
    const byFileName = new Map();
    items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const normalized = {
            paymentLinks: {
                indian: String(item?.payment_links?.indian || "").trim(),
                international: String(item?.payment_links?.international || "").trim()
            }
        };
        const pathKey = normalizeArtworkConfigPath(String(item.path || ""));
        const titleKey = String(item.title || "").trim().toLowerCase();
        const fileNameKey = getNormalizedFileName(pathKey);
        if (pathKey) byPath.set(pathKey, normalized);
        if (titleKey) byTitle.set(titleKey, normalized);
        if (fileNameKey) byFileName.set(fileNameKey, normalized);
    });
    return { byPath, byTitle, byFileName };
}

function normalizeArtworkConfigPath(pathValue = "") {
    const cleanPath = String(pathValue || "").trim().replace(/\\/g, "/");
    if (!cleanPath) return "";
    return cleanPath.replace(/^\.?\//, "").toLowerCase();
}

function normalizeArtworkRuntimePath(srcValue = "") {
    const raw = String(srcValue || "").trim();
    if (!raw) return "";

    try {
        const parsed = new URL(raw, window.location.href);
        const decodedPath = decodeURIComponent(String(parsed.pathname || ""));
        return decodedPath
            .replace(/^\/+/, "")
            .replace(/\\/g, "/")
            .toLowerCase();
    } catch (_) {
        return normalizeArtworkConfigPath(raw);
    }
}

function getNormalizedFileName(pathValue = "") {
    const normalizedPath = String(pathValue || "").trim().replace(/\\/g, "/").toLowerCase();
    if (!normalizedPath) return "";
    const parts = normalizedPath.split("/");
    return String(parts[parts.length - 1] || "").trim();
}

function normalizeArtworkBuyWebAppUrl() {
    const url = String(ARTWORKS_BUY_WEBAPP_URL || "").trim();
    if (!url) return "";
    return url.replace(/\/+$/, "");
}

function createArtworkBuyFlowModal() {
    const existing = document.getElementById("artwork-buy-flow-modal");
    if (existing) {
        if (!existing.querySelector(".artwork-buy-flow-content")) {
            existing.innerHTML = `
                <div class="course-region-dialog artwork-buy-flow-dialog" role="dialog" aria-modal="true" aria-label="Artwork purchase details">
                    <div class="artwork-buy-flow-content"></div>
                </div>
            `;
        }
        return {
            root: existing,
            dialog: existing.querySelector(".artwork-buy-flow-dialog"),
            content: existing.querySelector(".artwork-buy-flow-content")
        };
    }

    const root = document.createElement("div");
    root.id = "artwork-buy-flow-modal";
    root.className = "course-region-modal artwork-buy-flow-modal";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
        <div class="course-region-dialog artwork-buy-flow-dialog" role="dialog" aria-modal="true" aria-label="Artwork purchase details">
            <div class="artwork-buy-flow-content"></div>
        </div>
    `;
    document.body.appendChild(root);

    return {
        root,
        dialog: root.querySelector(".artwork-buy-flow-dialog"),
        content: root.querySelector(".artwork-buy-flow-content")
    };
}

function closeArtworkBuyFlowModal() {
    const modal = document.getElementById("artwork-buy-flow-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
}

function openArtworkBuyFlowModal() {
    const modal = createArtworkBuyFlowModal();
    modal.root.classList.add("is-open");
    modal.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
    return modal;
}

function getSafeArtworkPaymentUrl(buttonUrl = "") {
    const raw = String(buttonUrl || "").trim();
    if (!raw || raw === "#") return "";
    try {
        const parsed = new URL(raw, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (_) {
        return "";
    }
    return "";
}

async function submitArtworkLeadToSheet(payload) {
    const endpoint = normalizeArtworkBuyWebAppUrl();
    if (!endpoint) return { ok: false, reason: "missing_endpoint" };
    const params = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        params.append(key, typeof value === "boolean" ? String(value) : String(value));
    });
    params.append("payload", JSON.stringify(payload || {}));
    params.append("source", "artwork_buy_form");
    try {
        await fetch(endpoint, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: params.toString()
        });
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: String(error?.message || "request_failed") };
    }
}

function createArtworkSaleModal() {
    const existing = document.getElementById("artwork-sale-modal");
    if (existing) {
        return {
            root: existing,
            closeBtn: existing.querySelector(".artwork-sale-close"),
            fullscreenBtn: existing.querySelector(".artwork-sale-fullscreen"),
            image: existing.querySelector(".artwork-sale-image"),
            imageWrap: existing.querySelector(".artwork-sale-image-wrap"),
            title: existing.querySelector(".artwork-sale-title"),
            description: existing.querySelector(".artwork-sale-description"),
            cta: existing.querySelector(".artwork-sale-cta"),
            watchVideoBtn: existing.querySelector(".artwork-sale-watch-video"),
            instagramBtn: existing.querySelector(".artwork-sale-instagram")
        };
    }

    const root = document.createElement("div");
    root.id = "artwork-sale-modal";
    root.className = "artwork-sale-modal";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
        <div class="artwork-sale-box" role="dialog" aria-modal="true" aria-label="Artwork details">
            <div class="artwork-sale-left">
                <div class="artwork-sale-toolbar">
                    <button type="button" class="artwork-sale-fullscreen">Full Screen</button>
                </div>
                <div class="artwork-sale-image-wrap">
                    <img class="artwork-sale-image" alt="Artwork image" />
                </div>
            </div>
            <div class="artwork-sale-right">
                <div class="artwork-sale-right-inner">
                    <div class="artwork-sale-top">
                        <h3 class="artwork-sale-title">Artwork</h3>
                        <button type="button" class="artwork-sale-close">Close</button>
                    </div>
                    <p class="artwork-sale-price" hidden></p>
                    <p class="artwork-sale-dimensions-notes" hidden></p>
                    <div class="artwork-sale-secondary-actions">
                        <a class="artwork-sale-watch-video" href="#" target="_blank" rel="noopener noreferrer">Watch video</a>
                        <a class="artwork-sale-instagram" href="#" target="_blank" rel="noopener noreferrer">Visit Instagram</a>
                    </div>
                    <div class="artwork-sale-description"></div>
                    <a class="artwork-sale-cta" href="#" target="_blank" rel="noopener noreferrer">Enquire / Buy</a>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(root);
    return {
        root,
        closeBtn: root.querySelector(".artwork-sale-close"),
        fullscreenBtn: root.querySelector(".artwork-sale-fullscreen"),
        image: root.querySelector(".artwork-sale-image"),
        imageWrap: root.querySelector(".artwork-sale-image-wrap"),
        title: root.querySelector(".artwork-sale-title"),
        price: root.querySelector(".artwork-sale-price"),
        dimensionsNotes: root.querySelector(".artwork-sale-dimensions-notes"),
        description: root.querySelector(".artwork-sale-description"),
        cta: root.querySelector(".artwork-sale-cta"),
        watchVideoBtn: root.querySelector(".artwork-sale-watch-video"),
        instagramBtn: root.querySelector(".artwork-sale-instagram")
    };
}

async function openGalleryBrowser(configUrl, pageTitle = "Gallery", initialArtwork = null) {
    const browser = createGalleryBrowserModal("details-gallery-browser-modal", pageTitle);
    const lightbox = createGalleryLightbox();
    const artworkSaleModal = createArtworkSaleModal();
    const artworkBuyFlowModal = createArtworkBuyFlowModal();
    let galleryItems = [];
    let galleryCategories = [];
    let artworkMeta = { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    let artworkPaymentMeta = { byPath: new Map(), byTitle: new Map(), byFileName: new Map() };
    let selectedArtworkSaleContext = null;
    const initialArtworkPathKey = normalizeArtworkConfigPath(initialArtwork?.path || initialArtwork?.src || "");
    const initialArtworkTitleKey = String(initialArtwork?.title || initialArtwork?.alt || "").trim().toLowerCase();
    const isDirectArtworkLaunch = Boolean(initialArtworkPathKey || initialArtworkTitleKey);

    const syncOverlayScrollLock = () => {
        const hasOpenOverlay =
            browser.root.classList.contains("is-open") ||
            lightbox.root.classList.contains("is-open") ||
            artworkSaleModal.root.classList.contains("is-open") ||
            artworkBuyFlowModal.root.classList.contains("is-open");
        document.body.classList.toggle("gallery-lightbox-open", hasOpenOverlay);
    };

    const closeBrowser = () => {
        if (document.fullscreenElement === browser.box && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        browser.root.classList.remove("is-open");
        browser.root.setAttribute("aria-hidden", "true");
        syncOverlayScrollLock();
        browser.fullscreenBtn.textContent = "Full Screen";
    };

    const closeLightbox = () => {
        if (document.fullscreenElement === lightbox.box && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        lightbox.root.classList.remove("is-open");
        lightbox.root.setAttribute("aria-hidden", "true");
        lightbox.content.innerHTML = "";
        syncOverlayScrollLock();
        lightbox.fullscreenBtn.textContent = "Full Screen";
    };

    const syncArtworkFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === artworkSaleModal.imageWrap;
        artworkSaleModal.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const closeArtworkSaleModal = () => {
        if (document.fullscreenElement === artworkSaleModal.imageWrap && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        artworkSaleModal.root.classList.remove("is-open");
        artworkSaleModal.root.setAttribute("aria-hidden", "true");
        if (isDirectArtworkLaunch && browser.root.classList.contains("is-open")) {
            browser.root.classList.remove("is-open");
            browser.root.setAttribute("aria-hidden", "true");
        }
        syncOverlayScrollLock();
        syncArtworkFullscreenButton();
        syncBrowserFullscreenButton();
    };

    const openArtworkSaleModal = (item) => {
        if (!item || item.type !== "image") {
            openLightbox(item);
            return;
        }

        const pathKey = normalizeArtworkRuntimePath(item.src);
        const titleKey = String(item.title || item.alt || "").trim().toLowerCase();
        const fileNameKey = getNormalizedFileName(pathKey);
        const meta =
            artworkMeta.byPath.get(pathKey) ||
            artworkMeta.byTitle.get(titleKey) ||
            artworkMeta.byFileName.get(fileNameKey);
        const description = meta?.description || item.descriptionHTML || "<p>Brief description will be added soon.</p>";
        const price = meta?.price || item.price || "";
        const dimensionsNotes = meta?.dimensionsNotes || item.dimensionsNotes || "";
        const buttonText = meta?.buttonText || item.buttonText || "Enquire / Buy";
        const buttonUrl = meta?.buttonUrl || item.buttonUrl || "#";
        const watchVideoUrl = meta?.watchVideoUrl || "#";
        const instagramUrl = meta?.instagramUrl || "#";
        const titleBase = meta?.title || item.title || item.alt || "Artwork";
        selectedArtworkSaleContext = {
            title: titleBase,
            price,
            dimensionsNotes,
            buttonText,
            buttonUrl,
            imagePath: item.src || "",
            region: "indian",
            description: description
        };

        artworkSaleModal.title.textContent = titleBase;
        if (artworkSaleModal.price) {
            artworkSaleModal.price.textContent = price;
            artworkSaleModal.price.hidden = !price;
        }
        if (artworkSaleModal.dimensionsNotes) {
            artworkSaleModal.dimensionsNotes.textContent = dimensionsNotes;
            artworkSaleModal.dimensionsNotes.hidden = !dimensionsNotes;
        }
        artworkSaleModal.description.innerHTML = description;
        artworkSaleModal.cta.textContent = buttonText;
        artworkSaleModal.cta.href = buttonUrl;
        artworkSaleModal.cta.setAttribute("aria-label", buttonText);
        if (artworkSaleModal.watchVideoBtn) {
            artworkSaleModal.watchVideoBtn.href = watchVideoUrl;
        }
        if (artworkSaleModal.instagramBtn) {
            artworkSaleModal.instagramBtn.href = instagramUrl;
        }
        artworkSaleModal.cta.onclick = (event) => {
            event.preventDefault();
            renderArtworkRegionStep();
        };
        artworkSaleModal.image.alt = item.title || item.alt || "Artwork image";
        artworkSaleModal.image.loading = "eager";
        artworkSaleModal.image.decoding = "async";
        renderGalleryImageWithLoader(artworkSaleModal.image, item.src);

        artworkSaleModal.root.classList.add("is-open");
        artworkSaleModal.root.setAttribute("aria-hidden", "false");
        syncOverlayScrollLock();
        syncArtworkFullscreenButton();
    };

    const renderArtworkRegionStep = () => {
        const ctx = selectedArtworkSaleContext;
        if (!ctx) return;
        const modal = openArtworkBuyFlowModal();
        if (modal.dialog) {
            modal.dialog.classList.remove("artwork-buy-flow-dialog");
        }
        modal.content.innerHTML = `
            <p class="course-region-eyebrow">Artwork Purchase</p>
            <h2 id="artwork-region-title">Select your region</h2>
            <p class="course-region-copy">Choose your location for this artwork request: <b>${escapeHTML(ctx.title)}</b>.</p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice" data-artwork-region="indian">Indian</button>
                <button type="button" class="course-region-choice is-secondary" data-artwork-region="international">International</button>
            </div>
            <p class="course-region-note">This helps us follow up with the right process and pricing conversation.</p>
        `;
        modal.content.querySelectorAll("[data-artwork-region]").forEach((btn) => {
            btn.addEventListener("click", () => renderArtworkFormStep(btn.getAttribute("data-artwork-region") || ""));
        });
        syncOverlayScrollLock();
    };

    const renderArtworkSuccessStep = (submission) => {
        const modal = openArtworkBuyFlowModal();
        if (modal.dialog) {
            modal.dialog.classList.add("artwork-buy-flow-dialog");
        }
        const payUrl = getSafeArtworkPaymentUrl(selectedArtworkSaleContext?.buttonUrl || "");
        const isNegotiation = Boolean(submission?.wantNegotiation);
        const successMessage = isNegotiation
            ? "Thank you. Your proposal has been sent. We will contact you in a few days on your email or social handle."
            : "Thank you. Your details were shared successfully. You can proceed with direct payment now.";

        modal.content.innerHTML = `
            <div class="artwork-buy-flow-top">
                <h3 class="artwork-buy-flow-title">Request Submitted</h3>
                <button type="button" class="course-region-close artwork-buy-flow-close" data-buy-close aria-label="Close success modal">&times;</button>
            </div>
            <p class="artwork-buy-flow-success">${escapeHTML(successMessage)}</p>
            <div class="artwork-buy-flow-actions">
                ${!isNegotiation && payUrl ? `<a class="course-region-choice artwork-buy-danger" href="${escapeHTML(payUrl)}" target="_blank" rel="noopener noreferrer">Proceed to Payment</a>` : ""}
                <button type="button" class="course-region-choice is-secondary" data-buy-close>Done</button>
            </div>
        `;

        modal.content.querySelectorAll("[data-buy-close]").forEach((btn) => {
            btn.addEventListener("click", () => {
                closeArtworkBuyFlowModal();
                syncOverlayScrollLock();
            });
        });
        syncOverlayScrollLock();
    };

    const resolveArtworkPaymentLink = (ctx, region) => {
        if (!ctx) return "";
        const regionKey = String(region || "indian").trim().toLowerCase() === "international" ? "international" : "indian";
        const pathKey = normalizeArtworkRuntimePath(ctx.imagePath || "");
        const titleKey = String(ctx.title || "").trim().toLowerCase();
        const fileNameKey = getNormalizedFileName(pathKey);
        const entry =
            artworkPaymentMeta.byPath.get(pathKey) ||
            artworkPaymentMeta.byTitle.get(titleKey) ||
            artworkPaymentMeta.byFileName.get(fileNameKey);
        const configured = String(entry?.paymentLinks?.[regionKey] || "").trim();
        if (configured) return configured;
        return String(ctx.buttonUrl || "").trim();
    };

    const renderArtworkPaymentStep = (submission) => {
        const modal = openArtworkBuyFlowModal();
        if (modal.dialog) modal.dialog.classList.add("artwork-buy-flow-dialog");
        const payUrl = getSafeArtworkPaymentUrl(resolveArtworkPaymentLink(selectedArtworkSaleContext, submission?.region || "indian"));
        modal.content.innerHTML = `
            <div class="artwork-buy-flow-top">
                <h3 class="artwork-buy-flow-title">Confirm Payment</h3>
                <button type="button" class="course-region-close artwork-buy-flow-close" data-buy-close aria-label="Close payment modal">&times;</button>
            </div>
            <p class="artwork-buy-flow-success">Artwork Price: <b>${escapeHTML(String(selectedArtworkSaleContext?.price || "Price will be shared"))}</b></p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice artwork-buy-danger" data-buy-pay>Pay</button>
                <button type="button" class="course-region-choice is-secondary" data-buy-close>Cancel</button>
            </div>
        `;
        const showPaymentUnavailable = () => {
            modal.content.innerHTML = `
                <div class="artwork-buy-flow-top">
                    <h3 class="artwork-buy-flow-title">Sorry</h3>
                    <button type="button" class="course-region-close artwork-buy-flow-close" data-buy-close aria-label="Close sorry modal">&times;</button>
                </div>
                <p class="artwork-buy-flow-success">Sorry, payment link is not available right now. Please try again later or contact us.</p>
                <div class="course-region-actions">
                    <button type="button" class="course-region-choice is-secondary" data-buy-close>Close</button>
                </div>
            `;
            modal.content.querySelectorAll("[data-buy-close]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    closeArtworkBuyFlowModal();
                    syncOverlayScrollLock();
                });
            });
        };
        modal.content.querySelector("[data-buy-pay]")?.addEventListener("click", () => {
            if (!payUrl) {
                showPaymentUnavailable();
                return;
            }
            const win = window.open(payUrl, "_blank", "noopener,noreferrer");
            if (!win) window.location.href = payUrl;
        });
        modal.content.querySelectorAll("[data-buy-close]").forEach((btn) => {
            btn.addEventListener("click", () => {
                closeArtworkBuyFlowModal();
                syncOverlayScrollLock();
            });
        });
        syncOverlayScrollLock();
    };

    const renderArtworkFormStep = (region) => {
        const normalizedRegion = String(region || "").trim().toLowerCase();
        const regionLabel = normalizedRegion === "international" ? "International" : "Indian";
        const ctx = selectedArtworkSaleContext;
        if (!ctx) return;
        selectedArtworkSaleContext.region = normalizedRegion || "indian";

        const modal = openArtworkBuyFlowModal();
        if (modal.dialog) {
            modal.dialog.classList.add("artwork-buy-flow-dialog");
        }
        modal.content.innerHTML = `
            <div class="artwork-buy-flow-top">
                <h3 class="artwork-buy-flow-title">${escapeHTML(regionLabel)} Buyer Details</h3>
                <button type="button" class="course-region-close artwork-buy-flow-close" data-buy-close aria-label="Close buyer form">&times;</button>
            </div>
            <form id="artwork-buy-form" class="artwork-buy-form" novalidate>
                <label class="artwork-buy-field">
                    <span>Name</span>
                    <input type="text" name="name" required maxlength="120" placeholder="Enter your full name" />
                </label>
                <label class="artwork-buy-field">
                    <span>Email</span>
                    <input type="email" name="email" required maxlength="180" placeholder="Enter your email for updates" />
                </label>
                <label class="artwork-buy-field">
                    <span>Social Handle (optional)</span>
                    <input type="text" name="socialHandle" maxlength="180" placeholder="@username or profile link (optional)" />
                </label>
                <label class="artwork-buy-field">
                    <span>Brief Address</span>
                    <textarea name="address" rows="3" required maxlength="500" placeholder="City, State, Country (or brief delivery address)"></textarea>
                </label>
                <label class="artwork-buy-check">
                    <input type="checkbox" name="wantNegotiation" />
                    <span>I want to propose a different price and negotiate</span>
                </label>
                <label class="artwork-buy-field" id="proposed-price-field" hidden>
                    <span>Proposed Price</span>
                    <input type="text" name="proposedPrice" maxlength="60" placeholder="Enter your offer price (e.g. $900 or ₹75,000)" />
                </label>
                <p class="artwork-buy-note">If negotiation is selected, we will contact you in a few days by email or social handle.</p>
                <div class="artwork-buy-actions">
                    <button type="button" class="course-region-choice is-secondary" data-buy-back>Back</button>
                    <button type="submit" class="course-region-choice artwork-buy-danger" id="artwork-buy-submit">Submit</button>
                </div>
                <p class="artwork-buy-error" id="artwork-buy-error" hidden></p>
            </form>
        `;

        modal.content.querySelectorAll("[data-buy-close]").forEach((btn) => {
            btn.addEventListener("click", () => {
                closeArtworkBuyFlowModal();
                syncOverlayScrollLock();
            });
        });
        modal.content.querySelector("[data-buy-back]")?.addEventListener("click", renderArtworkRegionStep);

        const form = modal.content.querySelector("#artwork-buy-form");
        const errorEl = modal.content.querySelector("#artwork-buy-error");
        const negotiationInput = form?.querySelector('input[name="wantNegotiation"]');
        const proposedField = modal.content.querySelector("#proposed-price-field");
        const proposedInput = form?.querySelector('input[name="proposedPrice"]');
        const submitBtn = modal.content.querySelector("#artwork-buy-submit");
        const toggleProposedPrice = () => {
            const checked = Boolean(negotiationInput?.checked);
            if (proposedField) proposedField.hidden = !checked;
            if (proposedInput) proposedInput.required = checked;
        };
        toggleProposedPrice();
        negotiationInput?.addEventListener("change", toggleProposedPrice);

        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!form) return;
            if (errorEl) {
                errorEl.hidden = true;
                errorEl.textContent = "";
            }
            if (!normalizeArtworkBuyWebAppUrl()) {
                if (errorEl) {
                    errorEl.textContent = "Form endpoint is missing. Please set ARTWORKS_BUY_WEBAPP_URL in script.js.";
                    errorEl.hidden = false;
                }
                return;
            }

            const fd = new FormData(form);
            const submission = {
                submittedAt: new Date().toISOString(),
                region: regionLabel,
                artworkTitle: String(ctx.title || "").trim(),
                artworkPrice: String(ctx.price || "").trim(),
                artworkDimensionsNotes: String(ctx.dimensionsNotes || "").trim(),
                artworkImagePath: String(ctx.imagePath || "").trim(),
                name: String(fd.get("name") || "").trim(),
                email: String(fd.get("email") || "").trim(),
                socialHandle: String(fd.get("socialHandle") || "").trim(),
                address: String(fd.get("address") || "").trim(),
                wantNegotiation: Boolean(fd.get("wantNegotiation")),
                proposedPrice: String(fd.get("proposedPrice") || "").trim(),
                sourcePage: window.location.href
            };

            if (!submission.name || !submission.email || !submission.address) {
                if (errorEl) {
                    errorEl.textContent = "Please fill all required fields.";
                    errorEl.hidden = false;
                }
                return;
            }
            if (submission.wantNegotiation && !submission.proposedPrice) {
                if (errorEl) {
                    errorEl.textContent = "Please enter your proposed price for negotiation.";
                    errorEl.hidden = false;
                }
                return;
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submitting...";
            }
            const result = await submitArtworkLeadToSheet(submission);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit";
            }
            if (!result.ok) {
                if (errorEl) {
                    errorEl.textContent = "Submission failed. Please check your Apps Script deployment access and try again.";
                    errorEl.hidden = false;
                }
                return;
            }
            if (submission.wantNegotiation) {
                renderArtworkSuccessStep(submission);
                return;
            }
            renderArtworkPaymentStep(submission);
        });

        syncOverlayScrollLock();
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
        } else if (item.type === "pdf") {
            const iframe = document.createElement("iframe");
            iframe.className = "gallery-lightbox-media";
            iframe.src = item.src;
            iframe.title = item.title || item.alt || "PDF document";
            iframe.loading = "lazy";
            iframe.setAttribute("allowfullscreen", "");
            lightbox.content.appendChild(iframe);
        } else {
            const img = document.createElement("img");
            img.alt = item.title || item.alt || "Gallery image";
            img.className = "gallery-lightbox-media";
            img.loading = "eager";
            img.decoding = "async";
            renderGalleryImageWithLoader(img, item.src);
            lightbox.content.appendChild(img);
        }

        lightbox.root.classList.add("is-open");
        lightbox.root.setAttribute("aria-hidden", "false");
        syncOverlayScrollLock();
    };

    const renderCategoryFolders = () => {
        browser.grid.innerHTML = "";
        browser.title.textContent = pageTitle;
        browser.counter.textContent = `${galleryCategories.length} categories • ${galleryItems.length} works`;
        browser.backBtn.hidden = true;

        if (!galleryCategories.length) {
            browser.grid.innerHTML = `<p class="gallery-empty-message">Gallery details are not available yet.</p>`;
            return;
        }

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

            const titleRow = document.createElement("div");
            titleRow.className = "gallery-browser-title-row";

            const title = document.createElement("p");
            title.className = "gallery-browser-item-title";
            const itemPathKey = normalizeArtworkRuntimePath(item.src);
            const itemTitleKey = String(item.title || item.alt || "").trim().toLowerCase();
            const itemFileNameKey = getNormalizedFileName(itemPathKey);
            const itemMeta =
                artworkMeta.byPath.get(itemPathKey) ||
                artworkMeta.byTitle.get(itemTitleKey) ||
                artworkMeta.byFileName.get(itemFileNameKey);
            const cardPrice = itemMeta?.price || item.price || "";
            const cardTitle = itemMeta?.title || item.title || item.alt || "Untitled";
            title.textContent = cardTitle;

            const price = document.createElement("span");
            price.className = "gallery-browser-item-price";
            price.textContent = cardPrice;
            price.hidden = !cardPrice;

            const type = document.createElement("span");
            type.className = "gallery-browser-item-type";
            const isArtworkForSaleCategory = String(category.name || "").trim().toLowerCase() === "artworks for sale";
            if (item.type === "video") {
                type.textContent = "Video";
            } else if (isArtworkForSaleCategory) {
                type.textContent = "Image & description";
            } else {
                type.textContent = "Image";
            }

            titleRow.appendChild(price);
            titleRow.appendChild(title);
            meta.appendChild(titleRow);
            meta.appendChild(type);
            card.appendChild(mediaWrap);
            card.appendChild(meta);

            card.addEventListener("click", () => {
                if (String(category.name || "").trim().toLowerCase() === "artworks for sale") {
                    openArtworkSaleModal(item);
                    return;
                }
                openLightbox(item);
            });
            browser.grid.appendChild(card);
        });
    };

    const syncBrowserFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === browser.box;
        browser.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const syncLightboxFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === lightbox.box;
        lightbox.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const openBrowser = () => {
        browser.grid.innerHTML = `<p class="gallery-empty-message">Loading gallery...</p>`;
        browser.title.textContent = pageTitle;
        browser.counter.textContent = "Please wait";
        browser.backBtn.hidden = true;
        browser.root.classList.add("is-open");
        browser.root.setAttribute("aria-hidden", "false");
        syncOverlayScrollLock();
        syncBrowserFullscreenButton();
    };

    if (!browser.root.dataset.detailsGalleryInitialized) {
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

        artworkSaleModal.closeBtn.addEventListener("click", closeArtworkSaleModal);
        artworkSaleModal.root.addEventListener("click", (event) => {
            if (event.target === artworkSaleModal.root) closeArtworkSaleModal();
        });
        artworkSaleModal.fullscreenBtn.addEventListener("click", async () => {
            try {
                if (document.fullscreenElement === artworkSaleModal.imageWrap) {
                    if (document.exitFullscreen) await document.exitFullscreen();
                } else if (artworkSaleModal.imageWrap.requestFullscreen) {
                    await artworkSaleModal.imageWrap.requestFullscreen();
                }
            } catch (_) {
                // no-op fallback
            } finally {
                syncArtworkFullscreenButton();
            }
        });
        artworkBuyFlowModal.root.addEventListener("click", (event) => {
            if (event.target !== artworkBuyFlowModal.root) return;
            closeArtworkBuyFlowModal();
            syncOverlayScrollLock();
        });

        document.addEventListener("fullscreenchange", () => {
            syncBrowserFullscreenButton();
            syncLightboxFullscreenButton();
            syncArtworkFullscreenButton();
        });

        window.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (artworkBuyFlowModal.root.classList.contains("is-open")) {
                closeArtworkBuyFlowModal();
                syncOverlayScrollLock();
                return;
            }
            if (artworkSaleModal.root.classList.contains("is-open")) {
                closeArtworkSaleModal();
                return;
            }
            if (lightbox.root.classList.contains("is-open")) {
                closeLightbox();
                return;
            }
            if (browser.root.classList.contains("is-open")) {
                closeBrowser();
            }
        });

        browser.root.dataset.detailsGalleryInitialized = "true";
    }

    openBrowser();

    try {
        const galleryConfig = await loadGalleryItems(configUrl);
        galleryItems = galleryConfig.items;
        galleryCategories = galleryConfig.categories;
        artworkMeta = await loadArtworksForSaleConfig(galleryConfig.artworksForSaleConfig);
        artworkPaymentMeta = await loadArtworksForSalePaymentConfig(galleryConfig.artworksForSalePaymentConfig);

        if (!browser.root.classList.contains("is-open")) return;
        if (!galleryItems.length) {
            browser.grid.innerHTML = `<p class="gallery-empty-message">Gallery details are not available yet.</p>`;
            browser.counter.textContent = "0 works";
            return;
        }
        renderCategoryFolders();
        if (initialArtworkPathKey || initialArtworkTitleKey) {
            const matchedArtwork = galleryItems.find((item) => {
                const itemPathKey = normalizeArtworkRuntimePath(item.src);
                const itemTitleKey = String(item.title || item.alt || "").trim().toLowerCase();
                return (
                    (initialArtworkPathKey && itemPathKey === initialArtworkPathKey) ||
                    (initialArtworkTitleKey && itemTitleKey === initialArtworkTitleKey)
                );
            });
            if (matchedArtwork) openArtworkSaleModal(matchedArtwork);
        }
        syncBrowserFullscreenButton();
    } catch (_) {
        if (!browser.root.classList.contains("is-open")) return;
        browser.grid.innerHTML = `<p class="gallery-empty-message">Unable to load gallery right now. Please try again.</p>`;
        browser.counter.textContent = "Unavailable";
    }
}

function initDetailsGalleryButtons() {
    const detailButtons = [...document.querySelectorAll('[data-gallery-config]')];
    if (!detailButtons.length) return;

    detailButtons.forEach((button) => {
        let prefetched = false;
        const prefetchGallery = () => {
            if (prefetched) return;
            prefetched = true;
            const configUrl = String(button.dataset.galleryConfig || "").trim();
            if (!configUrl) return;
            loadGalleryItems(configUrl)
                .then((galleryConfig) =>
                    Promise.all([
                        loadArtworksForSaleConfig(galleryConfig.artworksForSaleConfig),
                        loadArtworksForSalePaymentConfig(galleryConfig.artworksForSalePaymentConfig)
                    ])
                )
                .catch(() => {});
        };

        button.addEventListener("pointerenter", prefetchGallery, { once: true });
        button.addEventListener("focus", prefetchGallery, { once: true });
        button.addEventListener("touchstart", prefetchGallery, { once: true, passive: true });

        button.addEventListener("click", (event) => {
            event.preventDefault();
            const configUrl = String(button.dataset.galleryConfig || "").trim();
            if (!configUrl) return;
            const courseTitle = document.getElementById("course-title");
            const courseTitleText = courseTitle ? String(courseTitle.textContent || "").trim() : "";
            const titleText = courseTitleText
                // ? `${courseTitleText} Market Research`
                ? `Market Research`
                : String(button.dataset.galleryTitle || "").trim() || "Course Market Research";
            openGalleryBrowser(configUrl, titleText);
        });
    });
}

async function initArtworksForSaleGrid() {
    const grid = document.getElementById("artworks-for-sale-grid");
    if (!grid) return;

    const saleConfigUrl = String(grid.dataset.saleConfig || "").trim();
    const galleryConfigUrl = String(grid.dataset.galleryConfig || "").trim();
    const galleryTitle = String(grid.dataset.galleryTitle || "Artworks for Sale").trim();

    if (!saleConfigUrl || !galleryConfigUrl) {
        grid.innerHTML = `<p class="gallery-empty-message">Artworks are unavailable right now.</p>`;
        return;
    }

    try {
        const saleMeta = await loadArtworksForSaleConfig(saleConfigUrl);
        const allEntries = [
            ...saleMeta.byPath.values()
        ];

        const unique = [];
        const seen = new Set();
        allEntries.forEach((item) => {
            const key = `${String(item.title || "").trim().toLowerCase()}|${String(item.price || "").trim()}`;
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(item);
        });

        if (!unique.length) {
            grid.innerHTML = `<p class="gallery-empty-message">No artworks available right now.</p>`;
            return;
        }

        const response = await fetch(getAssetUrl(saleConfigUrl), { method: "GET", cache: "no-store" });
        const raw = response.ok ? await response.json() : { items: [] };
        const sourceItems = Array.isArray(raw?.items) ? raw.items : [];

        grid.innerHTML = "";
        sourceItems.forEach((rawItem) => {
            const title = String(rawItem?.title || "Untitled").trim();
            const price = String(rawItem?.price || "").trim();
            const imageSrc = resolveGalleryAssetPath(String(rawItem?.path || "").trim());

            const card = document.createElement("article");
            card.className = "artworks-sale-card";
            card.innerHTML = `
                <img class="artworks-sale-card-image" src="${escapeHTML(imageSrc)}" alt="${escapeHTML(title)}" loading="lazy" decoding="async" />
                <div class="artworks-sale-card-body">
                    <h3>${escapeHTML(title)}</h3>
                    <p>${escapeHTML(price || "Price on request")}</p>
                    <button type="button" class="download-course-details-button">View Details</button>
                </div>
            `;

            card.querySelector("button")?.addEventListener("click", () => {
                openGalleryBrowser(galleryConfigUrl, galleryTitle, rawItem);
            });

            grid.appendChild(card);
        });
    } catch (_) {
        grid.innerHTML = `<p class="gallery-empty-message">Unable to load artworks right now.</p>`;
    }
}

function renderGalleryPreviewMedia(item, imageLoading = "lazy") {
    if (item.type === "video") {
        const mediaEl = document.createElement("video");
        mediaEl.className = "gallery-preview-media";
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
        return mediaEl;
    }

    if (item.type === "pdf") {
        const wrapper = document.createElement("div");
        wrapper.className = "gallery-preview-media gallery-preview-pdf";
        wrapper.setAttribute("role", "img");
        wrapper.setAttribute("aria-label", item.title || item.alt || "PDF document");
        wrapper.innerHTML = `
            <span class="gallery-preview-pdf-icon" aria-hidden="true">PDF</span>
            <span class="gallery-preview-pdf-title">${escapeHTML(item.title || item.alt || "PDF document")}</span>
        `;
        return wrapper;
    }

    const mediaEl = document.createElement("img");
    mediaEl.className = "gallery-preview-media";
    mediaEl.alt = item.title || "Gallery preview";
    mediaEl.loading = imageLoading;
    mediaEl.decoding = "async";
    renderGalleryImageWithLoader(mediaEl, item.src);
    return mediaEl;
}

function renderGalleryImageWithLoader(imgEl, src) {
    const targetSrc = String(src || "").trim();
    if (!imgEl || !targetSrc) return;
    imgEl.style.display = "block";
    imgEl.style.visibility = "visible";
    imgEl.style.opacity = "1";

    const render = async () => {
        // Reuse already fetched image bytes in the same session to avoid repeated downloads.
        if (galleryImageBlobUrlCache.has(targetSrc)) {
            imgEl.src = galleryImageBlobUrlCache.get(targetSrc);
            return;
        }

        if (!galleryImageLoadPromiseCache.has(targetSrc)) {
            const loadingPromise = fetch(targetSrc, { method: "GET", cache: "force-cache" })
                .then((response) => {
                    if (!response.ok) throw new Error("Image fetch failed");
                    return response.blob();
                })
                .then((blob) => {
                    const objectUrl = URL.createObjectURL(blob);
                    galleryImageBlobUrlCache.set(targetSrc, objectUrl);
                    return objectUrl;
                })
                .catch(() => targetSrc)
                .finally(() => {
                    galleryImageLoadPromiseCache.delete(targetSrc);
                });
            galleryImageLoadPromiseCache.set(targetSrc, loadingPromise);
        }

        const resolvedSrc = await galleryImageLoadPromiseCache.get(targetSrc);
        imgEl.src = resolvedSrc;
    };

    imgEl.addEventListener("load", () => {
        imgEl.style.display = "block";
        imgEl.style.visibility = "visible";
        imgEl.style.opacity = "1";
    }, { once: true });

    imgEl.addEventListener("error", () => {
        if (imgEl.dataset.retryWithDirect === "true") return;
        imgEl.dataset.retryWithDirect = "true";
        imgEl.src = `${targetSrc}${targetSrc.includes("?") ? "&" : "?"}v=${Date.now()}`;
        imgEl.style.display = "block";
        imgEl.style.visibility = "visible";
        imgEl.style.opacity = "1";
    }, { once: true });

    render().catch(() => {
        imgEl.src = targetSrc;
        imgEl.style.display = "block";
        imgEl.style.visibility = "visible";
        imgEl.style.opacity = "1";
    });
}

function createGalleryBrowserModal(modalId = "gallery-browser-modal", titleText = "CrossdaleArts Gallery") {
    const existing = document.getElementById(modalId);
    if (existing) {
        const titleElement = existing.querySelector(".gallery-browser-title");
        if (titleElement) {
            titleElement.textContent = titleText;
        }
        return {
            root: existing,
            box: existing.querySelector(".gallery-browser-box"),
            grid: existing.querySelector(".gallery-browser-grid"),
            title: titleElement,
            closeBtn: existing.querySelector(".gallery-browser-close"),
            backBtn: existing.querySelector(".gallery-browser-back"),
            fullscreenBtn: existing.querySelector(".gallery-browser-fullscreen"),
            counter: existing.querySelector(".gallery-browser-count")
        };
    }

    const root = document.createElement("div");
    root.id = modalId;
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
    title.textContent = titleText;

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
        } else if (item.type === "pdf") {
            const iframe = document.createElement("iframe");
            iframe.className = "gallery-lightbox-media";
            iframe.src = item.src;
            iframe.title = item.title || item.alt || "PDF document";
            iframe.loading = "lazy";
            iframe.setAttribute("allowfullscreen", "");
            lightbox.content.appendChild(iframe);
        } else {
            const img = document.createElement("img");
            img.alt = item.title || item.alt || "Gallery image";
            img.className = "gallery-lightbox-media";
            img.loading = "eager";
            img.decoding = "async";
            renderGalleryImageWithLoader(img, item.src);
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

