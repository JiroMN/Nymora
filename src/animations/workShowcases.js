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

    // console.log("WorkItem", `${index}/${work.length - 1}`);
    if (index >= work.length - 1) return; // Skip parallax for the last work item

    let parallaxTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: workItem,
        start: "bottom bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    parallaxTimeline
      .to(workItem, {
        yPercent: 75,
        ease: "none",
      })
      .to(
        workTextWrap,
        {
          yPercent: -25,
        },
        "<",
      )
      .to(
        workCategoryWrap,
        {
          yPercent: -250,
        },
        "<",
      )
      .to(
        workTextWrap,
        {
          yPercent: -25,
        },
        "<",
      )
      .to(
        workCategoryWrap,
        {
          filter: -150,
        },
        "<",
      );
  });
}
