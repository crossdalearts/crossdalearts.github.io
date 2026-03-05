const slider = document.querySelector('.gallery-slider');
let currentIndex = 0;

function slideLeft() {
  currentIndex = Math.max(currentIndex - 1, 0);
  slider.style.transform = `translateX(-${currentIndex * 25}%)`;
}

function slideRight() {
  const maxIndex = slider.children.length - 4; // Number of visible items
  currentIndex = Math.min(currentIndex + 1, maxIndex);
  slider.style.transform = `translateX(-${currentIndex * 25}%)`;
}