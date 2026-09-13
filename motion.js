// Optional decoration only. Any failure restores the fully visible page.
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
      }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

      targets.forEach((target) => observer.observe(target));
    } else {
      targets.forEach((target) => target.classList.add("is-visible"));
    }

    setTimeout(() => {
      document.querySelectorAll(".reveal:not(.is-visible)")
        .forEach((target) => target.classList.add("is-visible"));
    }, 3000);
  } catch (error) {
    root.classList.remove("js");
    document.querySelectorAll(".reveal").forEach((target) => target.classList.add("is-visible"));
    console.warn("Motion disabled:", error);
  }
}());
