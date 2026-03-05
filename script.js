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
    { src: "images/art1.jpg", alt: "Art 1" },
    { src: "images/art2.jpg", alt: "Art 2" },
    { src: "images/art3.jpg", alt: "Art 3" },
    { src: "images/art4.jpg", alt: "Art 4" },
    { src: "images/art5.jpg", alt: "Art 5" },
    { src: "images/art6.jpg", alt: "Art 6" }
];

const track = document.getElementById("art-gallery-images");
const prevBtn = document.getElementById("gallery-prev");
const nextBtn = document.getElementById("gallery-next");

if (track && prevBtn && nextBtn) {
    let currentIndex = 0;
    let visibleSlides = 3;

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

    prevBtn.addEventListener("click", () => {
        if (currentIndex > 0) {
            currentIndex -= 1;
            updateSlider();
        }
    });

    nextBtn.addEventListener("click", () => {
        const maxIndex = Math.max(galleryImages.length - visibleSlides, 0);
        if (currentIndex < maxIndex) {
            currentIndex += 1;
            updateSlider();
        }
    });

    window.addEventListener("resize", updateSlider);

    renderSlides();
    updateSlider();
}
