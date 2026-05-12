const FEEDBACK_ROTATION_MS = 400;
const FEEDBACK_TRANSITION_MS = 400;
const FEEDBACK_DATA_URL = getAssetUrl("data/feedbacks.json");
const FEEDBACK_STORAGE_KEY = "crossdale_feedbacks";
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
        modal.classList.remove("is-feedback-detail");
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
    detailModal.modal.classList.add("is-feedback-detail");
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
    detailModal.modal.classList.remove("is-feedback-detail");

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

