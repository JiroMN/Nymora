export function initWorkShowcases() {
  const section = document.querySelector("[data-work-showcase-section]");
  const work = section.querySelectorAll("[data-work-item]");

  if (!section || !work) return;

  work.forEach((workItem) => {
    const workTitle = workItem.querySelector("[data-work-showcase-title]");
    const workDescription = workItem.querySelector(
      "[data-work-showcase-description]",
    );
    const workTextWrap = workItem.querySelector("[data-work-text]");
    const workCategoryWrap = workItem.querySelector(
      "[data-work-category-wrap]",
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
    });
    const descriptionSplit = SplitText.create(workDescription, {
      type: "words",
    });

    const workTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: workItem,
        start: "20% 60%",
        end: "top top",
        scrub: true,
      },
    });
    workTimeline
      .to(
        workTextWrap,
        {
          yPercent: -10,
        },
        "<",
      )
      .to(
        workCategoryWrap,
        {
          yPercent: -100,
        },
        "<",
      )
      .from(
        titleSplit.words,
        {
          stagger: { amount: 0.075, from: "start" },
          yPercent: 100,
          autoAlpha: 0,
          filter: "blur(10px)",
        },
        "<",
      )
      .from(
        descriptionSplit.words,
        {
          stagger: { amount: 0.075, from: "start" },
          yPercent: 100,
          autoAlpha: 0,
          filter: "blur(10px)",
        },
        ">",
      );
  });
}
