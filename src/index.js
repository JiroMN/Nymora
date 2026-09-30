// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

const { initWorkShowcases } = require("./animations/workShowcases");
const { initWorkZoom } = require("./animations/workZoom");
const { initDepthMap } = require("./animations/depthMap");
const { needsGyroPrompt, showGyroPrompt } = require("./animations/gyroPrompt");
const { initButtonBlurHover } = require("./animations/buttons");
const { initDepthTool } = require("./animations/depthTool");

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let lenis = null;
let nextPage = document;
let onceFunctionsInitialized = false;
let workZoomCleanup = null;
let depthMapCleanup = null;
let depthToolCleanup = null;

const hasLenis = typeof window.Lenis !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";

const rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.("change", (e) => (reducedMotion = e.matches));
rmMQ.addListener?.((e) => (reducedMotion = e.matches));

const has = (s) => !!nextPage.querySelector(s);

let staggerDefault = 0.05;
let durationDefault = 0.8;

CustomEase.create("osmo", "0.625, 0.05, 0, 1");
CustomEase.create("smooth", "M0,0 C0.38,0.005 0.215,1 1,1");
gsap.defaults({ ease: "smooth", duration: durationDefault });

// -----------------------------------------
// FUNCTION REGISTRY
// -----------------------------------------

function initOnceFunctions() {
  initLenis();
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;

  // Runs once on first load
  // if (has('[data-something]')) initSomething();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Runs before the enter animation
  // if (has('[data-something]')) initSomething();
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // Runs after enter animation completes
  // if (has("[data-button-blur-hover]")) initButtonBlurHover();
  if (has("[data-work-showcase-section]")) initWorkShowcases();
  if (has("[data-work-item]")) workZoomCleanup = initWorkZoom();
  if (has("[data-depth-map]")) depthMapCleanup = initDepthMap(nextPage, lenis);
  if (has("[data-depth-tool]")) depthToolCleanup = initDepthTool(nextPage);

  if (hasLenis) {
    lenis.resize();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}

// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const tl = gsap.timeline({
    defaults: {
      duration: 0.6,
    },
  });
  const pageLoader = document.querySelector("[data-page-loader]");
  const pageLoaderContent = pageLoader?.querySelector(
    "[data-page-loader-content]",
  );
  const pageLoaderBg = pageLoader?.querySelector("[data-page-loader-bg]");
  const pageLoaderLines = pageLoaderContent?.querySelectorAll(
    "[data-page-loader-line]",
  );
  const pageLoaderLeftLine = pageLoaderContent?.querySelector(
    "[data-page-loader-line='left']",
  );
  const pageLoaderRightLine = pageLoaderContent?.querySelector(
    "[data-page-loader-line='right']",
  );
  const pageLoaderTextContainer = pageLoaderContent?.querySelector(
    "[data-page-loader-text-container]",
  );
  const pageLoaderGreeting = pageLoaderTextContainer?.querySelector(
    "[data-page-loader-text-greeting]",
  );
  const pageLoaderWordmark = pageLoaderTextContainer?.querySelector(
    "[data-page-loader-text-wordmark]",
  );

  gsap.set(pageLoaderContent, { opacity: 1 });

  tl.add("startOnce", 0.3);
  tl.add("pageReady", "startOnce");

  tl.from(pageLoaderLeftLine, { clipPath: "inset(0 0 0 100%)" }, "startOnce")
    .from(pageLoaderRightLine, { clipPath: "inset(0 100% 0 0)" }, "<")
    .from(
      pageLoaderGreeting,
      { autoAlpha: 0, yPercent: 100, filter: "blur(10px)" },
      "<50%",
    )
    .to(pageLoaderGreeting, { autoAlpha: 0, yPercent: -100 }, "+=0.5")
    .fromTo(
      pageLoaderWordmark,
      { autoAlpha: 0, yPercent: 100, filter: "blur(10px)" },
      { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" },
      "<",
    )
    .from(
      pageLoaderTextContainer,
      {
        width: () => pageLoaderGreeting.scrollWidth,
        clearProps: "width",
      },
      ">",
    )
    // Animate loader out
    .to(
      pageLoaderContent,
      { scale: 1.2, filter: "blur(2px)", autoAlpha: 0, duration: 0.6 },
      "+=0.6",
    )
    // Prepare hero load in
    .add(() => {
      const hero = next.querySelector("[data-hero-section]");
      if (!hero) return;
      const heroTitleWords = hero.querySelectorAll(".split-hero-words");
      const heroImage = next.querySelector(
        "[data-work-item] [data-bg-zoom-content]",
      ); // First work item's media, placed in the hero by Flip

      gsap.set(heroTitleWords, { autoAlpha: 0, filter: "blur(10px)" });
      gsap.set(heroImage, { autoAlpha: 0, filter: "blur(2px)" });
    }, "<")

    // iOS: wait here until the gyro prompt is answered
    .addPause("<50%", () => {
      if (!needsGyroPrompt()) return tl.resume();
      showGyroPrompt(() => tl.resume());
    })
    .to(pageLoaderBg, { yPercent: 100, duration: 0.6 })

    // Animate in hero
    .add(() => {
      const hero = next.querySelector("[data-hero-section]");
      if (!hero) return;
      const heroTitleWords = hero.querySelectorAll(".split-hero-words");
      const heroImage = next.querySelector(
        "[data-work-item] [data-bg-zoom-content]",
      ); // First work item's media, placed in the hero by Flip

      gsap
        .timeline()
        .to(heroTitleWords, {
          filter: "blur(0px)",
          autoAlpha: 1,
          stagger: 0.05,
        })
        .to(heroImage, { autoAlpha: 1, filter: "blur(0px)" }, "<50%");
    });

  tl.call(
    () => {
      resetPage(next);
    },
    null,
    "pageReady",
  );

  return new Promise((resolve) => {
    tl.call(resolve, null, "pageReady");
  });
}

function runPageLeaveAnimation(current, next) {
  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    },
  });

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, { autoAlpha: 0, duration: 0.4 });

  return tl;
}

function runPageEnterAnimation(next) {
  const tl = gsap.timeline();

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    tl.set(next, { autoAlpha: 1 });
    tl.add("pageReady");
    tl.call(resetPage, [next], "pageReady");
    return new Promise((resolve) => tl.call(resolve, null, "pageReady"));
  }

  tl.add("startEnter", 0.6);

  tl.fromTo(
    next,
    {
      autoAlpha: 0,
    },
    {
      autoAlpha: 1,
    },
    "startEnter",
  );

  tl.add("pageReady");
  tl.call(resetPage, [next], "pageReady");

  return new Promise((resolve) => {
    tl.call(resolve, null, "pageReady");
  });
}

// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

barba.hooks.beforeEnter((data) => {
  // Position new container on top
  gsap.set(data.next.container, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
  });

  if (lenis && typeof lenis.stop === "function") {
    lenis.stop();
  }

  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  workZoomCleanup?.();
  workZoomCleanup = null;
  depthMapCleanup?.();
  depthMapCleanup = null;
  depthToolCleanup?.();
  depthToolCleanup = null;

  if (hasScrollTrigger) {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
});

barba.hooks.enter((data) => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter((data) => {
  // Run page functions
  initAfterEnterFunctions(data.next.container);

  // Settle
  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
});

barba.init({
  debug: true, // Set to 'false' in production
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: "default",
      sync: true,

      // First load
      async once(data) {
        initOnceFunctions();

        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(
          data.current.container,
          data.next.container,
        );
      },

      // New page enters
      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      },
    },
  ],
});

// -----------------------------------------
// GENERIC + HELPERS
// -----------------------------------------

const themeConfig = {
  light: {
    nav: "dark",
    transition: "light",
  },
  dark: {
    nav: "light",
    transition: "dark",
  },
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || "light";
  const config = themeConfig[pageTheme] || themeConfig.light;

  document.body.dataset.pageTheme = pageTheme;
  const transitionEl = document.querySelector("[data-theme-transition]");
  if (transitionEl) {
    transitionEl.dataset.themeTransition = config.transition;
  }

  const nav = document.querySelector("[data-theme-nav]");
  if (nav) {
    nav.dataset.themeNav = config.nav;
  }
}

function initLenis() {
  if (lenis) return; // already created
  if (!hasLenis) return;

  lenis = new Lenis({
    lerp: 0.165,
    wheelMultiplier: 1.25,
  });

  if (hasScrollTrigger) {
    lenis.on("scroll", ScrollTrigger.update);
  }

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function resetPage(container) {
  window.scrollTo(0, 0);
  gsap.set(container, { clearProps: "position,top,left,right" });

  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }
}

function debounceOnWidthChange(fn, ms) {
  let last = innerWidth,
    timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth !== last) {
        last = innerWidth;
        fn.apply(this, args);
      }
    }, ms);
  };
}

function initBarbaNavUpdate(data) {
  var tpl = document.createElement("template");
  tpl.innerHTML = data.next.html.trim();
  var nextNodes = tpl.content.querySelectorAll("[data-barba-update]");
  var currentNodes = document.querySelectorAll("nav [data-barba-update]");

  currentNodes.forEach(function (curr, index) {
    var next = nextNodes[index];
    if (!next) return;

    // Aria-current sync
    var newStatus = next.getAttribute("aria-current");
    if (newStatus !== null) {
      curr.setAttribute("aria-current", newStatus);
    } else {
      curr.removeAttribute("aria-current");
    }

    // Class list sync
    var newClassList = next.getAttribute("class") || "";
    curr.setAttribute("class", newClassList);
  });
}

// add to runPageOnceAnimation() -> tl.call(()=>{...}) beneath resetPage(next)
function scrollToInitialHash(container = document) {
  const hash = window.location.hash;
  if (!hash || hash === "#") return;
  const target = container.querySelector(hash) || document.querySelector(hash);
  if (!target) return;
  // Reduced motion: jump
  if (reducedMotion) {
    target.scrollIntoView();
    return;
  }
  // Smooth: Lenis if available, else native smooth
  if (hasLenis && lenis) {
    lenis.scrollTo(target, {
      offset: 0,
      duration: 1,
      immediate: false,
      lock: true,
    });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// -----------------------------------------
// YOUR FUNCTIONS GO BELOW HERE
// -----------------------------------------
