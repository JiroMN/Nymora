import { enableGyro } from "./depthMap";

// Only iOS asks permission for the gyro. Android turns it on by itself (see depthMap.js).
// Desktop Safari has requestPermission too but no gyro, so it also needs a touchscreen.
export function needsGyroPrompt() {
  const canAskPermission =
    typeof DeviceOrientationEvent?.requestPermission === "function";
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  return canAskPermission && isTouch;
}

// Shows the prompt and calls onDone once one of the two buttons is clicked
export function showGyroPrompt(onDone) {
  const prompt = document.querySelector("[data-gyro-prompt]");
  if (!prompt) return onDone();

  const enableButton = prompt.querySelector("[data-gyro-enable]");
  const skipButton = prompt.querySelector("[data-gyro-skip]");
  const icon = prompt.querySelector("[data-gyroscope-phone-icon]");
  const iconLoop = icon && playGyroIcon(icon);
  const primaryButton = prompt.querySelector("[data-gyro-primary-button]");
  const stopStroke = primaryButton && initDashedStroke(primaryButton);

  const close = () =>
    gsap
      .timeline({
        onComplete: () => {
          iconLoop?.kill();
          stopStroke?.();
          onDone(); // Lets the page loader continue
        },
      })
      .to(prompt.children, {
        autoAlpha: 0,
        yPercent: -50,
        stagger: 0.05,
        duration: 0.4,
      })
      .to(prompt, { autoAlpha: 0, duration: 0.4 });

  const onEnable = () => {
    skipButton?.removeEventListener("click", onSkip);
    enableGyro(); // Shows the iOS permission popup, has to happen inside the click
    close();
  };

  const onSkip = () => {
    enableButton?.removeEventListener("click", onEnable);
    close();
  };

  enableButton?.addEventListener("click", onEnable, { once: true });
  skipButton?.addEventListener("click", onSkip, { once: true });

  gsap
    .timeline()
    .to(prompt, { autoAlpha: 1, duration: 0.4 })
    .from(prompt.children, { autoAlpha: 0, yPercent: 50, stagger: 0.05 }, ">");
}

// Dashed stroke around the button keeps running in circles while the prompt is open
function initDashedStroke(button) {
  const stroke = button.querySelector("[data-gyro-primary-stroke]");
  if (!stroke) return null;

  // Give the stroke the pill shape of the button (0.5 keeps the 1px line sharp)
  const { width, height } = stroke.ownerSVGElement.getBoundingClientRect();
  const radius = (height - 1) / 2;
  gsap.set(stroke, {
    attr: {
      x: 0.5,
      y: 0.5,
      width: width - 1,
      height: height - 1,
      rx: radius,
      ry: radius,
    },
  });

  // -300 is a multiple of the dash pattern (5 + 5), so the loop has no jump
  const spin = gsap.to(stroke, {
    strokeDashoffset: -300,
    duration: 20,
    ease: "none",
    repeat: -1,
  });

  return () => spin.kill();
}

// Phone icon rolls once around a ball: tilt in, one full circle, tilt out, pause, repeat.
// While it rolls it grows a little and a glare slides over the screen.
function playGyroIcon(icon) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return null;

  const glare = icon.querySelector("[data-gyroscope-phone-glare]");
  const maxTilt = 22; // degrees
  const roll = { angle: -Math.PI / 2, tilt: 0 }; // angle = where the tilt points, tilt = how far

  // Turns angle + tilt into the rotation, and moves the glare against the left/right tilt
  const render = () => {
    const rotationX = Math.cos(roll.angle) * roll.tilt;
    const rotationY = Math.sin(roll.angle) * roll.tilt;
    gsap.set(icon, { rotationX, rotationY });

    // Glare is only visible while tilted, so the pause shows a plain icon (x is in SVG units)
    if (glare) {
      gsap.set(glare, {
        x: (-rotationY / maxTilt) * 9,
        opacity: roll.tilt / maxTilt,
      });
    }
  };

  gsap.set(icon, { transformPerspective: 500 });
  render();

  return (
    gsap
      .timeline({ repeat: -1, repeatDelay: 1, onUpdate: render })
      .to(icon, { scale: 1.1, duration: 0.4, ease: "power2.out" }, 0)
      // One wobble: sweep from left, over the front, to the right (half a circle)...
      .to(roll, { angle: Math.PI / 2, duration: 1.6, ease: "sine.inOut" }, 0)
      // ...while the tilt swells in and out once
      .to(roll, { tilt: maxTilt, duration: 0.8, ease: "sine.inOut" }, 0)
      .to(roll, { tilt: 0, duration: 0.8, ease: "sine.inOut" }, 0.8)
      .to(icon, { scale: 1, duration: 0.4, ease: "power2.in" }, 1.2)
  );
}
