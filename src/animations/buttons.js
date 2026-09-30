export function initButtonBlurHover() {
  const buttons = document.querySelectorAll("[data-button-blur-hover]");

  buttons.forEach((btn) => {
    const blurTargets = btn.querySelectorAll("[data-button-blur-target]");
    console.log(blurTargets);
  });
}
