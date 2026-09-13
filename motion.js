(function () {
  const root = document.documentElement;
  root.classList.add("js");

  try {
    const targets = document.querySelectorAll(".reveal");

    if (targets.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.15, rootMargin: "0px 0px -56px 0px" });

      targets.forEach((target) => observer.observe(target));
    } else {
      targets.forEach((target) => target.classList.add("is-visible"));
    }

    setTimeout(() => {
      document.querySelectorAll(".reveal:not(.is-visible)")
        .forEach((target) => target.classList.add("is-visible"));
    }, 3000);

    const track = document.querySelector(".track");
    if (track) {
      const slides = track.querySelectorAll(".slide");
      const previous = document.querySelector(".carousel-prev");
      const next = document.querySelector(".carousel-next");

      if (slides.length && "IntersectionObserver" in window) {
        const centre = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            entry.target.classList.toggle("is-active", entry.intersectionRatio > 0.75);
          }
        }, { root: track, threshold: [0, 0.75, 1] });
        slides.forEach((slide) => centre.observe(slide));
      } else if (slides[0]) {
        slides[0].classList.add("is-active");
      }

      const step = () => (slides[0] ? slides[0].getBoundingClientRect().width + 24 : 320);
      const scroll = (direction) => track.scrollBy({ left: direction * step(), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      if (previous) previous.addEventListener("click", () => scroll(-1));
      if (next) next.addEventListener("click", () => scroll(1));
      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") { scroll(-1); event.preventDefault(); }
        if (event.key === "ArrowRight") { scroll(1); event.preventDefault(); }
      });
    }
  } catch (error) {
    root.classList.remove("js");
    document.querySelectorAll(".reveal").forEach((target) => target.classList.add("is-visible"));
    console.warn("Motion disabled:", error);
  }
}());
