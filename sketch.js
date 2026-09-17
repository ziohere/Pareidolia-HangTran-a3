const myMainCanvasSketch = (p) => {
  let aspectRatio;

  // ---- Asset arrays ----
  let portraitImgs = [];
  let elementImgs = [];

  // ---- Portrait sequencing (3 portraits per turn, out of 4) ----
  let selectedPortraits = [];
  let currentRound = 0; // 0 = first portrait this turn, 1 = second

  const portraitPaths = [
    "assets/COMM2754-2026-S2-A3w12-Amigos4-portrait-resize1.png",
    "assets/COMM2754-2026-S2-A3w12-Amigos4-portrait-resize2.png",
    "assets/COMM2754-2026-S2-A3w12-Amigos4-portrait-resize3.png",
    "assets/COMM2754-2026-S2-A3w12-Amigos4-portrait-resize4.png",
  ];

  const elementPaths = [
    "assets/COMM2754-2026-S2-A3w12-Amigos4-element1.png", // [0] Black
    "assets/COMM2754-2026-S2-A3w12-Amigos4-element2.png", // [1] Black
    "assets/COMM2754-2026-S2-A3w12-Amigos4-element3.png", // [2] Black
    "assets/COMM2754-2026-S2-A3w12-Amigos4-element4.png", // [3] White
    "assets/COMM2754-2026-S2-A3w12-Amigos4-element5.png", // [4] White
  ];

  const CANVAS_W = 400;
  const CANVAS_H = 500;
  const GRID_STEP = 9;

  // ---- Dusting state ----
  let STATE = "dusting"; // dusting, waiting (popup shown), corrupted
  let dustBuffer;
  let dustGrid = [];
  const DUST_GRID_SIZE = 12;

  // How much of the dust filter needs to be cleared before the
  // completion popup appears. 1.0 = every grid cell dusted off. 0.98
  // leaves a hair of leeway for corners a circular brush can't quite
  // reach — raise to 1.0 for a literal 100% requirement.
  const DUST_CLEAR_THRESHOLD = 0.98;

  // ---- Rendering ----
  let dots = [];
  let isCorrupted = false;
  let elementSizeMultiplier = 1;

  // =========================================================
  // AUDIO ENGINE
  // =========================================================
  const blipSound = new Audio("full_sounds/COMM2754-2026-S2-A3w12-blip-anim.wav");
  const ambientSound = new Audio("full_sounds/ambient.wav");
  const corruptionSound = new Audio("full_sounds/COMM2754-2026-S2-A3w12-radiosilent-anim.wav");
  const transitionSoundPaths = [
     "full_sounds/COMM2754-2026-S2-A3w12-airleak-1-anim.wav",
      "full_sounds/transit_1.wav",
     "full_sounds/COMM2754-2026-S2-A3w12-flashing-anim.wav",
  ];
  const textNotificationSoundPaths = [
    "full_sounds/message_chime.wav",
    "full_sounds/text_noti.wav",
    "full_sounds/COMM2754-2026-S2-A3w12-blip2-anim.wav",
  ];
  const corruptPopupSoundPaths = [
    "full_sounds/COMM2754-2026-S2-A3w12-beat-anim.wav",
    "full_sounds/COMM2754-2026-S2-A3w12-noise-anim.wav",
    "full_sounds/COMM2754-2026-S2-A3w12-low-airleak-anim.wav",
  ];
  const transitionSounds = transitionSoundPaths.map((path) => new Audio(path));
  const textNotificationSounds = textNotificationSoundPaths.map((path) => new Audio(path));
  const corruptPopupSounds = corruptPopupSoundPaths.map((path) => new Audio(path));
  const ambientVolume = 0.8;
  let ambientStarted = false;
  let corruptionStarted = false;

  ambientSound.loop = true;
  ambientSound.volume = ambientVolume;
  corruptionSound.loop = true;
  corruptionSound.volume = ambientVolume;

  function startAmbientSound() {
    if (ambientStarted) return;
    ambientSound
      .play()
      .then(() => {
        ambientStarted = true;
      })
      .catch(() => {});
  }
  window.startAmbientSound = startAmbientSound;

  function playSound(sound) {
    if (!corruptionStarted) startAmbientSound();
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function setVolume(sound, targetVolume, duration) {
    const startVolume = sound.volume;
    const startTime = performance.now();

    function fadeVolume(currentTime) {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      sound.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) requestAnimationFrame(fadeVolume);
    }

    requestAnimationFrame(fadeVolume);
  }

  function playTransitionSound() {
    if (transitionSounds.length === 0) return;

    const sound = transitionSounds[Math.floor(Math.random() * transitionSounds.length)];
    sound.volume = 0.9;
    sound.currentTime = 0;
    sound.play().catch(() => {});
    setVolume(sound, 0, 1800); // fade out over 1.8 seconds
  }

  function playTextNotificationSound() {
    if (textNotificationSounds.length === 0) {
      playSound(blipSound);
      return;
    }

    const sound = textNotificationSounds[Math.floor(Math.random() * textNotificationSounds.length)];
    sound.currentTime = 0;
    sound.play().catch(() => {});
    setVolume(sound, 0, 1800); // fade out over 1.8 seconds
  }

  function playCorruptPopupSounds() {
    corruptPopupSounds.forEach((sound) => {
      sound.volume = 0.8;
      sound.currentTime = 0;
      sound.play().catch(() => {});
    });
  }

  function startCorruptionSound() {
    if (corruptionStarted) return;

    corruptionStarted = true;
    ambientSound.pause();
    ambientSound.currentTime = 0;
    corruptionSound.currentTime = 0;
    corruptionSound.play().catch(() => {});
  }

  window.playChatSound = function () {
    playSound(blipSound);
  };
  window.playScrollSound = function (direction) {
    playSound(direction === "up" ? flippingUpSound : flippingSound);
  };
  window.playTransitionSound = playTransitionSound;
  window.playTextNotificationSound = playTextNotificationSound;
  window.playCorruptPopupSounds = playCorruptPopupSounds;
  window.startCorruptionSound = startCorruptionSound;
  window.setElementSizeMultiplier = function (multiplier) {
    elementSizeMultiplier = p.constrain(multiplier, 0.5, 2);
  };
  // Optional hook: call this from anywhere (e.g. corruption.js) if you
  // want the ambient loop to duck out during the corruption sequence.
  window.stopAmbientSound = function () {
    setVolume(ambientSound, 0, 1500);
  };

  // =========================================================
  // p5 LIFECYCLE
  // =========================================================
  p.setup = async () => {
    portraitImgs = await Promise.all(portraitPaths.map((path) => p.loadImage(path)));
    elementImgs = await Promise.all(elementPaths.map((path) => p.loadImage(path)));

    const container = document.querySelector(".mainCanvas");
    const currentWidth = container ? container.clientWidth : 400;

    aspectRatio = CANVAS_H / CANVAS_W;
    const currentHeight = currentWidth * aspectRatio;

    const canvas = p.createCanvas(currentWidth, currentHeight);
    if (container) {
      canvas.parent(container);
      container.style.position = "relative"; // so popups position correctly
    }

    p.imageMode(p.CENTER);
    p.angleMode(p.DEGREES);
    p.pixelDensity(1);
    p.noStroke();


    // Pick 3 random portraits for this turn
    selectedPortraits = p.shuffle([0, 1, 2, 3]).slice(0, 3);

    createUIOverlays();
    buildDotsForPortrait(selectedPortraits[currentRound]);
    setupDustBuffer();
    initializeInterface();
    startAmbientSound();
  };

  p.draw = () => {
    if (isCorrupted) return; // stop drawing once corruption takes over

    // BLUE BACKGROUND
    p.background("#0000FF");

    const scaleFactor = p.width / CANVAS_W;
    p.push();
    p.scale(scaleFactor);

    // 1. Draw static elements (no blooming / reveal animation)
    for (const d of dots) {
      p.push();
      p.translate(d.x, d.y);
      p.rotate(d.rot);
      const s = d.baseSize * elementSizeMultiplier;
      drawElementPreservingAspect(elementImgs[d.elIndex], s);
      p.pop();
    }
    p.pop();

    // 2. Erase dust where the user hovers ("duster")
    if (STATE === "dusting") {
      const isMouseOver = p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height;
      if (isMouseOver) {
        const instructionEl = document.getElementById("instruction-popup");
        if (instructionEl) instructionEl.style.display = "none";

        dustBuffer.erase();
        dustBuffer.noStroke();
        dustBuffer.fill(255);
        // Duster size: 40% of the canvas width
        dustBuffer.circle(p.mouseX, p.mouseY, p.width * 0.4);
        dustBuffer.noErase();

        checkDustProgress();
      }
    }

    // 3. Draw the dust overlay on top of the elements
    p.imageMode(p.CORNER);
    p.image(dustBuffer, 0, 0, p.width, p.height);
    p.imageMode(p.CENTER);
  };

  p.windowResized = () => {
    const container = document.querySelector(".mainCanvas");
    if (container) {
      const newWidth = container.clientWidth;
      p.resizeCanvas(newWidth, newWidth * aspectRatio);
      if (dustBuffer) dustBuffer.resizeCanvas(p.width, p.height);
    }
  };

  // =========================================================
  // DUST & PROGRESS
  // =========================================================
  function setupDustBuffer() {
    dustBuffer = p.createGraphics(p.width, p.height);
    dustBuffer.background(220);
    dustBuffer.loadPixels();
    for (let i = 0; i < dustBuffer.pixels.length; i += 4) {
      let noiseVal = p.random(120, 200);
      dustBuffer.pixels[i] = noiseVal;
      dustBuffer.pixels[i + 1] = noiseVal;
      dustBuffer.pixels[i + 2] = noiseVal;
      dustBuffer.pixels[i + 3] = 255;
    }
    dustBuffer.updatePixels();
    dustBuffer.filter(p.BLUR, 4); // blurry "dust" texture

    dustGrid = Array(DUST_GRID_SIZE * DUST_GRID_SIZE).fill(false);
  }

  function checkDustProgress() {
    let cx = Math.floor((p.mouseX / p.width) * DUST_GRID_SIZE);
    let cy = Math.floor((p.mouseY / p.height) * DUST_GRID_SIZE);
    let brushRadius = (0.4 / 2) * DUST_GRID_SIZE;

    let cleared = 0;
    for (let x = 0; x < DUST_GRID_SIZE; x++) {
      for (let y = 0; y < DUST_GRID_SIZE; y++) {
        if (!dustGrid[x + y * DUST_GRID_SIZE]) {
          if (p.dist(cx, cy, x, y) <= brushRadius) {
            dustGrid[x + y * DUST_GRID_SIZE] = true;
          }
        }
        if (dustGrid[x + y * DUST_GRID_SIZE]) cleared++;
      }
    }

    // Only pop the "cleared" message once the WHOLE filter is dusted off
    if (cleared / (DUST_GRID_SIZE * DUST_GRID_SIZE) >= DUST_CLEAR_THRESHOLD) {
      STATE = "waiting";
      const completionEl = document.getElementById("completion-popup");
      if (completionEl) completionEl.style.display = "block";
    }
  }

  // =========================================================
  // PORTRAIT BUILDING (2 black elements + 1 white element)
  // =========================================================
  function buildDotsForPortrait(idx) {
    dots = [];

    // Black sections use 2 random elements from element1/2/3
    const blackElements = p.shuffle([0, 1, 2]).slice(0, 2);
    // White sections use 1 random element from element4/5
    const whiteElement = p.random([3, 4]);

    const img = portraitImgs[idx];
    const g = p.createGraphics(CANVAS_W, CANVAS_H);
    g.imageMode(p.CORNER);
    g.background(255);

    const scaleFactor = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
    const dw = img.width * scaleFactor;
    const dh = img.height * scaleFactor;
    const dx = (CANVAS_W - dw) / 2;
    const dy = (CANVAS_H - dh) / 2;
    g.image(img, dx, dy, dw, dh);
    g.loadPixels();

    const candidates = [];

    for (let y = 0; y < CANVAS_H; y += GRID_STEP) {
      for (let x = 0; x < CANVAS_W; x += GRID_STEP) {
        const i = 4 * (y * CANVAS_W + x);
        const pixelBrightness = (g.pixels[i] + g.pixels[i + 1] + g.pixels[i + 2]) / 3;

        if (g.pixels[i + 3] > 10) {
          candidates.push({ x, y, isBlackSection: pixelBrightness < 128 });
        }
      }
    }

    g.remove();
    p.shuffle(candidates, true);

    for (let i = 0; i < candidates.length; i++) {
      const pt = candidates[i];
      const elIndex = pt.isBlackSection ? p.random(blackElements) : whiteElement;
      const scaleVariation = p.random([0.5, 1.0, 1.5]);

      dots.push({
        x: pt.x + p.random(-GRID_STEP * 0.35, GRID_STEP * 0.35),
        y: pt.y + p.random(-GRID_STEP * 0.35, GRID_STEP * 0.35),
        baseSize: p.random(GRID_STEP * 1.2, GRID_STEP * 2.1) * scaleVariation,
        rot: p.random(360),
        elIndex: elIndex,
      });
    }
  }

  function drawElementPreservingAspect(elementImg, size) {
    const elAspect = elementImg.width / elementImg.height;
    const targetW = elAspect >= 1 ? size : size * elAspect;
    const targetH = elAspect >= 1 ? size / elAspect : size;
    p.image(elementImg, 0, 0, targetW, targetH);
  }

  // =========================================================
  // DUSTING UI OVERLAYS + ROUND / CORRUPTION HANDOFF
  // =========================================================
  function createUIOverlays() {
    const container = document.querySelector(".mainCanvas") || document.body;

    // Instruction hover ad
    const instruction = document.createElement("div");
    instruction.id = "instruction-popup";
    instruction.style.cssText = `
      position: absolute; top: 10%; left: 50%; transform: translateX(-50%);
      background: #f4f4f4; border: 2px solid #3700C0; padding: 10px; font-weight: bold;
      z-index: 10; pointer-events: none; font-size: 12px; box-shadow: 4px 4px 0px rgba(0,0,0,0.3);
    `;
    instruction.innerHTML = "hover your duster to see <em>them</em> clearer";
    container.appendChild(instruction);

    // Completion popup ad
    const completion = document.createElement("div");
    completion.id = "completion-popup";
    completion.style.cssText = `
      display: none; position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      background: white; border: 3px solid #3700C0; padding: 20px; z-index: 20;
      text-align: center; box-shadow: 6px 6px 0px rgba(0,0,0,0.4); width: 80%;
    `;
    completion.innerHTML = `
      <h3 style="color: #3700C0; margin-top: 0;">That clears up the atmosphere!</h3>
      <p style="font-size: 14px; color: #444;"><i>but did you see the person beneath it?</i></p>
      <button id="move-on-btn" style="background: #3700C0; color: white; border: none; padding: 8px 16px; cursor: pointer; font-weight: bold; margin-top: 10px;">Move on?</button>
    `;
    container.appendChild(completion);

    document.getElementById("move-on-btn").addEventListener("click", () => {
      playTransitionSound();
      document.getElementById("completion-popup").style.display = "none";
      currentRound++;

      if (currentRound < 3) {
        // Move to the 3rd portrait
        buildDotsForPortrait(selectedPortraits[currentRound]);
        setupDustBuffer();
        const instructionEl = document.getElementById("instruction-popup");
        if (instructionEl) instructionEl.style.display = "block";
        STATE = "dusting";
      } else {
        // Limit reached: stop the sketch and hand off to corruption.js
        isCorrupted = true;
        STATE = "corrupted";

        if (typeof window.triggerCorruption === "function") {
          window.triggerCorruption();
        } else {
          console.error(
            "corruption.js not found — make sure it's linked in your HTML before this sketch runs its course."
          );
        }
      }
    });
  }

  // =========================================================
  // OPTIONAL LEGACY UI HOOKS (chat composer, size controls, etc.)
  // These are inert unless your HTML actually contains matching
  // elements (.chat-input, .composer-enter, .text-block, .popup-ad,
  // .campaign-content, .size-stage). Safe to keep even if unused.
  // =========================================================
  function initializeInterface() {
    const chatInput = document.querySelector(".chat-input");
    const enterButton = document.querySelector(".composer-enter");
    const chatForm = document.querySelector(".topics-chat");
    const notifications = document.querySelector(".chat-notifications");
    const notificationSound = document.getElementById("unavailable-notification-sound");
    const textBlock = document.querySelector(".text-block");
    const popupAd = document.querySelector(".popup-ad");
    const campaignContent = document.querySelector(".campaign-content");
    const elementSizeControls = document.querySelectorAll(".size-stage");
    const elementSizeMessage = document.querySelector("#element-size-message");
    let previousTextScrollTop = textBlock ? textBlock.scrollTop : 0;

    function setElementSizeControl(control) {
      elementSizeControls.forEach((sizeControl) => sizeControl.classList.remove("is-active"));
      control.classList.add("is-active");
      if (elementSizeMessage) elementSizeMessage.textContent = control.dataset.message;
      window.setElementSizeMultiplier(Number(control.dataset.multiplier));
    }

    elementSizeControls.forEach((sizeControl) => {
      sizeControl.addEventListener("click", () => setElementSizeControl(sizeControl));
    });

    if (popupAd) {
      popupAd.addEventListener("click", () => {
        const isExpanded = popupAd.getAttribute("aria-expanded") === "true";
        popupAd.setAttribute("aria-expanded", String(!isExpanded));
        if (campaignContent) campaignContent.hidden = isExpanded;
      });
    }

    function showOfflineNotification() {
      if (!chatInput || !chatInput.value.trim()) return;

      const notification = document.createElement("div");
      notification.className = "chat-notification";
      notification.textContent = "The person is unavailable";
      if (notifications) notifications.appendChild(notification);
      chatInput.value = "";

      if (notificationSound && notificationSound.currentSrc) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(() => {});
      } else {
        window.playTextNotificationSound();
      }

      notification.addEventListener("animationend", () => notification.remove(), { once: true });
    }

    if (chatForm) {
      chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        showOfflineNotification();
      });
    } else if (enterButton) {
      enterButton.addEventListener("click", showOfflineNotification);
    }

    if (textBlock) {
      textBlock.addEventListener("scroll", () => {
        if (textBlock.scrollTop > previousTextScrollTop) {
          window.playScrollSound("down");
        } else if (textBlock.scrollTop < previousTextScrollTop) {
          window.playScrollSound("up");
        }
        previousTextScrollTop = textBlock.scrollTop;
      });
    }

    // Ambient loop starts on the first tap/click anywhere on the page
    document.addEventListener("pointerdown", startAmbientSound, { once: true });
  }
};

// Start the sketch
new p5(myMainCanvasSketch);