const FEEDBACK_ROTATION_MS = 400;
const FEEDBACK_TRANSITION_MS = 400;
const FEEDBACK_DATA_URL = getAssetUrl("data/feedbacks.json");
const FEEDBACK_STORAGE_KEY = "crossdale_feedbacks";
const FEEDBACK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyui-RYjmGSf9y9u36Z1jiqgrkK40zr8vjqHrns3Nfm4BB7jMgOOkAXfwwjmQXPuioG/exec";
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

    // Keep public feedback list clean: remove previously browser-saved submissions.
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);

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
    count.setAttribute("role", "button");
    count.setAttribute("tabindex", "0");
    count.setAttribute("aria-label", "See all feedback");

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

    const widgetActions = document.createElement("div");
    widgetActions.className = "feedback-widget-actions";

    const leaveFeedbackBtn = document.createElement("button");
    leaveFeedbackBtn.type = "button";
    leaveFeedbackBtn.className = "feedback-leave-btn";
    leaveFeedbackBtn.textContent = "Leave Feedback";

    const seeAllBtn = document.createElement("button");
    seeAllBtn.type = "button";
    seeAllBtn.className = "feedback-see-all-btn";
    seeAllBtn.textContent = "See all";

    widgetActions.appendChild(leaveFeedbackBtn);
    widgetActions.appendChild(seeAllBtn);
    widget.appendChild(widgetActions);
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
    const feedbackState = {
        getList: () => feedbacks
    };

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

    function openDetailAt(index) {
        const list = feedbackState.getList();
        if (!list.length) return;
        const safeIndex = Math.max(0, Math.min(list.length - 1, index));
        openFeedbackDetailModal(detailModal, list, safeIndex, openDetailAt, openGridView);
    }

    function openGridView() {
        const list = feedbackState.getList();
        if (!list.length) return;
        openFeedbackGridModal(detailModal, list, openDetailAt);
    }

    function openFullFeedback() {
        if (!feedbacks.length) return;
        openDetailAt(currentIndex);
    }

    async function onSubmitFeedback(entry) {
        const newEntry = sanitizeFeedback(entry);
        if (!newEntry) return { ok: false, message: "Invalid feedback details." };

        const saveResult = await saveFeedbackEntry(newEntry);
        if (!saveResult.ok) return saveResult;

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

    leaveFeedbackBtn.addEventListener("click", () => {
        openFeedbackFormModal(detailModal, onSubmitFeedback);
    });
    seeAllBtn.addEventListener("click", openGridView);
    count.addEventListener("click", openGridView);
    count.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openGridView();
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
        modal.classList.remove("is-feedback-detail", "is-feedback-grid");
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

function openFeedbackDetailModal(detailModal, feedbacks, currentIndex, onNavigate, onSeeAll) {
    if (!Array.isArray(feedbacks) || !feedbacks.length) return;
    const safeIndex = Math.max(0, Math.min(feedbacks.length - 1, Number(currentIndex) || 0));
    const safe = sanitizeFeedback(feedbacks[safeIndex]);
    if (!safe) return;

    const hasPrev = safeIndex > 0;
    const hasNext = safeIndex < feedbacks.length - 1;

    detailModal.modal.classList.add("is-feedback-detail");
    detailModal.modal.classList.remove("is-feedback-grid");
    detailModal.modal.innerHTML = `
        <div class="feedback-modal-top" style="border-bottom:none; box-shadow:none;">
            <h2>Learners Feedback</h2>
            <button type="button" class="feedback-modal-close" aria-label="Close">×</button>
        </div>
        <div class="feedback-modal-name">${escapeHTML(safe.name)}</div>
        <div class="feedback-modal-stars">${renderStars(safe.rating)}</div>
        <p class="feedback-modal-message">${escapeHTML(safe.message)}</p>
        <div class="feedback-detail-actions">
            <button type="button" class="feedback-detail-nav-btn" data-feedback-nav="prev" ${hasPrev ? "" : "disabled"}>Previous</button>
            <button type="button" class="feedback-detail-nav-btn" data-feedback-nav="next" ${hasNext ? "" : "disabled"}>Next</button>
            <button type="button" class="feedback-detail-see-all" data-feedback-see-all>See all</button>
        </div>
    `;

    detailModal.modal.querySelector(".feedback-modal-close").addEventListener("click", detailModal.close);
    detailModal.modal.querySelector("[data-feedback-nav=\"prev\"]")?.addEventListener("click", () => {
        if (!hasPrev) return;
        onNavigate(safeIndex - 1);
    });
    detailModal.modal.querySelector("[data-feedback-nav=\"next\"]")?.addEventListener("click", () => {
        if (!hasNext) return;
        onNavigate(safeIndex + 1);
    });
    detailModal.modal.querySelector("[data-feedback-see-all]")?.addEventListener("click", onSeeAll);
    detailModal.overlay.classList.add("is-open");
    detailModal.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
}

function openFeedbackGridModal(detailModal, feedbacks, onOpenDetail) {
    if (!Array.isArray(feedbacks) || !feedbacks.length) return;
    detailModal.modal.classList.remove("is-feedback-detail");
    detailModal.modal.classList.add("is-feedback-grid");
    detailModal.modal.innerHTML = `
        <div class="feedback-modal-top" style="border-bottom:none; box-shadow:none;">
            <h2>All Learners Feedback</h2>
            <button type="button" class="feedback-modal-close" aria-label="Close">×</button>
        </div>
        <div class="feedback-grid-list">
            ${feedbacks
                .map((item, index) => {
                    const safe = sanitizeFeedback(item);
                    if (!safe) return "";
                    return `
                        <article class="feedback-grid-card" role="button" tabindex="0" data-feedback-index="${index}" aria-label="Open feedback by ${escapeHTML(safe.name)}">
                            <div class="feedback-grid-name">${escapeHTML(safe.name)}</div>
                            <div class="feedback-grid-stars">${renderStars(safe.rating)}</div>
                            <p class="feedback-grid-message">${escapeHTML(truncateFeedback(safe.message, 220))}</p>
                        </article>
                    `;
                })
                .join("")}
        </div>
    `;

    detailModal.modal.querySelector(".feedback-modal-close")?.addEventListener("click", detailModal.close);
    detailModal.modal.querySelectorAll("[data-feedback-index]").forEach((card) => {
        const open = () => onOpenDetail(Number(card.getAttribute("data-feedback-index")) || 0);
        card.addEventListener("click", open);
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
            }
        });
    });

    detailModal.overlay.classList.add("is-open");
    detailModal.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
}

function openFeedbackFormModal(detailModal, onSubmit) {
    const saveModeLabel = "Crossdale Arts Database";
    detailModal.modal.classList.remove("is-feedback-detail", "is-feedback-grid");

    detailModal.modal.innerHTML = `
        <div class="feedback-modal-top" style="border-bottom:none; box-shadow:none;">
            <h4>Leave Feedback</h4>
            <button type="button" class="feedback-modal-close" aria-label="Close">×</button>
        </div>
        <form class="feedback-form" id="feedback-form">
            <fieldset class="feedback-star-fieldset">
                <legend>Rating</legend>
                <div class="feedback-star-picker" role="radiogroup" aria-label="Select rating">
                    <input type="radio" id="feedback-rating-5" name="rating" value="5" required />
                    <label for="feedback-rating-5" title="5 stars"><span class="feedback-star-icon material-symbols-outlined" aria-hidden="true">kid_star</span></label>
                    <input type="radio" id="feedback-rating-4" name="rating" value="4" required />
                    <label for="feedback-rating-4" title="4 stars"><span class="feedback-star-icon material-symbols-outlined" aria-hidden="true">kid_star</span></label>
                    <input type="radio" id="feedback-rating-3" name="rating" value="3" required />
                    <label for="feedback-rating-3" title="3 stars"><span class="feedback-star-icon material-symbols-outlined" aria-hidden="true">kid_star</span></label>
                    <input type="radio" id="feedback-rating-2" name="rating" value="2" required />
                    <label for="feedback-rating-2" title="2 stars"><span class="feedback-star-icon material-symbols-outlined" aria-hidden="true">kid_star</span></label>
                    <input type="radio" id="feedback-rating-1" name="rating" value="1" required />
                    <label for="feedback-rating-1" title="1 star"><span class="feedback-star-icon material-symbols-outlined" aria-hidden="true">kid_star</span></label>
                </div>
            </fieldset>
            <label>
                Your Name
                <input type="text" name="name" maxlength="60" required />
            </label>
            <label>
                Feedback
                <textarea name="message" maxlength="500" required></textarea>
            </label>
            <button type="submit" class="feedback-form-submit">Submit Feedback</button>
            <p class="feedback-submit-status" id="feedback-submit-status" aria-live="polite"></p>
            <p class="feedback-form-note">Saved to ${saveModeLabel}.</p>
        </form>
    `;

    detailModal.modal.querySelector(".feedback-modal-close").addEventListener("click", detailModal.close);

    const form = detailModal.modal.querySelector("#feedback-form");
    const statusEl = form.querySelector("#feedback-submit-status");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        statusEl.textContent = "";
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
            statusEl.textContent = "Thank you. Your feedback was submitted successfully.";
            statusEl.classList.remove("is-error");
            statusEl.classList.add("is-success");
            form.reset();
            window.setTimeout(() => detailModal.close(), 900);
            return;
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Feedback";
        statusEl.textContent = result.message || "Could not save feedback. Try again.";
        statusEl.classList.remove("is-success");
        statusEl.classList.add("is-error");
    });

    detailModal.overlay.classList.add("is-open");
    detailModal.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
}

async function loadFeedbackList() {
    try {
        const response = await fetch(FEEDBACK_DATA_URL, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        const remoteList = Array.isArray(data) ? data : data.feedbacks;
        const normalizedRemote = Array.isArray(remoteList) ? remoteList.map(sanitizeFeedback).filter(Boolean) : [];
        return normalizedRemote;
    } catch (_) {
        return [];
    }
}

async function saveFeedbackEntry(entry) {
    if (!entry || !entry.name || !entry.message || !entry.rating) {
        return { ok: false, message: "Please fill name, rating, and feedback before submitting." };
    }

    const payload = {
        action: "feedback",
        name: entry.name,
        rating: entry.rating,
        message: entry.message,
        pageUrl: window.location.href,
        pagePath: window.location.pathname,
        userAgent: navigator.userAgent,
        source: "crossdalearts-website",
        submittedAtIso: new Date().toISOString()
    };
    if (!FEEDBACK_APPS_SCRIPT_URL || FEEDBACK_APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
        return { ok: false, message: "Feedback endpoint is not configured yet." };
    }

    const formPayload = new URLSearchParams(payload).toString();

    // Exact newsletter pattern: no-cors form-urlencoded POST first.
    try {
        await fetch(FEEDBACK_APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: formPayload
        });
        return { ok: true };
    } catch (_) {
        // Continue to fallback below.
    }

    // Exact newsletter fallback: query-string GET.
    const fallbackUrl = new URL(FEEDBACK_APPS_SCRIPT_URL);
    Object.entries(payload).forEach(([key, value]) => fallbackUrl.searchParams.set(key, String(value)));
    fallbackUrl.searchParams.set("action", "feedback");

    try {
        await fetch(fallbackUrl.toString(), {
            method: "GET",
            mode: "no-cors"
        });
    } catch (_) {
        return { ok: false, message: "Feedback request could not be sent. Please try again." };
    }

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
    const message = String(raw.message || "").trim();
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



