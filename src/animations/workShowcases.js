export function initWorkShowcases() {
  const section = document.querySelector("[data-work-showcase-section]");
  const work = section.querySelectorAll("[data-work-item]");

  if (!section || !work) return;

  work.forEach((workItem, index) => {
    const workTitle = workItem.querySelector("[data-work-showcase-title]");
    const workDescription = workItem.querySelector(
      "[data-work-showcase-description]",
    );
    const workTextWrap = workItem.querySelector("[data-work-text]");
    const workCategoryWrap = workItem.querySelector(
      "[data-work-category-wrap]",
    );
    const categoryTitle = workItem.querySelector(".work__category-title");
    const categoryLineLeft = workItem.querySelector(
      '[data-category-line="left"]',
    );
    const categoryLineRight = workItem.querySelector(
      '[data-category-line="right"]',
    );

    // Set Accent Font
    const accentText = workTitle.dataset.workShowcaseAccentText;
    if (!accentText) return;

    workTitle.innerHTML = workTitle.innerHTML.replace(
      accentText,
      () => `<span class="accent-font">${accentText}</span>`,
    );

    // Animating in
    const titleSplit = SplitText.create(workTitle, {
      type: "words",
      wordsClass: "split-work-words",
    });
    const descriptionSplit = SplitText.create(workDescription, {
      type: "words",
      wordsClass: "split-work-words",
    });

    // In: second half of the transition (item top from 50% of the screen to the top)
    const workTimeline = gsap.timeline({
      defaults: { ease: "power1.inOut" },
      scrollTrigger: {
        trigger: workItem,
        start: "top 50%",
        end: "top top",
        scrub: true,
      },
    });
    workTimeline
      .from(
        titleSplit.words,
        {
          stagger: { amount: 0.5, from: "start" },
          autoAlpha: 0,
          filter: "blur(10px)",
          duration: 0.5,
        },
        0,
      )
      .from(
        descriptionSplit.words,
        {
          stagger: { amount: 0.5, from: "start" },
          autoAlpha: 0,
          filter: "blur(10px)",
          duration: 0.5,
        },
        "<0.2",
      )
      // Category: text blurs in, lines grow outward from the text at 50% of it
      .from(
        categoryTitle,
        {
          autoAlpha: 0,
          filter: "blur(10px)",
          duration: 0.5,
        },
        "<0.3",
      )
      .fromTo(
        categoryLineLeft,
        { clipPath: "inset(0% 0% 0% 100%)" },
        { clipPath: "inset(0% 0% 0% 0%)" },
        "<50%",
      )
      .fromTo(
        categoryLineRight,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)" },
        "<",
      );

    // Text hangs one screen higher and moves along, so it stays in place (skip the first, it comes from the hero)
    gsap.fromTo(
      workTextWrap,
      { yPercent: -100 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: workItem,
          start: "top bottom",
          end: "top top",
          scrub: true,
        },
      },
    );

    if (index >= work.length - 1) return; // Skip parallax for the last work item
    // Out: first half of the transition, hold spans the whole thing (0 → 1)

    let parallaxTimeline = gsap.timeline({
      defaults: { ease: "power1.inOut" },
      scrollTrigger: {
        trigger: workItem,
        start: "bottom bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    const workMedia = workItem.querySelector("[data-bg-zoom-content]");
    const workMediaOverlay = workItem.querySelector(
      "[data-work-media-overlay]",
    );

    parallaxTimeline
      .to(
        workMediaOverlay,
        { autoAlpha: 0.75, backdropFilter: "blur(10px)", duration: 1 },
        0,
      )
      .to(
        workMedia,
        {
          yPercent: 75,
          ease: "none",
          duration: 1,
        },
        "<",
      )
      // Text stays in place while the item scrolls away
      .fromTo(
        workTextWrap,
        { yPercent: 0 },
        { yPercent: 100, ease: "none", duration: 1, immediateRender: false },
        0,
      )
      // Animate text out (0.05 → 0.5), before the next item animates in
      .to(
        [...titleSplit.words, ...descriptionSplit.words],
        {
          stagger: { amount: 0.15, from: "start" },
          //   yPercent: -100,
          autoAlpha: 0,
          filter: "blur(10px)",
          duration: 0.3,
        },
        0.05,
      )
      // Category out: lines shrink back towards the text, text blurs out at 50% of it
      .to(
        categoryLineLeft,
        { clipPath: "inset(0% 0% 0% 100%)", duration: 0.3 },
        0.05,
      )
      .to(
        categoryLineRight,
        { clipPath: "inset(0% 100% 0% 0%)", duration: 0.3 },
        "<",
      )
      .to(
        categoryTitle,
        { autoAlpha: 0, filter: "blur(10px)", duration: 0.3 },
        "<50%",
      );
  });
}
