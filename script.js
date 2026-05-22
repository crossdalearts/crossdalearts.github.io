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
        img.alt = imgEl.alt || "Course image";
        img.className = "gallery-lightbox-media";
        img.loading = "eager";
        img.decoding = "async";
        renderGalleryImageWithLoader(img, imgEl.currentSrc || imgEl.src);
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

function loadFeatureScript(relativePath) {
    const url = getAssetUrl(String(relativePath || "").trim());
    if (!url) return Promise.reject(new Error("Invalid feature script path"));
    if (document.querySelector(`script[src="${url}"]`)) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.defer = true;
        script.async = false;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error(`Failed to load ${url}`)), { once: true });
        document.head.appendChild(script);
    });
}

function initDynamicFeatureLoader() {
    const galleryTrigger = document.querySelector('[data-gallery-config], #gallery-showcase, #artworks-for-sale-grid');
    if (galleryTrigger) {
        loadFeatureScript("gallery.js")
            .then(() => {
                if (typeof initDetailsGalleryButtons === "function") initDetailsGalleryButtons();
                if (typeof initArtworksForSaleGrid === "function") initArtworksForSaleGrid();
                if (typeof initGalleryExperience === "function") initGalleryExperience();
            })
            .catch(() => {});
    }

    const feedbackAnchor = document.getElementById("feedback-widget-anchor");
    if (feedbackAnchor) {
        loadFeatureScript("feedback.js")
            .then(() => {
                if (typeof initFeedbackWidget === "function") initFeedbackWidget();
            })
            .catch(() => {});
    }
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
const MASTERCLASS_CONFIG_PATH = "data/masterclass-config.json";
let masterclassConfigPromise = null;
let courseRegionModalState = null;
let enrollmentTypeModalState = null;
let masterclassRegistrationModalState = null;
const NEWSLETTER_SUBSCRIBED_KEY = "crossdalearts_newsletter_subscribed_v1";
const NEWSLETTER_EMAIL_KEY = "crossdalearts_newsletter_email_v1";
const NEWSLETTER_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwzOk7DmxWs-9i3vsuhb6KNQzLFrSRS1OG2zeX7dIHabiGa__En7nbuKoJXVEXfEb80/exec";
let newsletterModalTimerId = null;
const COURSE_ENTRY_PAGE_NAMES = new Set([
    "courses.html",
    "fundamental-of-arts.html",
    "the-art-of-meaning.html",
    "the-art-of-meaning-core.html",
    "fundamental-of-arts-payment.html",
    "fundamental-of-arts-payment-ex.html",
    "the-art-of-meaning-payment.html",
    "the-art-of-meaning-payment-ex.html",
    "the-art-of-meaning-core-payment.html",
    "the-art-of-meaning-core-payment-ex.html"
]);
const COURSE_CURRENCY_TEXT_PATTERN = /(?:₹|â‚¹|INR|Rs\.?)\s*([0-9,]+)|\b([0-9][0-9,]*)\s*\/-/gi;

function normalizeHtmlPageName(value) {
    const safeValue = String(value || "").trim().split("?")[0].split("#")[0].replace(/\/+$/, "");
    if (!safeValue) return "";
    const pageName = safeValue.split("/").pop() || "";
    if (!pageName) return "";
    return pageName.toLowerCase().endsWith(".html") ? pageName : `${pageName}.html`;
}

function getCourseFlowConfigPath(pageName) {
    const normalizedPageName = normalizeHtmlPageName(pageName);
    return COURSE_FLOW_MANIFEST[normalizedPageName] || null;
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

function normalizeConfigPath(path, fallbackPath = "") {
    const trimmed = String(path || "").trim().replace(/\\/g, "/");
    const withoutPrefixes = trimmed.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
    return withoutPrefixes || fallbackPath;
}

function getDefaultMasterclassConfig() {
    return {
        enabled: true,
        pagePath: "https://crossdalearts-registration.github.io/",
        labels: {
            nav: "Masterclass",
            heroButton: "Masterclass"
        },
        page: {
            title: "Masterclass - CrossdaleArts",
            description: "Upcoming CrossdaleArts masterclass details and class focus."
        },
        upcomingClass: {
            title: "Upcoming Masterclass",
            forClass: "The Realism Within (Basic to Advance)",
            shortDescription: "A focused session on visual storytelling, composition planning, and making ideas original before final rendering.",
            image: "images/basictoadvance.png",
            imageAlt: "Upcoming CrossdaleArts masterclass artwork",
            date: "",
            mode: "Live online session",
            ctaLabel: "My Story",
            ctaLink: "pages/my-story.html"
        },
        registration: {
            buttonLabel: "Registrations",
            pagePath: "pages/masterclass-registration.html",
            pageTitle: "Masterclass Registration - CrossdaleArts",
            pageDescription: "Complete your registration for the upcoming CrossdaleArts masterclass.",
            statusText: "Complete your registration for the upcoming masterclass using the secure payment option below.",
            paymentLinkLabel: "Open Razorpay payment in new tab",
            paymentUrl: "https://rzp.io/rzp/MoKp92J",
            paymentLinks: {
                indian: "https://rzp.io/rzp/MoKp92J",
                international: ""
            }
        }
    };
}

function getMasterclassPagePath(config) {
    const fallbackPath = getDefaultMasterclassConfig().pagePath;
    return normalizeConfigPath(config?.pagePath || config?.page?.path, fallbackPath);
}

function getMasterclassLinkHref(config) {
    return getAssetUrl(getMasterclassPagePath(config));
}

function getMasterclassRegistrationPagePath(config) {
    const fallbackPath = getDefaultMasterclassConfig().registration.pagePath;
    return normalizeConfigPath(config?.registration?.pagePath, fallbackPath);
}

async function loadMasterclassConfig() {
    if (masterclassConfigPromise) return masterclassConfigPromise;

    masterclassConfigPromise = (async () => {
        const response = await fetch(getAssetUrl(MASTERCLASS_CONFIG_PATH), { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Unable to load masterclass configuration.");
        }

        const config = await response.json();
        return config && typeof config === "object" ? config : {};
    })();

    try {
        return await masterclassConfigPromise;
    } catch (error) {
        masterclassConfigPromise = null;
        throw error;
    }
}

function upsertMasterclassNavLink(config) {
    const navList = document.querySelector("#navbar ul");
    if (!navList) return;

    const isEnabled = config?.enabled !== false;
    const existingLink = navList.querySelector("a[data-masterclass-nav]") || navList.querySelector('a[href$="masterclass.html"]');
    const existingItem = existingLink?.closest("li");

    if (!isEnabled) {
        if (existingItem) existingItem.remove();
        return;
    }

    let anchor = existingLink;
    let listItem = existingItem;

    if (!anchor) {
        listItem = document.createElement("li");
        anchor = document.createElement("a");
        anchor.dataset.masterclassNav = "true";
        listItem.appendChild(anchor);

        const myStoryLink = [...navList.querySelectorAll("a")].find((link) => /my-story\.html$/i.test(link.getAttribute("href") || ""));
        const myStoryItem = myStoryLink?.closest("li");
        if (myStoryItem) navList.insertBefore(listItem, myStoryItem);
        else navList.appendChild(listItem);
    }

    const navLabel = String(config?.labels?.nav || config?.navLabel || "Masterclass").trim() || "Masterclass";
    anchor.textContent = navLabel;
    anchor.href = getMasterclassLinkHref(config);
}

function upsertMasterclassHeroButton(config) {
    const heroActions = document.querySelector(".hero-actions");
    if (!heroActions) return;

    const isEnabled = config?.enabled !== false;
    let button = heroActions.querySelector("a[data-masterclass-hero]");

    if (!isEnabled) {
        if (button) button.remove();
        return;
    }

    if (!button) {
        button = document.createElement("a");
        button.dataset.masterclassHero = "true";
        button.className = "secondary-cta";
        const myStoryButton = [...heroActions.querySelectorAll("a")].find((link) => /my-story\.html$/i.test(link.getAttribute("href") || ""));
        if (myStoryButton) heroActions.insertBefore(button, myStoryButton);
        else heroActions.appendChild(button);
    }

    const heroLabel = String(config?.labels?.heroButton || config?.heroButtonLabel || "Masterclass").trim() || "Masterclass";
    button.textContent = heroLabel;
    button.href = getMasterclassLinkHref(config);
}

function setTextContentBySelector(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.textContent = String(value || "").trim();
}

function setParagraphContentWithBreaks(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    const rawText = String(value || "").trim();
    const escapedText = rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Allow only <br> tags from config and convert plain new lines to breaks.
    element.innerHTML = escapedText
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
        .replace(/\r?\n/g, "<br>");
}

function createMasterclassRegistrationRegionModal() {
    const existing = document.getElementById("masterclass-registration-region-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "masterclass-registration-region-modal";
    modal.className = "course-region-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div class="course-region-dialog" role="dialog" aria-modal="true" aria-labelledby="masterclass-region-title">
            <p class="course-region-eyebrow">Masterclass Registration</p>
            <h2 id="masterclass-region-title">Select your region</h2>
            <p class="course-region-copy">Choose the payment page that matches your location.</p>
            <div class="course-region-actions">
                <button type="button" class="course-region-choice" data-masterclass-region="indian">Indian</button>
                <button type="button" class="course-region-choice is-secondary" data-masterclass-region="international">International</button>
            </div>
            <p class="course-region-note">International Artists must send their screenshots on instagram..!!</code>.</p>
        </div>
    `;

    document.body.appendChild(modal);

    const chooseRegion = (event) => {
        const button = event.target.closest("[data-masterclass-region]");
        if (!button || button.disabled) return;
        event.preventDefault();

        const region = button.dataset.masterclassRegion === "international" ? "international" : "indian";
        const targetUrl = masterclassRegistrationModalState?.paymentLinks?.[region] || "";
        if (!targetUrl) return;

        closeCourseModals();
        window.location.href = targetUrl;
    };

    modal.querySelectorAll("[data-masterclass-region]").forEach((button) => {
        button.addEventListener("click", chooseRegion);
    });

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCourseModals();
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeCourseModals();
    });

    return modal;
}

function openMasterclassRegistrationRegionModal(registrationConfig, fallbackRegistration) {
    const modal = createMasterclassRegistrationRegionModal();
    const configLinks = registrationConfig?.paymentLinks && typeof registrationConfig.paymentLinks === "object"
        ? registrationConfig.paymentLinks
        : {};
    const fallbackLinks = fallbackRegistration?.paymentLinks && typeof fallbackRegistration.paymentLinks === "object"
        ? fallbackRegistration.paymentLinks
        : {};

    const indianUrl = String(
        configLinks.indian ||
        registrationConfig?.paymentUrl ||
        fallbackLinks.indian ||
        fallbackRegistration?.paymentUrl ||
        ""
    ).trim();
    const internationalUrl = String(
        configLinks.international ||
        fallbackLinks.international ||
        ""
    ).trim();

    masterclassRegistrationModalState = {
        paymentLinks: {
            indian: indianUrl,
            international: internationalUrl
        }
    };

    const indianButton = modal.querySelector('[data-masterclass-region="indian"]');
    const internationalButton = modal.querySelector('[data-masterclass-region="international"]');
    if (indianButton) indianButton.disabled = !indianUrl;
    if (internationalButton) internationalButton.disabled = !internationalUrl;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
}

function applyMasterclassPageContent(config) {
    const pageRoot = document.getElementById("masterclass-page");
    if (!pageRoot) return;

    const fallback = getDefaultMasterclassConfig();
    const masterclass = {
        ...fallback.upcomingClass,
        ...(config?.upcomingClass && typeof config.upcomingClass === "object" ? config.upcomingClass : {})
    };
    const pageConfig = {
        ...fallback.page,
        ...(config?.page && typeof config.page === "object" ? config.page : {})
    };
    const registrationConfig = {
        ...fallback.registration,
        ...(config?.registration && typeof config.registration === "object" ? config.registration : {})
    };

    const imagePath = normalizeConfigPath(masterclass.image, fallback.upcomingClass.image);
    const ctaPath = normalizeConfigPath(masterclass.ctaLink, fallback.upcomingClass.ctaLink);
    const imageElement = pageRoot.querySelector("[data-masterclass-image]");
    const ctaElement = pageRoot.querySelector("[data-masterclass-cta]");
    const registerElement = pageRoot.querySelector("[data-masterclass-register-cta]");

    setTextContentBySelector("[data-masterclass-title]", masterclass.title);
    setParagraphContentWithBreaks("[data-masterclass-description]", masterclass.shortDescription);
    setTextContentBySelector("[data-masterclass-for-class]", masterclass.forClass);
    setTextContentBySelector("[data-masterclass-date]", masterclass.date || "To be announced");
    setTextContentBySelector("[data-masterclass-mode]", masterclass.mode);

    if (imageElement) {
        imageElement.src = getAssetUrl(imagePath);
        imageElement.alt = String(masterclass.imageAlt || fallback.upcomingClass.imageAlt).trim();
    }

    if (ctaElement) {
        ctaElement.textContent = String(masterclass.ctaLabel || fallback.upcomingClass.ctaLabel).trim();
        ctaElement.href = getAssetUrl(ctaPath);
    }

    if (registerElement) {
        const label = String(registrationConfig.buttonLabel || fallback.registration.buttonLabel).trim() || fallback.registration.buttonLabel;
        registerElement.textContent = label;
        registerElement.href = getAssetUrl(getMasterclassRegistrationPagePath(config));
        registerElement.onclick = (event) => {
            if (event.defaultPrevented) return;
            if (event.type === "click" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openMasterclassRegistrationRegionModal(registrationConfig, fallback.registration);
        };
    }

    if (pageConfig.title) document.title = String(pageConfig.title).trim();
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta && pageConfig.description) {
        descriptionMeta.setAttribute("content", String(pageConfig.description).trim());
    }
}

function applyMasterclassRegistrationPageContent(config) {
    const pageRoot = document.getElementById("masterclass-registration-page");
    if (!pageRoot) return;

    const fallback = getDefaultMasterclassConfig();
    const registration = {
        ...fallback.registration,
        ...(config?.registration && typeof config.registration === "object" ? config.registration : {})
    };

    const paymentUrl = String(registration.paymentUrl || fallback.registration.paymentUrl).trim();
    const statusEl = pageRoot.querySelector("[data-masterclass-registration-status]");
    const linkEl = pageRoot.querySelector("[data-masterclass-registration-link]");
    const iframeEl = pageRoot.querySelector("[data-masterclass-registration-iframe]");

    if (statusEl) {
        statusEl.textContent = String(registration.statusText || fallback.registration.statusText).trim();
    }

    if (linkEl) {
        linkEl.textContent = String(registration.paymentLinkLabel || fallback.registration.paymentLinkLabel).trim();
        linkEl.href = paymentUrl;
    }

    if (iframeEl) {
        iframeEl.src = paymentUrl;
    }

    if (registration.pageTitle) document.title = String(registration.pageTitle).trim();
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta && registration.pageDescription) {
        descriptionMeta.setAttribute("content", String(registration.pageDescription).trim());
    }
}

async function initMasterclassExperience() {
    const fallbackConfig = getDefaultMasterclassConfig();

    try {
        const config = await loadMasterclassConfig();
        const mergedConfig = {
            ...fallbackConfig,
            ...config,
            labels: { ...fallbackConfig.labels, ...(config?.labels || {}) },
            page: { ...fallbackConfig.page, ...(config?.page || {}) },
            upcomingClass: { ...fallbackConfig.upcomingClass, ...(config?.upcomingClass || {}) },
            registration: { ...fallbackConfig.registration, ...(config?.registration || {}) }
        };

        upsertMasterclassNavLink(mergedConfig);
        upsertMasterclassHeroButton(mergedConfig);
        applyMasterclassPageContent(mergedConfig);
        applyMasterclassRegistrationPageContent(mergedConfig);
    } catch (error) {
        console.warn("Masterclass config could not be loaded.", error);
        upsertMasterclassNavLink(fallbackConfig);
        upsertMasterclassHeroButton(fallbackConfig);
        applyMasterclassPageContent(fallbackConfig);
        applyMasterclassRegistrationPageContent(fallbackConfig);
    }
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
    const normalizedPageName = normalizeHtmlPageName(pageName);
    if (!normalizedPageName) return null;
    const match = normalizedPageName.match(/^(.*?)\-payment(?:-ex)?\.html$/);
    if (!match) return null;

    return {
        courseSlug: match[1],
        pageType: normalizedPageName.endsWith("-payment-ex.html") ? "ex" : "new"
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

function getDefaultEnrollmentDestinations(courseSlug) {
    if (!courseSlug) return { newDestination: null, exDestination: null };
    return {
        newDestination: { type: "page", url: `${courseSlug}-payment.html` },
        exDestination: { type: "page", url: `${courseSlug}-payment-ex.html` }
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
    masterclassRegistrationModalState = null;
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
    const pageName = normalizeHtmlPageName(pathname);
    return COURSE_ENTRY_PAGE_NAMES.has(pageName);
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
    });

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCourseModals();
    });

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
    });

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeCourseModals();
    });

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

function createNewsletterModal() {
    const existing = document.getElementById("newsletter-modal");
    if (existing) return existing;

    const modal = document.createElement("div");
    modal.id = "newsletter-modal";
    modal.className = "course-region-modal newsletter-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="course-region-dialog newsletter-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="newsletter-title">
            <button type="button" class="newsletter-modal-close" id="newsletter-close" aria-label="Close newsletter modal">&times;</button>
            <p class="course-region-eyebrow">CrossdaleArts Updates</p>
            <h2 id="newsletter-title">Join our newsletter</h2>
            <p class="course-region-copy">Enter your email address and subscribe to get the latest updates regarding CrossdaleArts in your mailbox directly.</p>
            <form id="newsletter-form" novalidate>
                <label for="newsletter-email">
                    Email address
                    <input type="email" id="newsletter-email" name="email" placeholder="you@example.com" autocomplete="email" required />
                </label>
                <p class="course-region-note" id="newsletter-status" aria-live="polite"></p>
                <div class="course-region-actions newsletter-actions">
                    <button type="submit" class="course-region-choice" id="newsletter-submit">Subscribe</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
        if (event.target !== modal) return;
        closeNewsletterModal();
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        closeNewsletterModal();
    });

    const closeButton = modal.querySelector("#newsletter-close");
    closeButton?.addEventListener("click", closeNewsletterModal);

    return modal;
}

function closeNewsletterModal() {
    const modal = document.getElementById("newsletter-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("course-region-modal-open");
    scheduleNewsletterModal();
}

function setNewsletterStatus(message) {
    const status = document.getElementById("newsletter-status");
    if (!status) return;
    status.textContent = message || "";
}

function isNewsletterSubscribed() {
    return localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY) === "true";
}

function getRandomNewsletterDelayMs() {
    return Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;
}

function scheduleNewsletterModal() {
    if (newsletterModalTimerId) {
        clearTimeout(newsletterModalTimerId);
    }

    if (isNewsletterSubscribed()) return;

    const randomDelayMs = getRandomNewsletterDelayMs();
    newsletterModalTimerId = window.setTimeout(() => {
        newsletterModalTimerId = null;
        openNewsletterModal();
    }, randomDelayMs);
}

async function submitNewsletterEmail(email) {
    if (!NEWSLETTER_APPS_SCRIPT_URL || NEWSLETTER_APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
        throw new Error("Newsletter endpoint not configured.");
    }

    const payload = {
        email,
        source: window.location.pathname,
        submittedAt: new Date().toISOString()
    };

    const formPayload = new URLSearchParams(payload).toString();

    // Primary: Apps Script-friendly form POST without CORS preflight.
    try {
        await fetch(NEWSLETTER_APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: formPayload
        });
        return;
    } catch (_) {
        // Continue to fallback below.
    }

    // Fallback: query-string GET, useful for some Apps Script deployments.
    const fallbackUrl = new URL(NEWSLETTER_APPS_SCRIPT_URL);
    Object.entries(payload).forEach(([key, value]) => fallbackUrl.searchParams.set(key, value));
    fallbackUrl.searchParams.set("action", "subscribe");

    await fetch(fallbackUrl.toString(), {
        method: "GET",
        mode: "no-cors"
    });
}

function openNewsletterModal() {
    if (isNewsletterSubscribed()) return;

    if (document.querySelector(".course-region-modal.is-open")) {
        scheduleNewsletterModal();
        return;
    }

    const modal = createNewsletterModal();
    const form = modal.querySelector("#newsletter-form");
    const emailInput = modal.querySelector("#newsletter-email");
    const submitBtn = modal.querySelector("#newsletter-submit");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("course-region-modal-open");
    setNewsletterStatus("");
    form.reset();

    form.onsubmit = async (event) => {
        event.preventDefault();
        setNewsletterStatus("");

        const email = String(emailInput.value || "").trim();
        if (!email || !emailInput.checkValidity()) {
            setNewsletterStatus("Please enter a valid email address.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Subscribing...";

        try {
            await submitNewsletterEmail(email);
            localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, "true");
            localStorage.setItem(NEWSLETTER_EMAIL_KEY, email);
            if (newsletterModalTimerId) {
                clearTimeout(newsletterModalTimerId);
                newsletterModalTimerId = null;
            }
            setNewsletterStatus("Thanks for subscribing. You'll receive CrossdaleArts updates in your mailbox.");
            window.setTimeout(() => {
                closeNewsletterModal();
            }, 1400);
        } catch (error) {
            console.error(error);
            setNewsletterStatus("Unable to subscribe right now. Please try again shortly.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Subscribe";
        }
    };
}

function initRandomNewsletterModal() {
    if (isNewsletterSubscribed()) return;
    scheduleNewsletterModal();
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
    const coursePayments = data?.courses?.[courseSlug];
    if (Array.isArray(coursePayments)) {
        const matchedCourseRecord = coursePayments.find(
            (student) => normalizePaymentId(student.paymentId) === normalizedPaymentId
        );
        if (matchedCourseRecord) return matchedCourseRecord;
    }

    const paymentIds = data?.paymentIds;
    if (!Array.isArray(paymentIds)) return null;
    return paymentIds.find((student) => normalizePaymentId(student.paymentId) === normalizedPaymentId) || null;
}

async function verifyExStudentPaymentId(paymentId, courseSlug, region) {
    const record = await findExStudentRecord(paymentId, courseSlug, region);
    return record !== null;
}

async function initExStudentPaymentPage() {
    const pageName = normalizeHtmlPageName(window.location.pathname);
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

        const hrefPage = normalizeHtmlPageName(resolvedUrl.pathname);
        if (!getCourseFlowConfigPath(hrefPage)) return;

        const openEnrollmentModal = async (event) => {
            if (event.defaultPrevented) return;
            if (event.type === "click" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const region = getSelectedCourseRegion() || "indian";
            const courseInfo = getPaymentPageInfo(hrefPage);
            if (!courseInfo) {
                window.location.href = new URL(hrefPage, window.location.href).href;
                return;
            }

            const fallbackDestinations = getDefaultEnrollmentDestinations(courseInfo.courseSlug);
            let newDestination = fallbackDestinations.newDestination;
            let exDestination = fallbackDestinations.exDestination;

            try {
                const courseConfig = await loadCourseFlowConfig(hrefPage);
                const regionConfig = getCourseRegionConfig(courseConfig, region);
                if (regionConfig) {
                    newDestination = getCourseDestination(regionConfig.new) || newDestination;
                    exDestination = getCourseDestination(regionConfig.ex) || exDestination;
                }
            } catch (_) {
                // Keep static fallback routes so modal still works even if JSON fetch fails on host.
            }

            openEnrollmentTypeModal(
                newDestination,
                exDestination,
                courseInfo.courseSlug,
                region
            );
        };

        link.addEventListener("click", openEnrollmentModal);
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
        "#masterclass-page > *",
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
initEmbeddedPdfViewer();
initDynamicFeatureLoader();
initSectionLottieIcons();
initCourseRegionSelection();
initExStudentPaymentPage();
initMasterclassExperience();
initRandomNewsletterModal();
