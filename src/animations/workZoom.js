export function initWorkZoom() {
  const startEl = document.querySelector("[data-bg-zoom-start]");
  const endEl = document.querySelector("[data-work-item]");
  const contentEl = endEl?.querySelector("[data-bg-zoom-content]");

  const hero = document.querySelector("[data-hero-section]");
  const heroTitle = hero?.querySelector("[data-hero-heading]");

  if (!startEl || !endEl || !contentEl || !hero || !heroTitle) return;

  // Hide Flip Placeholder
  startEl.style.opacity = 0;

  // Contact: the last work item's media flips into this placeholder (the hero in reverse)
  const contactFrame = document.querySelector("[data-bg-zoom-end]");
  const workItems = document.querySelectorAll("[data-work-item]");
  const lastItem = workItems[workItems.length - 1];
  const lastMedia = lastItem?.querySelector("[data-bg-zoom-content]");
  const secondToLastMedia = workItems[workItems.length - 2]?.querySelector(
    "[data-bg-zoom-content]",
  );
  const hasContactFlip = contactFrame && lastMedia && lastMedia !== contentEl;
  if (hasContactFlip) contactFrame.style.opacity = 0;

  let ctx;

  function build() {
    // Undo everything from the previous build (Flip, timelines, SplitText)
    ctx?.revert();

    ctx = gsap.context(() => {
      let splitHeroTitle = SplitText.create(heroTitle, {
        type: "words",
        wordsClass: "split-hero-words",
      });

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

      // Last work item: text out, then from fullscreen into the contact placeholder
      if (hasContactFlip) {
        const lastWords = lastItem.querySelectorAll(".split-work-words");
        const lastCategoryTitle = lastItem.querySelector(".work__category-title");
        const lastLineLeft = lastItem.querySelector('[data-category-line="left"]');
        const lastLineRight = lastItem.querySelector('[data-category-line="right"]');

        const contactSection = contactFrame.closest("section");
        const contactLinkChars = SplitText.create(
          contactSection.querySelectorAll("[data-contact-link]"),
          { type: "chars" },
        ).chars;
        const contactDivider = contactSection.querySelector("[data-contact-divider]");

        // fromTo + immediateRender: false, so these never overwrite the in-animation of workShowcases
        const out = { immediateRender: false, duration: 0.3 };

        gsap
          .timeline({
            defaults: { ease: "power1.inOut" },
            scrollTrigger: {
              trigger: contactSection,
              start: "top bottom",
              end: "bottom bottom",
              scrub: true,
            },
          })
          // Hide the item behind it quickly, so it doesn't show while the last one shrinks
          .fromTo(secondToLastMedia, { autoAlpha: 1 }, { autoAlpha: 0, immediateRender: false, duration: 0.1 }, 0)
          // Text out, the same way as the other work items
          .fromTo(
            lastWords,
            { autoAlpha: 1, filter: "blur(0px)" },
            { autoAlpha: 0, filter: "blur(10px)", stagger: { amount: 0.15, from: "start" }, ...out },
            0,
          )
          .fromTo(lastLineLeft, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 100%)", ...out }, 0)
          .fromTo(lastLineRight, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 100% 0% 0%)", ...out }, "<")
          .fromTo(lastCategoryTitle, { autoAlpha: 1, filter: "blur(0px)" }, { autoAlpha: 0, filter: "blur(10px)", ...out }, "<50%")
          // Then shrink into the contact frame
          .add(
            Flip.fit(lastMedia, contactFrame, {
              scale: false,
              duration: 1,
              ease: "none",
            }),
            0.1,
          );

        // Contact info: not scrubbed (there's too little scroll left), but played once you reach the bottom
        const contactInfoTimeline = gsap
          .timeline({ paused: true, defaults: { ease: "power2.out" } })
          .fromTo(
            contactLinkChars,
            { autoAlpha: 0, filter: "blur(10px)" },
            { autoAlpha: 1, filter: "blur(0px)", stagger: { amount: 0.3, from: "start" }, duration: 0.5 },
            0,
          )
          // Divider grows from the middle outwards, starting fully hidden
          .fromTo(
            contactDivider,
            { clipPath: "inset(0% 50% 0% 50%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6 },
            0,
          );

        ScrollTrigger.create({
          trigger: contactSection,
          start: "bottom bottom+=5", // Just before the very bottom, so it always triggers
          onEnter: () => contactInfoTimeline.timeScale(1).play(),
          onLeaveBack: () => contactInfoTimeline.timeScale(3).reverse(), // Quick out, back to the start state
        });
      }

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
