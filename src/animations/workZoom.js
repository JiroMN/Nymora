export function initWorkZoom() {
  const startEl = document.querySelector("[data-bg-zoom-start]");
  const endEl = document.querySelector("[data-work-item]");
  const contentEl = endEl?.querySelector("[data-bg-zoom-content]");

  const hero = document.querySelector("[data-hero-section]");
  const heroTitle = hero?.querySelector("[data-hero-heading]");

  if (!startEl || !endEl || !contentEl || !hero || !heroTitle) return;

  // Hide Flip Placeholder
  startEl.style.opacity = 0;

  let ctx;

  function build() {
    // Undo everything from the previous build (Flip, timelines, SplitText)
    ctx?.revert();

    ctx = gsap.context(() => {
      let splitHeroTitle = SplitText.create(heroTitle, { type: "words" });

      // Set image to start state
      Flip.fit(contentEl, startEl, { scale: false });

      const flipTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: startEl,
          start: "clamp(top bottom)",
          endTrigger: endEl,
          end: "top top",
          scrub: true,
        },
      });

      // Animate from start to end state
      flipTimeline.add(
        Flip.fit(contentEl, endEl, { scale: false, duration: 1, ease: "none" }),
      );

      const heroTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: "clamp(top top)",
          end: "30%",
          scrub: true,
        },
      });

      heroTimeline.to(heroTitle, { yPercent: 150, ease: "none" }).to(
        splitHeroTitle.words,
        {
          stagger: { amount: 0.075, from: "start" },
          filter: "blur(10px)",
          autoAlpha: 0,
          yPercent: -50,
        },
        "<",
      );
    });
  }

  build();

  // Rebuild when the width changes
  let lastWidth = window.innerWidth;
  let resizeTimer;

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      build();
      ScrollTrigger.refresh();
    }, 200);
  }

  window.addEventListener("resize", onResize);

  // Called by Barba before leaving the page
  return function cleanup() {
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    ctx?.revert();
  };
}
