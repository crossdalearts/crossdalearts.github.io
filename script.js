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

const flipCards = document.querySelectorAll(".authenticity-card");
flipCards.forEach((card) => {
    const toggleFlip = () => {
        card.classList.toggle("is-flipped");
    };

    card.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        toggleFlip();
    });

    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleFlip();
        }
    });
});

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "ogg", "ogv", "m4v"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf"]);
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

async function probePdfSource(src) {
    try {
        const response = await fetch(src, { method: "HEAD", cache: "no-store" });
        return response.ok;
    } catch (_) {
        return false;
    }
}

async function loadGalleryConfig(url = GALLERY_META_URL) {
    try {
        const response = await fetch(getAssetUrl(url), { method: "GET", cache: "no-store" });
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

async function loadGalleryItems(url = GALLERY_META_URL) {
    const config = await loadGalleryConfig(url);
    const categories = [];
    const items = [];

    for (const category of config.categories) {
        const validEntries = category.items.filter((item) => item && typeof item.path === "string");
        const checks = validEntries.map(async (item) => {
            const rawSrc = String(item.path || "").trim().replace(/\\/g, "/");
            const src = resolveGalleryAssetPath(rawSrc);
            const type = String(item.type || "").trim().toLowerCase();
            const title = String(item.title || "").trim();

            if (!src) return null;
            if (type !== "image" && type !== "video" && type !== "pdf") return null;

            const exists = type === "video"
                ? await probeVideoSource(src)
                : type === "pdf"
                    ? await probePdfSource(src)
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

            if (previewSrc && (previewType === "image" || previewType === "video" || previewType === "pdf")) {
                const resolvedPreviewSrc = resolveGalleryAssetPath(previewSrc);
                const exists = previewType === "video"
                    ? await probeVideoSource(resolvedPreviewSrc)
                    : previewType === "pdf"
                        ? await probePdfSource(resolvedPreviewSrc)
                        : await probeImageSource(resolvedPreviewSrc);

                if (exists) {
                    previewItem = buildGalleryItem({
                        src: resolvedPreviewSrc,
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

            if (previewSrc && (previewType === "image" || previewType === "video" || previewType === "pdf")) {
                const resolvedPreviewSrc = resolveGalleryAssetPath(previewSrc);
                const exists = previewType === "video"
                    ? await probeVideoSource(resolvedPreviewSrc)
                    : previewType === "pdf"
                        ? await probePdfSource(resolvedPreviewSrc)
                        : await probeImageSource(resolvedPreviewSrc);

                if (exists) {
                    homepagePreview = buildGalleryItem({
                        src: resolvedPreviewSrc,
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

async function openGalleryBrowser(configUrl, pageTitle = "Gallery") {
    const galleryConfig = await loadGalleryItems(configUrl);
    const galleryItems = galleryConfig.items;
    const galleryCategories = galleryConfig.categories;
    const browser = createGalleryBrowserModal("details-gallery-browser-modal", pageTitle);
    const lightbox = createGalleryLightbox();

    const syncOverlayScrollLock = () => {
        const hasOpenOverlay = browser.root.classList.contains("is-open") || lightbox.root.classList.contains("is-open");
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
            img.src = item.src;
            img.alt = item.title || item.alt || "Gallery image";
            img.className = "gallery-lightbox-media";
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

    const syncBrowserFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === browser.box;
        browser.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const syncLightboxFullscreenButton = () => {
        const isFullscreen = document.fullscreenElement === lightbox.box;
        lightbox.fullscreenBtn.textContent = isFullscreen ? "Exit Full Screen" : "Full Screen";
    };

    const openBrowser = () => {
        if (!galleryItems.length) {
            browser.root.classList.add("is-open");
            browser.root.setAttribute("aria-hidden", "false");
            syncOverlayScrollLock();
            return;
        }
        renderCategoryFolders();
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

        browser.root.dataset.detailsGalleryInitialized = "true";
    }

    openBrowser();
}

function initDetailsGalleryButtons() {
    const detailButtons = [...document.querySelectorAll('[data-gallery-config]')];
    if (!detailButtons.length) return;

    detailButtons.forEach((button) => {
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
    mediaEl.src = item.src;
    mediaEl.alt = item.title || "Gallery preview";
    mediaEl.loading = imageLoading;
    mediaEl.decoding = "async";
    return mediaEl;
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

function buildPdfPreviewUrl(url = "") {
    const cleanedUrl = String(url || "").trim();
    if (!cleanedUrl) return "";
    const drivePreview = buildGoogleDrivePreviewUrl(cleanedUrl);
    if (drivePreview) return drivePreview;
    if (cleanedUrl.toLowerCase().endsWith(".pdf")) return cleanedUrl;
    return "";
}

function initEmbeddedPdfViewer() {
    const pdfLinks = [...document.querySelectorAll('a.download-course-details-button')].filter((link) => {
        const pdfUrl = String(link.dataset.pdfUrl || link.href || "").trim();
        if (!pdfUrl) return false;
        return pdfUrl.includes("drive.google.com/file/d/") || pdfUrl.toLowerCase().endsWith(".pdf");
    });

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
        const pdfUrl = String(link.dataset.pdfUrl || link.href || "").trim();
        const previewUrl = buildPdfPreviewUrl(pdfUrl);
        if (!previewUrl) {
            window.open(pdfUrl || link.href, "_blank", "noopener,noreferrer");
            return;
        }

        const buttonText = link.textContent.trim();
        const courseTitle = document.getElementById("course-title");
        const heading = courseTitle ? courseTitle.textContent.trim() : "Course PDF";

        viewer.title.textContent = buttonText ? `${heading} - ${buttonText}` : heading;
        viewer.externalLink.href = pdfUrl || link.href;
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
const FEEDBACK_DATA_URL = getAssetUrl("data/feedbacks.json");
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

function getAssetUrl(relativePath) {
    const currentScript = document.currentScript || document.querySelector('script[src$="script.js"]');
    if (currentScript && currentScript.src) {
        return new URL(relativePath, currentScript.src).href;
    }
    return new URL(relativePath, window.location.href).href;
}

function resolveGalleryAssetPath(relativePath) {
    const path = String(relativePath || "").trim().replace(/\\/g, "/");
    if (!path) return "";
    return getAssetUrl(path);
}

const COURSE_REGION_STORAGE_KEY = "crossdaleArtsCourseRegion";
const INR_PER_USD = 92.96;
const EX_STUDENT_DATA_BASE_PATH = "data/ex-students";
const COURSE_FLOW_MANIFEST = {
    "the-art-of-meaning-payment.html": "data/course-flows/the-art-of-meaning.json",
    "the-art-of-meaning-payment-ex.html": "data/course-flows/the-art-of-meaning.json",
    "the-art-of-meaning-core-payment.html": "data/course-flows/the-art-of-meaning-core.json",
    "the-art-of-meaning-core-payment-ex.html": "data/course-flows/the-art-of-meaning-core.json",
    "fundamental-of-arts-payment.html": "data/course-flows/fundamental-of-arts.json",
    "fundamental-of-arts-payment-ex.html": "data/course-flows/fundamental-of-arts.json"
};
const COURSE_FLOW_CACHE = new Map();
const EX_STUDENT_DATA_CACHE = new Map();
const EARLY_BIRD_CONFIG_PATH = "data/early-bird-config.json";
const EARLY_BIRD_CONFIG_CACHE = new Map();
let courseRegionModalState = null;
let enrollmentTypeModalState = null;
const COURSE_ENTRY_PATH_PATTERN = /(?:^|\/)(?:pages\/(?:courses|fundamental-of-arts(?:-payment)?|the-art-of-meaning(?:-payment)?|the-art-of-meaning-core(?:-payment)?)\.html|(?:courses|fundamental-of-arts(?:-payment)?|the-art-of-meaning(?:-payment)?|the-art-of-meaning-core(?:-payment)?)\.html)$/i;
const COURSE_CURRENCY_TEXT_PATTERN = /(?:₹|â‚¹|INR|Rs\.?)\s*([0-9,]+)|\b([0-9][0-9,]*)\s*\/-/gi;

function getCourseFlowConfigPath(pageName) {
    return COURSE_FLOW_MANIFEST[pageName] || null;
}

async function loadCourseFlowConfig(pageName) {
    const configPath = getCourseFlowConfigPath(pageName);
    if (!configPath) return null;

    if (COURSE_FLOW_CACHE.has(configPath)) {
        return COURSE_FLOW_CACHE.get(configPath);
    }

    const response = await fetch(getAssetUrl(configPath), { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Unable to load course flow config for ${pageName}`);
    }

    const config = await response.json();
    COURSE_FLOW_CACHE.set(configPath, config);
    return config;
}

async function loadEarlyBirdConfig() {
    if (EARLY_BIRD_CONFIG_CACHE.has(EARLY_BIRD_CONFIG_PATH)) {
        return EARLY_BIRD_CONFIG_CACHE.get(EARLY_BIRD_CONFIG_PATH);
    }

    const response = await fetch(getAssetUrl(EARLY_BIRD_CONFIG_PATH), { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Unable to load early bird configuration.");
    }

    const config = await response.json();
    EARLY_BIRD_CONFIG_CACHE.set(EARLY_BIRD_CONFIG_PATH, config);
    return config;
}

function normalizeCouponCode(value) {
    return String(value || "").trim();
}

async function getEarlyBirdPaymentUrl(courseSlug, region, couponCode) {
    if (!courseSlug || !couponCode) return null;

    const config = await loadEarlyBirdConfig();
    const courseConfig = config?.courses?.[courseSlug];
    if (!courseConfig) return null;

    const regionConfig = courseConfig[region] || courseConfig.indian || null;
    if (!regionConfig || !regionConfig.couponCode || !regionConfig.couponUrl) {
        return null;
    }

    const normalizedInput = normalizeCouponCode(couponCode);
    if (regionConfig.couponCode !== normalizedInput) {
        return null;
    }

    return regionConfig.couponUrl;
}

function getExStudentDataUrl(region, courseSlug) {
    if (!courseSlug) return null;
    const normalizedRegion = region === "international" ? "international" : "indian";
    return getAssetUrl(`${EX_STUDENT_DATA_BASE_PATH}/${normalizedRegion}/${courseSlug}.json`);
}

async function getExStudentData(region, courseSlug) {
    const dataUrl = getExStudentDataUrl(region, courseSlug);
    if (!dataUrl) {
        throw new Error("Unable to determine ex-student data URL.");
    }

    if (EX_STUDENT_DATA_CACHE.has(dataUrl)) {
        return EX_STUDENT_DATA_CACHE.get(dataUrl);
    }

    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Unable to load ex-student data.");
    }

    const data = await response.json();
    EX_STUDENT_DATA_CACHE.set(dataUrl, data);
    return data;
}

function getPaymentPageInfo(pageName) {
    if (!pageName) return null;
    const match = pageName.match(/^(.*?)\-payment(?:-ex)?\.html$/);
    if (!match) return null;

    return {
        courseSlug: match[1],
        pageType: pageName.endsWith("-payment-ex.html") ? "ex" : "new"
    };
}

function getCourseRegionConfig(courseConfig, region) {
    if (!courseConfig || !courseConfig.enrollment) return null;
    return courseConfig.enrollment[region] || courseConfig.enrollment.indian || null;
}

function getCourseDestination(route) {
    if (!route || !route.url) return null;
    return {
        type: route.type || "page",
        url: route.url
    };
}

function isWisePaymentUrl(url) {
    return typeof url === "string" && /wise\.com\/pay\//i.test(url);
}

function preparePaymentIframe(iframeEl, paymentUrl) {
    if (!iframeEl || !paymentUrl) return;
    iframeEl.allow = "payment; clipboard-write; fullscreen";
    iframeEl.setAttribute("title", isWisePaymentUrl(paymentUrl) ? "Wise payment gateway" : "Payment gateway");
}

function navigateToCourseDestination(destination) {
    if (!destination || !destination.url) return;
    if (destination.type === "external") {
        window.location.href = destination.url;
        return;
    }

    window.location.href = new URL(destination.url, window.location.href).href;
}

function createWiseFallback(iframeEl, paymentUrl) {
    if (!iframeEl || !paymentUrl) return document.createElement("div");

    const existing = document.getElementById("wise-embed-fallback");
    if (existing) {
        existing.querySelector(".wise-fallback-link").href = paymentUrl;
        existing.querySelector(".wise-fallback-url").textContent = paymentUrl;
        existing.hidden = true;
        return existing;
    }

    const fallback = document.createElement("div");
    fallback.id = "wise-embed-fallback";
    fallback.className = "wise-fallback-panel";
    fallback.hidden = true;

    fallback.innerHTML = `
        <p class="wise-fallback-heading">Click the button below to complete your payment securely</p>
        <p class="wise-fallback-copy">Choose Bank Transfer if you don't have a Wise account</p>
        <a class="wise-fallback-link" href="${paymentUrl}" target="_blank" rel="noreferrer noopener">Continue to payment</a>
        <p class="wise-fallback-url">${paymentUrl}</p>
    `;

    iframeEl.parentNode.insertBefore(fallback, iframeEl.nextSibling);
    return fallback;
}

function closeCourseModals() {
    document.querySelectorAll(".course-region-modal.is-open").forEach((modal) => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("course-region-modal-open");
    courseRegionModalState = null;
    enrollmentTypeModalState = null;
}

async function findExStudentRecord(paymentId, courseSlug, region) {
    const normalizedPaymentId = normalizePaymentId(paymentId);
    const selectedRegion = region === "international" ? "international" : "indian";
    const data = await getExStudentData(selectedRegion);
    const coursePayments = data?.courses?.[courseSlug];
    if (!Array.isArray(coursePayments)) return null;

    return coursePayments.find((student) => normalizePaymentId(student.paymentId) === normalizedPaymentId) || null;
}

async function verifyExStudentPaymentId(paymentId, courseSlug, region) {
    const record = await findExStudentRecord(paymentId, courseSlug, region);
    return record !== null;
}

let courseCurrencyObserver = null;

function isCourseEntryPath(pathname) {
    return COURSE_ENTRY_PATH_PATTERN.test(pathname);
}

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

    const handleSelection = (event) => {
        const button = event.target.closest("[data-region]");
        if (!button) return;
        event.preventDefault();

        const region = button.dataset.region || "indian";
        const targetUrl = courseRegionModalState?.targetUrl || "";
        setSelectedCourseRegion(region);
        closeCourseModals();

        if (region === "international") {
            applyInternationalPricing();
            startInternationalPricingObserver();
        }

        if (targetUrl) {
            window.location.href = targetUrl;
            return;
        }

        if (typeof initExStudentPaymentPage === "function") {
            initExStudentPaymentPage();
        }
    };

    const choiceButtons = modal.querySelectorAll("[data-region]");
    choiceButtons.forEach((button) => {
        button.addEventListener("click", handleSelection);
        button.addEventListener("pointerup", handleSelection);
        button.addEventListener("touchend", handleSelection, { passive: false });
    });

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCourseModals();
    });

    modal.addEventListener("pointerdown", (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeCourseModals();
    });

    return modal;
}

function openCourseRegionModal(targetUrl) {
    const modal = createCourseRegionModal();
    courseRegionModalState = { targetUrl: targetUrl || "" };

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
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

        if (!isCourseEntryPath(resolvedUrl.pathname)) return;

        const openRegionModal = (event) => {
            if (event.defaultPrevented) return;
            if (event.type === "click" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (getSelectedCourseRegion()) return;

            event.preventDefault();
            openCourseRegionModal(resolvedUrl.href);
        };

        link.addEventListener("click", openRegionModal);
        link.addEventListener("pointerdown", openRegionModal);
        link.addEventListener("pointerup", openRegionModal);
        link.addEventListener("touchstart", openRegionModal, { passive: false });
        link.addEventListener("touchend", openRegionModal, { passive: false });
    });

    if (!getSelectedCourseRegion() && isCourseEntryPath(window.location.pathname)) {
        openCourseRegionModal();
    }

    initEnrollmentSelection();
}

function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
}

function createEnrollmentTypeModal() {
    const existing = document.getElementById("enrollment-type-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "enrollment-type-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="enrollment-type-title">
            <p class="course-region-eyebrow">Enrollment Type</p>
            <h2 id="enrollment-type-title">New student or ex student?</h2>
            <p class="course-region-copy">Choose the correct enrollment path before continuing to payment.</p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice" data-choice="new">New student</button>
                <button type="button" class="course-region-choice is-secondary" data-choice="ex">Ex student</button>
            </div>
            <p class="course-region-note">New students can enter an Early Bird coupon code or skip to pay the base price.</p>
            <p class="course-region-note">Ex students can verify a payment ID for the discounted payment experience.</p>
        </div>
    `;

    document.body.appendChild(modal);

    const handleSelection = (event) => {
        const button = event.target.closest("[data-choice]");
        if (!button) return;
        event.preventDefault();

        const state = enrollmentTypeModalState;
        if (!state) return;

        closeCourseModals();
        if (button.dataset.choice === "new") {
            openNewStudentModal(state.defaultDestination, state.courseSlug, state.region);
            return;
        }

        openExStudentVerificationModal(state.exDestination?.url || state.defaultDestination?.url, state.courseSlug, state.region);
    };

    const choiceButtons = modal.querySelectorAll("[data-choice]");
    choiceButtons.forEach((button) => {
        button.addEventListener("click", handleSelection);
        button.addEventListener("pointerup", handleSelection);
        button.addEventListener("touchend", handleSelection, { passive: false });
    });

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCourseModals();
    });

    modal.addEventListener("pointerdown", (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeCourseModals();
    });

    return modal;
}

function closeEnrollmentTypeModal() {
    const modal = document.getElementById("enrollment-type-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
    enrollmentTypeModalState = null;
}

function openEnrollmentTypeModal(defaultDestination, exDestination, courseSlug, region) {
    const modal = createEnrollmentTypeModal();
    enrollmentTypeModalState = {
        defaultDestination,
        exDestination,
        courseSlug,
        region
    };

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
}

function createNewStudentModal() {
    const existing = document.getElementById("new-student-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "new-student-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="new-student-title">
            <p class="course-region-eyebrow">Limited for Only Few hours..!!</p>
            <h2 id="new-student-title">Early Bird Discount</h2>
            <p class="course-region-copy">Apply a Unlock code to unlock a discounted payment link, or skip to continue with the standard course fee.</p>
            <form id="new-student-form" novalidate>
                <label>
                    Unlock code &nbsp;&nbsp;<small style="color: #737373;">(optional)</small>
                    <input type="text" name="couponCode" placeholder="Enter Unlock code" />
                </label>
                <p class="course-region-note" id="new-student-error" aria-live="polite"></p>
                <div class="course-region-actions">
                    <button type="submit" class="course-region-choice">Verify & Continue</button>
                    <button type="button" class="course-region-choice is-secondary" id="new-student-skip">Pay Regular Fees</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeNewStudentModal();
    });

    modal.addEventListener("pointerdown", (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeNewStudentModal();
    });

    return modal;
}

function closeNewStudentModal() {
    const modal = document.getElementById("new-student-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
}

function setNewStudentError(message) {
    const errorEl = document.getElementById("new-student-error");
    if (!errorEl) return;
    errorEl.textContent = message || "";
}

function openNewStudentModal(defaultDestination, courseSlug, region) {
    const modal = createNewStudentModal();
    const form = modal.querySelector("#new-student-form");
    const skipBtn = modal.querySelector("#new-student-skip");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
    setNewStudentError("");
    form.reset();

    form.onsubmit = async (event) => {
        event.preventDefault();
        setNewStudentError("");

        const formData = new FormData(form);
        const couponCode = String(formData.get("couponCode") || "").trim();
        if (!couponCode) {
            closeNewStudentModal();
            openCouponMismatchModal(defaultDestination, courseSlug, region);
            return;
        }

        try {
            const couponUrl = await getEarlyBirdPaymentUrl(courseSlug, region, couponCode);
            closeNewStudentModal();
            if (couponUrl) {
                window.location.href = couponUrl;
                return;
            }

            openCouponMismatchModal(defaultDestination, courseSlug, region);
        } catch (error) {
            console.error(error);
            closeNewStudentModal();
            navigateToCourseDestination(defaultDestination);
        }
    };

    skipBtn.onclick = () => {
        closeNewStudentModal();
        navigateToCourseDestination(defaultDestination);
    };
}

function createCouponMismatchModal() {
    const existing = document.getElementById("coupon-mismatch-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "coupon-mismatch-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="coupon-mismatch-title">
            <p class="course-region-eyebrow">Code Not Matched</p>
            <h2 id="coupon-mismatch-title">Unlock code not matched</h2>
            <p class="course-region-copy">The unlock code you entered is missing or does not match our early bird code.</p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice" id="coupon-mismatch-retry">Try again</button>
                <button type="button" class="course-region-choice is-secondary" id="coupon-mismatch-continue">Pay Regular Price</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCouponMismatchModal();
    });

    modal.addEventListener("pointerdown", (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeCouponMismatchModal();
    });

    return modal;
}

function closeCouponMismatchModal() {
    const modal = document.getElementById("coupon-mismatch-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
}

function openCouponMismatchModal(defaultDestination, courseSlug, region) {
    const modal = createCouponMismatchModal();
    const retryBtn = modal.querySelector("#coupon-mismatch-retry");
    const continueBtn = modal.querySelector("#coupon-mismatch-continue");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");

    retryBtn.onclick = () => {
        closeCouponMismatchModal();
        openNewStudentModal(defaultDestination, courseSlug, region);
    };

    continueBtn.onclick = () => {
        closeCouponMismatchModal();
        navigateToCourseDestination(defaultDestination);
    };
}

function createExStudentModal() {
    const existing = document.getElementById("ex-student-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "ex-student-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="ex-student-title">
            <p class="course-region-eyebrow">Ex-Student Discount</p>
            <h2 id="ex-student-title">Enter your payment ID</h2>
            <p class="course-region-copy">We will verify your payment ID and load the ex-student Discounted Price.</p>
            <form id="ex-student-form" novalidate>
                <label>
                    Payment ID &nbsp;&nbsp;<small style="color: #737373;">(Copy from your payment receipt)</small>
                    <input type="text" name="paymentId" placeholder="Payment ID" required />
                </label>
                <p class="course-region-note" id="ex-student-error" aria-live="polite"></p>
                <div class="course-region-actions">
                    <button type="submit" class="course-region-choice">Verify and continue</button>
                    <button type="button" class="course-region-choice is-secondary" id="ex-student-cancel">Cancel</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeExStudentModal();
    });

    modal.addEventListener("pointerdown", (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
    }, { passive: false });

    modal.addEventListener("touchstart", (event) => {
        if (event.target !== modal) {
            return;
        }
        event.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeExStudentModal();
    });

    return modal;
}

function closeExStudentModal() {
    const modal = document.getElementById("ex-student-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
    courseRegionModalState = null;
    enrollmentTypeModalState = null;
}

function setExStudentError(message) {
    const errorEl = document.getElementById("ex-student-error");
    if (!errorEl) return;
    errorEl.textContent = message || "";
}

function normalizePaymentId(value) {
    return String(value || "").trim();
}

function parseSearchParams() {
    const params = new URLSearchParams(window.location.search);
    let paymentId = "";
    let coupon = "";

    for (const [key, value] of params.entries()) {
        if (!value) continue;
        const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
        if (normalizedKey === "paymentid") {
            paymentId = String(value || "").trim();
            continue;
        }
        if (normalizedKey === "coupon") {
            coupon = String(value || "").trim();
            continue;
        }
    }

    return {
        paymentId: paymentId || "",
        coupon: coupon || ""
    };
}

async function getExStudentData(region, courseSlug) {
    const dataUrl = getExStudentDataUrl(region, courseSlug);
    if (!dataUrl) {
        throw new Error("Unable to determine ex-student data URL.");
    }

    if (EX_STUDENT_DATA_CACHE.has(dataUrl)) {
        return EX_STUDENT_DATA_CACHE.get(dataUrl);
    }

    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Unable to load ex-student data.");
    }

    const data = await response.json();
    EX_STUDENT_DATA_CACHE.set(dataUrl, data);
    return data;
}

async function findExStudentRecord(paymentId, courseSlug, region) {
    const normalizedPaymentId = normalizePaymentId(paymentId);
    const data = await getExStudentData(region, courseSlug);
    const paymentIds = data?.paymentIds;
    if (!Array.isArray(paymentIds)) return null;

    return paymentIds.find((student) => normalizePaymentId(student.paymentId) === normalizedPaymentId) || null;
}

async function verifyExStudentPaymentId(paymentId, courseSlug, region) {
    const record = await findExStudentRecord(paymentId, courseSlug, region);
    return record !== null;
}

async function initExStudentPaymentPage() {
    const pageName = window.location.pathname.split("/").pop();
    const pageInfo = getPaymentPageInfo(pageName);
    if (!pageInfo) return;

    const courseConfig = await loadCourseFlowConfig(pageName);
    if (!courseConfig) return;

    const region = getSelectedCourseRegion() || "indian";
    const paymentUrlFromConfig = courseConfig.paymentLinks?.[region]?.[pageInfo.pageType];
    const statusEl = document.getElementById("ex-student-payment-status");
    const iframeEl = document.querySelector(".payment-page-iframe") || document.getElementById("ex-student-payment-iframe");
    const loaderEl = document.getElementById("ex-student-payment-loader");

    const showLoader = () => loaderEl?.classList.add("is-visible");
    const hideLoader = () => loaderEl?.classList.remove("is-visible");

    if (!iframeEl) return;

    if (pageInfo.pageType === "new") {
        const { coupon } = parseSearchParams();
        let paymentUrl = paymentUrlFromConfig;

        if (coupon) {
            const couponUrl = await getEarlyBirdPaymentUrl(pageInfo.courseSlug, region, coupon);
            if (couponUrl) {
                paymentUrl = couponUrl;
            } else if (statusEl) {
                statusEl.textContent = "Invalid coupon code. Loading the standard payment page.";
            }
        }

        if (paymentUrl) {
            const fallback = createWiseFallback(iframeEl, paymentUrl);
            if (isWisePaymentUrl(paymentUrl)) {
                hideLoader();
                iframeEl.style.display = "none";
                fallback.hidden = false;
            } else {
                iframeEl.style.display = "block";
                preparePaymentIframe(iframeEl, paymentUrl);
                iframeEl.onload = () => {
                    hideLoader();
                    fallback.hidden = true;
                };
                iframeEl.onerror = () => {
                    hideLoader();
                    fallback.hidden = false;
                };
                iframeEl.src = paymentUrl;
            }
        }
        return;
    }

    const { paymentId } = parseSearchParams();
    if (!paymentId) {
        if (statusEl) {
            statusEl.textContent = "No payment ID was provided. Please return to the course page and verify your ex-student details.";
        } else {
            alert("No payment ID was provided. Please return to the course page and verify your ex-student details.");
        }
        return;
    }

    try {
        const record = await findExStudentRecord(paymentId, pageInfo.courseSlug, region);
        if (!record) {
            if (statusEl) {
                statusEl.textContent = "Could not verify your payment ID. Please check it and try again.";
            } else {
                alert("Could not verify your payment ID. Please check it and try again.");
            }
            return;
        }

        const finalUrl = record.paymentUrl || paymentUrlFromConfig;
        if (!finalUrl) {
            if (statusEl) {
                statusEl.textContent = "No payment URL is configured for this payment ID. Please contact support.";
            } else {
                alert("No payment URL is configured for this payment ID. Please contact support.");
            }
            return;
        }

        if (statusEl) {
            statusEl.textContent = "";
        }
        showLoader();
        const fallback = createWiseFallback(iframeEl, finalUrl);
        if (isWisePaymentUrl(finalUrl)) {
            hideLoader();
            iframeEl.style.display = "none";
            fallback.hidden = false;
        } else {
            iframeEl.style.display = "block";
            iframeEl.onload = () => {
                hideLoader();
                fallback.hidden = true;
            };
            iframeEl.onerror = () => {
                hideLoader();
                fallback.hidden = false;
            };
            preparePaymentIframe(iframeEl, finalUrl);
            iframeEl.src = finalUrl;
        }
    } catch (error) {
        console.error(error);
        if (statusEl) {
            statusEl.textContent = "Unable to load your payment page right now. Please try again later.";
        }
    }
}

function openExStudentVerificationModal(exUrl, courseSlug, region) {
    const modal = createExStudentModal();
    const form = modal.querySelector("#ex-student-form");
    const cancelBtn = modal.querySelector("#ex-student-cancel");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
    setExStudentError("");

    form.reset();

    form.onsubmit = async (event) => {
        event.preventDefault();
        setExStudentError("");

        const formData = new FormData(form);
        const paymentId = String(formData.get("paymentId") || "").trim();

        if (!paymentId) {
            setExStudentError("Please enter your payment ID.");
            return;
        }

        try {
            const valid = await verifyExStudentPaymentId(paymentId, courseSlug, region);
            if (!valid) {
                setExStudentError("No matching payment ID found. Please check it and try again.");
                return;
            }

            closeExStudentModal();
            window.location.href = `${new URL(exUrl, window.location.href).href}?paymentId=${encodeURIComponent(paymentId)}`;
        } catch (error) {
            console.error(error);
            setExStudentError("Unable to verify the payment ID right now. Please try again later.");
        }
    };

    cancelBtn.onclick = () => {
        closeExStudentModal();
    };
}

function initEnrollmentSelection() {
    const links = [...document.querySelectorAll("a[href]")];
    links.forEach((link) => {
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref.startsWith("#")) return;

        let resolvedUrl;
        try {
            resolvedUrl = new URL(rawHref, window.location.href);
        } catch (_) {
            return;
        }

        const hrefPage = resolvedUrl.pathname.split("/").pop();
        if (!getCourseFlowConfigPath(hrefPage)) return;

        const openEnrollmentModal = async (event) => {
            if (event.defaultPrevented) return;
            if (event.type === "click" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();

            const courseConfig = await loadCourseFlowConfig(hrefPage);
            const region = getSelectedCourseRegion() || "indian";
            const courseInfo = getPaymentPageInfo(hrefPage);
            const regionConfig = getCourseRegionConfig(courseConfig, region);
            if (!regionConfig || !courseInfo) {
                window.location.href = new URL(hrefPage, window.location.href).href;
                return;
            }

            openEnrollmentTypeModal(
                getCourseDestination(regionConfig.new),
                getCourseDestination(regionConfig.ex),
                courseInfo.courseSlug,
                region
            );
        };

        link.addEventListener("click", openEnrollmentModal);
        link.addEventListener("pointerdown", openEnrollmentModal);
        link.addEventListener("pointerup", openEnrollmentModal);
        link.addEventListener("touchstart", openEnrollmentModal, { passive: false });
        link.addEventListener("touchend", openEnrollmentModal, { passive: false });
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

function initAlertCloseButton() {
    const banner = document.getElementById("alert-banner");
    const heroBand = document.querySelector(".hero-band");
    const closeButton = banner?.querySelector(".alert-close");
    if (!banner || !closeButton) return;

    closeButton.addEventListener("click", () => {
        banner.classList.add("is-hidden");
        if (heroBand) heroBand.classList.add("hero-shifted");
    });
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
initAlertCloseButton();
initFeedbackWidget();
initEmbeddedPdfViewer();
initDetailsGalleryButtons();
initSectionLottieIcons();
initCourseRegionSelection();
initExStudentPaymentPage();
