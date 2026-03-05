const navbar = document.getElementById("navbar");
const navToggle = navbar ? navbar.querySelector(".nav-toggle") : null;

if (navbar && navToggle) {
    navToggle.addEventListener("click", () => {
        const isOpen = navbar.classList.toggle("nav-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            navbar.classList.remove("nav-open");
            navToggle.setAttribute("aria-expanded", "false");
        }
    });
}

const galleryImages = [
    { src: "images/Gallery/gallery-image-1.jpeg", alt: "Art 1" },
    { src: "images/Gallery/gallery-image-2.jpeg", alt: "Art 2" },
    { src: "images/Gallery/gallery-image-3.jpeg", alt: "Art 3" },
    { src: "images/Gallery/gallery-image-4.jpeg", alt: "Art 4" },
    { src: "images/Gallery/gallery-image-5.jpeg", alt: "Art 5" },
    { src: "images/Gallery/gallery-image-6.jpeg", alt: "Art 6" },
    { src: "images/Gallery/gallery-image-7.jpeg", alt: "Art 7" },
    { src: "images/Gallery/gallery-image-8.jpeg", alt: "Art 8" },
    { src: "images/Gallery/gallery-image-9.jpeg", alt: "Art 9" },
    { src: "images/Gallery/gallery-image-10.jpeg", alt: "Art 10" },
    { src: "images/Gallery/gallery-image-11.jpeg", alt: "Art 11" },
    { src: "images/Gallery/gallery-image-12.jpeg", alt: "Art 12" },
    { src: "images/Gallery/gallery-image-13.jpeg", alt: "Art 13" },
    { src: "images/Gallery/gallery-image-14.jpeg", alt: "Art 14" },
    { src: "images/Gallery/gallery-image-15.jpeg", alt: "Art 15" },
    { src: "images/Gallery/gallery-image-16.jpeg", alt: "Art 16" },
    { src: "images/Gallery/gallery-image-17.jpeg", alt: "Art 17" },
    { src: "images/Gallery/gallery-image-18.jpeg", alt: "Art 18" },
    { src: "images/Gallery/gallery-image-19.jpeg", alt: "Art 19" },
    { src: "images/Gallery/gallery-image-20.jpeg", alt: "Art 20" },
    { src: "images/Gallery/gallery-image-21.jpeg", alt: "Art 21" },
    { src: "images/Gallery/gallery-image-22.jpeg", alt: "Art 22" },
    { src: "images/Gallery/gallery-image-23.jpeg", alt: "Art 23" }
];

const track = document.getElementById("art-gallery-images");
const prevBtn = document.getElementById("gallery-prev");
const nextBtn = document.getElementById("gallery-next");
const galleryViewport = track ? track.parentElement : null;

if (track && prevBtn && nextBtn) {
    let currentIndex = 0;
    let visibleSlides = 3;
    let wheelDeltaX = 0;
    let wheelCooldown = false;
    let touchStartX = 0;
    let touchStartY = 0;

    function getVisibleSlides() {
        if (window.innerWidth <= 600) return 1;
        if (window.innerWidth <= 900) return 2;
        return 3;
    }

    function renderSlides() {
        track.innerHTML = "";

        galleryImages.forEach((item) => {
            const slide = document.createElement("div");
            slide.className = "slide";

            const img = document.createElement("img");
            img.src = item.src;
            img.alt = item.alt || "Gallery image";

            slide.appendChild(img);
            track.appendChild(slide);
        });
    }

    function updateSlider() {
        visibleSlides = getVisibleSlides();
        const maxIndex = Math.max(galleryImages.length - visibleSlides, 0);

        if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
        }

        const offset = (100 / visibleSlides) * currentIndex;
        track.style.transform = `translateX(-${offset}%)`;

        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === maxIndex;
    }

    function slidePrev() {
        if (currentIndex > 0) {
            currentIndex -= 1;
            updateSlider();
        }
    }

    function slideNext() {
        const maxIndex = Math.max(galleryImages.length - visibleSlides, 0);
        if (currentIndex < maxIndex) {
            currentIndex += 1;
            updateSlider();
        }
    }

    prevBtn.addEventListener("click", slidePrev);
    nextBtn.addEventListener("click", slideNext);

    if (galleryViewport) {
        galleryViewport.addEventListener(
            "wheel",
            (event) => {
                const isHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
                if (!isHorizontalIntent) return;

                event.preventDefault();
                if (wheelCooldown) return;

                wheelDeltaX += event.deltaX !== 0 ? event.deltaX : event.deltaY;
                if (Math.abs(wheelDeltaX) < 36) return;

                if (wheelDeltaX > 0) slideNext();
                else slidePrev();

                wheelDeltaX = 0;
                wheelCooldown = true;
                window.setTimeout(() => {
                    wheelCooldown = false;
                }, 180);
            },
            { passive: false }
        );

        galleryViewport.addEventListener(
            "touchstart",
            (event) => {
                const touch = event.changedTouches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
            },
            { passive: true }
        );

        galleryViewport.addEventListener(
            "touchmove",
            (event) => {
                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;

                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    event.preventDefault();
                }
            },
            { passive: false }
        );

        galleryViewport.addEventListener(
            "touchend",
            (event) => {
                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;

                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 48) {
                    if (deltaX < 0) slideNext();
                    else slidePrev();
                }
            },
            { passive: true }
        );
    }

    window.addEventListener("resize", updateSlider);

    renderSlides();
    updateSlider();
}
