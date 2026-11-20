
import CONFIG from "./config.js";

// ------------------------------------
// 1. HELPER FUNCTIONS
// ------------------------------------

const $ = (id) => document.getElementById(id);

function normalize(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function showPage(pageId) {
  const pages = ["nameGate", "passwordGate", "guestPage", "vipPage"];

  pages.forEach(id => {
    const page = $(id);
    page.classList.add("hidden");
    page.style.opacity = "1";
  });

  $(pageId).classList.remove("hidden");
}

function fadeOut(element, callback) {
  element.style.transition = "opacity 0.7s ease";
  element.style.opacity = "0";

  setTimeout(() => {
    callback();
  }, 700);
}

// ------------------------------------
// 2. NAME-BASED GATEKEEPER
// ------------------------------------

let enteredName = "";

$("nameForm").addEventListener("submit", (event) => {
  event.preventDefault();

  enteredName = $("guestName").value.trim();

  if (!enteredName) {
    $("nameError").textContent = "Please enter your name.";
    return;
  }

  $("nameError").textContent = "";

  if (normalize(enteredName) === normalize(CONFIG.names.guestOfHonor)) {
    showPage("passwordGate");
    $("passwordInput").focus();
  } else {
    openGuestMode();
  }
});

// ------------------------------------
// 3. SADIA'S PASSWORD CHECK
// ------------------------------------

$("passwordForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const enteredPassword = $("passwordInput").value;

  if (normalize(enteredPassword) === normalize(CONFIG.password)) {
    $("passwordError").textContent = "";

    fadeOut($("passwordGate"), () => {
      showPage("vipPage");
      initializeVIP();
    });
  } else {
    $("passwordError").textContent =
      "Not quite! Try again, Sadia. ♡";

    $("passwordInput").value = "";
    $("passwordInput").focus();
  }
});

// Password hint

$("hintButton").addEventListener("click", () => {
  $("passwordHint").textContent = CONFIG.passwordHint;
  $("passwordHint").classList.remove("hidden");
});

// ------------------------------------
// 4. GUEST MODE
// ------------------------------------

function openGuestMode() {
  showPage("guestPage");

  $("guestGreeting").textContent = `Hey ${enteredName}!`;

  $("guestMessage").textContent =
    `Hey ${enteredName}! Sorry, VIPs (Sadia) only inside. Leave a birthday wish below so she knows you stopped by!`;

  $("wishName").value = enteredName;
}

// ------------------------------------
// 5. GUESTBOOK BACKEND CONNECTION
// ------------------------------------

const API_URL = "/api/wishes";

$("wishForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = enteredName;
  const message = $("wishMessage").value.trim();

  if (!message) {
    $("wishStatus").textContent = "Please write a little wish first.";
    return;
  }

  $("wishStatus").textContent = "Saving your sticky note...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, message })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not save your wish.");
    }

    $("wishStatus").textContent =
      "Your little birthday wish has been saved! Thank you for stopping by. ♡";

    $("wishPreview").replaceChildren(
      createStickyNote(result.wish)
    );

    $("wishMessage").value = "";

  } catch (error) {
    $("wishStatus").textContent =
      "Couldn't save your wish. Please try again.";
    console.error(error);
  }
});

// ------------------------------------
// 6. STICKY NOTE CREATOR
// ------------------------------------

function createStickyNote(wish) {
  const note = document.createElement("article");
  note.className = "sticky-note";

  const message = document.createElement("p");
  message.textContent = wish.message;

  const signature = document.createElement("small");
  signature.textContent = `— ${wish.name}`;

  note.append(message, signature);

  return note;
}

// ------------------------------------
// 7. LOAD GUESTBOOK WISHES
// ------------------------------------

async function loadWishes() {
  const board = $("wishBoard");

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Could not load birthday wishes.");
    }

    const wishes = await response.json();

    board.replaceChildren();

    if (!Array.isArray(wishes) || wishes.length === 0) {
      const placeholder = document.createElement("article");
      placeholder.className = "sticky-note";

      const message = document.createElement("p");
      message.textContent = CONFIG.guestbook.placeholder;

      const signature = document.createElement("small");
      signature.textContent = CONFIG.guestbook.signature;

      placeholder.append(message, signature);
      board.appendChild(placeholder);

      return;
    }

    wishes.forEach(wish => {
      board.appendChild(createStickyNote(wish));
    });

  } catch (error) {
    console.error(error);

    board.textContent =
      "Your birthday wishes will appear here once the guestbook is connected.";
  }
}

// ------------------------------------
// 8. PHOTO GALLERY
// ------------------------------------

function initializeGallery() {
  const grid = $("photoGrid");
  if (!grid) return;
  grid.replaceChildren();

  // Add your own photos as images/memory1.jpg through images/memory8.jpg.
  const memories = Array.from({ length: 8 }, (_, index) => ({
    filename: `memory${index + 1}.jpg`,
    number: index + 1
  }));

  memories.forEach(({ filename, number }) => {
    const card = document.createElement("article");
    card.className = "scratch-polaroid";

    const photoArea = document.createElement("div");
    photoArea.className = "scratch-photo-area";

    const img = document.createElement("img");
    img.src = `images/${filename}`;
    img.alt = `Memory ${number}`;
    img.draggable = false;
    img.addEventListener("error", () => {
      img.classList.add("missing-memory-photo");
      img.removeAttribute("src");
      img.alt = "";
      photoArea.classList.add("memory-placeholder");
      const placeholder = document.createElement("span");
      placeholder.className = "memory-placeholder-text";
      placeholder.textContent = "Your photo goes here ♡";
      photoArea.insertBefore(placeholder, photoArea.firstChild);
    }, { once: true });

    const canvas = document.createElement("canvas");
    canvas.className = "scratch-layer";
    canvas.setAttribute("aria-label", `Scratch to reveal memory ${number}`);
    canvas.title = "Scratch to reveal";

    photoArea.append(img, canvas);

    const caption = document.createElement("p");
    caption.className = "polaroid-caption";
    caption.textContent = "A little memory ♡";

    card.append(photoArea, caption);
    grid.appendChild(card);

    // Draw a tactile silver foil layer, then erase it where the user scratches.
    const context = canvas.getContext("2d");
    let isScratching = false;
    let scratchedPixels = 0;
    let hasStarted = false;

    function sizeCanvas() {
      if (hasStarted) return;
      const rect = photoArea.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const gradient = context.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#d9d8d2");
      gradient.addColorStop(0.25, "#f7f6f1");
      gradient.addColorStop(0.52, "#bcbdb8");
      gradient.addColorStop(0.78, "#eeede8");
      gradient.addColorStop(1, "#c7c6c0");
      context.globalCompositeOperation = "source-over";
      context.fillStyle = gradient;
      context.fillRect(0, 0, rect.width, rect.height);
      context.fillStyle = "rgba(255,255,255,.55)";
      context.font = "14px Georgia";
      context.textAlign = "center";
      context.fillText("Scratch to reveal ♡", rect.width / 2, rect.height / 2);
      context.globalCompositeOperation = "destination-out";
    }

    function scratch(event) {
      if (!isScratching) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      context.beginPath();
      context.arc(x, y, 22, 0, Math.PI * 2);
      context.fill();
      scratchedPixels++;
      if (scratchedPixels > 35) {
        // Clear the remaining foil after a generous amount of scratching.
        context.clearRect(0, 0, rect.width, rect.height);
        canvas.classList.add("revealed");
      }
    }

    canvas.addEventListener("pointerdown", event => {
      if (canvas.classList.contains("revealed")) return;
      isScratching = true;
      hasStarted = true;
      canvas.setPointerCapture?.(event.pointerId);
      scratch(event);
    });
    canvas.addEventListener("pointermove", scratch);
    const stopScratch = () => { isScratching = false; };
    canvas.addEventListener("pointerup", stopScratch);
    canvas.addEventListener("pointercancel", stopScratch);
    canvas.addEventListener("lostpointercapture", stopScratch);

    requestAnimationFrame(sizeCanvas);
    window.addEventListener("resize", sizeCanvas, { passive: true });
  });
}

// Lightbox modal

function openLightbox(src, caption) {
  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(35,35,35,0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 25px;
    flex-direction: column;
  `;

  const image = document.createElement("img");
  image.src = src;
  image.alt = caption;

  image.style.cssText = `
    max-width: 100%;
    max-height: 75vh;
    object-fit: contain;
    border: 10px solid white;
    border-bottom-width: 35px;
  `;

  const text = document.createElement("p");
  text.textContent = caption;
  text.style.cssText = `
    color: white;
    font-family: Georgia, serif;
    margin-top: 18px;
  `;

  const close = document.createElement("button");
  close.textContent = "Close ×";
  close.style.cssText = `
    margin-top: 20px;
    padding: 12px 25px;
    background: #7A8B76;
    color: white;
    border-radius: 4px;
  `;

  close.addEventListener("click", () => overlay.remove());

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });

  overlay.append(image, text, close);
  document.body.appendChild(overlay);
}

// ------------------------------------
// 9. INTERACTIVE FOUR-QUESTION QUIZ
// ------------------------------------

let currentQuestion = 0;

function showQuizQuestion() {
  const container = $("quizCard");
  container.replaceChildren();

  if (currentQuestion >= CONFIG.quiz.length) {
    const finished = document.createElement("h3");
    finished.textContent = "That's all for now, birthday girl! ♡";

    const message = document.createElement("p");
    message.textContent = "I hope that made you smile.";

    const restart = document.createElement("button");
    restart.textContent = "Play again";
    restart.addEventListener("click", () => {
      currentQuestion = 0;
      showQuizQuestion();
    });

    container.append(finished, message, restart);
    return;
  }

  const question = CONFIG.quiz[currentQuestion];

  const heading = document.createElement("h3");
  heading.textContent =
    `Question ${currentQuestion + 1} of ${CONFIG.quiz.length}`;

  const questionText = document.createElement("p");
  questionText.textContent = question.question;

  container.append(heading, questionText);

  question.options.forEach(option => {
    const button = document.createElement("button");
    button.textContent = option;

    button.addEventListener("click", () => {
      showQuizReply(question.reply);
    });

    container.appendChild(button);
  });
}

function showQuizReply(reply) {
  const container = $("quizCard");
  container.replaceChildren();

  const message = document.createElement("h3");
  message.textContent = reply;

  const next = document.createElement("button");
  next.textContent =
    currentQuestion === CONFIG.quiz.length - 1
      ? "Finish ♡"
      : "Next question →";

  next.addEventListener("click", () => {
    currentQuestion++;
    showQuizQuestion();
  });

  container.append(message, next);
}

// ------------------------------------
// 10. RANDOM LOVE NOTE GENERATOR
// ------------------------------------

$("newNote").addEventListener("click", () => {
  const notes = CONFIG.loveNotes;

  if (!notes.length) return;

  const randomIndex = Math.floor(Math.random() * notes.length);

  $("randomNote").textContent = notes[randomIndex];
});

// ------------------------------------
// 11. BIRTHDAY LETTER REVEAL
// ------------------------------------

$("openLetter").addEventListener("click", () => {
  $("letterText").textContent = CONFIG.letter;
  $("letterText").classList.remove("hidden");

  $("openLetter").textContent = "Opened with love ♡";
  $("openLetter").disabled = true;
});

// ------------------------------------
// 12. INITIALIZE SADIA'S VIP WEBSITE
// ------------------------------------

function initializeVIP() {
  initializeGallery();

  currentQuestion = 0;
  showQuizQuestion();

  $("randomNote").textContent =
    "A little reminder of how special you are.";

  $("letterText").classList.add("hidden");
  $("openLetter").textContent = "♡ Open your letter ♡";
  $("openLetter").disabled = false;

  loadWishes();
}

console.log("Sadia's birthday website is ready! ♡");
// ------------------------------------
// 13. DREAMY BACKGROUND MOTION
// ------------------------------------

(function initializeDreamyAtmosphere() {
  const petalLayer = $("petal-layer");
  const sparkleLayer = $("sparkle-layer");
  if (!petalLayer || !sparkleLayer) return;

  // A light layer of drifting petals and firefly-like lights.
  for (let i = 0; i < 22; i++) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.style.setProperty("--left", `${Math.random() * 100}%`);
    petal.style.setProperty("--size", `${7 + Math.random() * 9}px`);
    petal.style.setProperty("--duration", `${15 + Math.random() * 18}s`);
    petal.style.setProperty("--delay", `${-Math.random() * 28}s`);
    petal.style.setProperty("--opacity", `${0.28 + Math.random() * 0.42}`);
    petalLayer.appendChild(petal);
  }

  for (let i = 0; i < 18; i++) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.setProperty("--left", `${Math.random() * 100}%`);
    sparkle.style.setProperty("--top", `${Math.random() * 100}%`);
    sparkle.style.setProperty("--size", `${2 + Math.random() * 3}px`);
    sparkle.style.setProperty("--duration", `${3 + Math.random() * 5}s`);
    sparkle.style.setProperty("--delay", `${-Math.random() * 8}s`);
    sparkleLayer.appendChild(sparkle);
  }

  // Scroll and pointer movement gently shift the illustrated landscape.
  let framePending = false;
  const updateScene = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--scroll-shift", `${window.scrollY * 0.22}px`);
      framePending = false;
    });
  };
  window.addEventListener("scroll", updateScene, { passive: true });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const x = (event.clientX / window.innerWidth - 0.5) * 34;
    const y = (event.clientY / window.innerHeight - 0.5) * 26;
    document.documentElement.style.setProperty("--pointer-x", `${x}px`);
    document.documentElement.style.setProperty("--pointer-y", `${y}px`);
  }, { passive: true });

  // Tiny heart glimmers appear around buttons and meaningful interactions.
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("button, a, .photo-card");
    if (!target || target.disabled) return;
    const heart = document.createElement("span");
    heart.className = "love-spark";
    heart.textContent = ["♡", "✦", "♥"][Math.floor(Math.random() * 3)];
    heart.style.left = `${event.clientX}px`;
    heart.style.top = `${event.clientY}px`;
    document.body.appendChild(heart);
    heart.addEventListener("animationend", () => heart.remove(), { once: true });
  });
})();

// ------------------------------------
// 14. BACKGROUND MUSIC
// ------------------------------------

(function initializeBackgroundMusic() {
  const toggle = $("music-toggle");
  const icon = $("music-icon");
  const title = $("music-title");
  const status = $("music-status");
  const dock = document.querySelector(".music-dock");
  if (!toggle || !icon || !title || !status) return;

  const musicConfig = CONFIG.music || {};
  title.textContent = musicConfig.title || "A little melody for Sadia";
  let audioElement = null;
  let audioContext = null;
  let melodyTimer = null;
  let melodyIndex = 0;
  let isPlaying = false;
  let masterGain = null;
  let droneOscillator = null;
  let droneGain = null;

  // Original gentle melody, generated in the browser. No copyrighted track is embedded.
  const melody = [293.66, 369.99, 440.00, 554.37, 493.88, 440.00, 369.99, 329.63,
                  293.66, 369.99, 440.00, 493.88, 440.00, 369.99, 329.63, 293.66];

  function playGeneratedNote(frequency) {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.045, now + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    oscillator.connect(envelope);
    envelope.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 1.4);
  }

  function startGeneratedMelody() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      status.textContent = "Add a song file in music/ to play audio here";
      return false;
    }
    if (!audioContext) {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Math.max(0.02, Math.min(0.6, Number(musicConfig.volume) || 0.24));
      masterGain.connect(audioContext.destination);

      droneOscillator = audioContext.createOscillator();
      droneGain = audioContext.createGain();
      droneOscillator.type = "sine";
      droneOscillator.frequency.value = 146.83;
      droneGain.gain.value = 0.012;
      droneOscillator.connect(droneGain);
      droneGain.connect(masterGain);
      droneOscillator.start();
    }
    audioContext.resume();
    playGeneratedNote(melody[melodyIndex % melody.length]);
    melodyIndex++;
    melodyTimer = window.setInterval(() => {
      playGeneratedNote(melody[melodyIndex % melody.length]);
      melodyIndex++;
    }, 1450);
    status.textContent = "Playing a little original love melody ♡";
    return true;
  }

  async function startMusic() {
    let chosenSource = musicConfig.src;
    try {
      const uploaded = await fetch("/api/music").then(response => response.ok ? response.json() : null);
      if (uploaded?.src) {
        chosenSource = uploaded.src;
        title.textContent = uploaded.title || "A little melody for you";
      }
    } catch {}
    if (chosenSource) {
      if (!audioElement || audioElement.src !== new URL(chosenSource, window.location.href).href) {
        if (audioElement) audioElement.pause();
        audioElement = new Audio(chosenSource);
        audioElement.loop = true;
        audioElement.volume = Math.max(0, Math.min(1, Number(musicConfig.volume) || 0.24));
      }
      try {
        await audioElement.play();
        status.textContent = "Now playing your song ♡";
        return true;
      } catch (error) {
        status.textContent = "Tap play again to start the song";
        return false;
      }
    }
    return startGeneratedMelody();
  }

  function stopMusic() {
    if (audioElement) audioElement.pause();
    if (melodyTimer) {
      window.clearInterval(melodyTimer);
      melodyTimer = null;
    }
    if (audioContext && audioContext.state === "running") audioContext.suspend();
    status.textContent = "Paused — tap when you want a little music";
  }

  toggle.addEventListener("click", async () => {
    if (isPlaying) {
      stopMusic();
      isPlaying = false;
      icon.textContent = "▶";
      toggle.setAttribute("aria-label", "Play background music");
      toggle.setAttribute("aria-pressed", "false");
      dock?.classList.remove("is-playing");
      return;
    }

    const started = await startMusic();
    if (started) {
      isPlaying = true;
      icon.textContent = "Ⅱ";
      toggle.setAttribute("aria-label", "Pause background music");
      toggle.setAttribute("aria-pressed", "true");
      dock?.classList.add("is-playing");
    }
  });
})();

// ------------------------------------
// 15. PRIVATE ADMIN CONTROL ROOM
// ------------------------------------
(function initializeAdminControls() {
  let adminToken = "";
  const openButton = $("adminOpen");
  if (!openButton) return;
  const login = $("adminLogin");
  const panel = $("adminPanel");
  const closeOverlays = () => { login.classList.add("hidden"); panel.classList.add("hidden"); };
  document.querySelectorAll("[data-close-admin]").forEach(button => button.addEventListener("click", closeOverlays));
  openButton.addEventListener("click", () => { login.classList.remove("hidden"); $("adminPassword").focus(); });
  async function adminRequest(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "x-admin-token": adminToken, ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }
  $("adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const status = $("adminLoginStatus"); status.textContent = "Checking password...";
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("adminPassword").value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Login failed.");
      adminToken = data.token; $("adminPassword").value = ""; login.classList.add("hidden"); panel.classList.remove("hidden"); await refreshAdminWishes();
    } catch (error) { status.textContent = error.message; }
  });
  async function refreshAdminWishes() {
    const list = $("adminWishList"); list.textContent = "Loading wishes...";
    try {
      const wishes = await adminRequest("/api/wishes"); list.replaceChildren();
      if (!wishes.length) { list.textContent = "No wishes have been posted yet."; return; }
      wishes.forEach(wish => {
        const row = document.createElement("div"); row.className = "admin-wish";
        const copy = document.createElement("div"); copy.className = "admin-wish-text";
        const name = document.createElement("small"); name.textContent = wish.name;
        const message = document.createElement("div"); message.textContent = wish.message;
        copy.append(name, message);
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        edit.addEventListener("click", async () => {
          const newName = prompt("Edit the name:", wish.name); if (newName === null) return;
          const newMessage = prompt("Edit the birthday wish:", wish.message); if (newMessage === null) return;
          try { await adminRequest(`/api/admin/wishes/${encodeURIComponent(wish.id)}`, { method: "PUT", body: JSON.stringify({ name: newName, message: newMessage }) }); await refreshAdminWishes(); await loadWishes(); }
          catch (error) { alert(error.message); }
        });
        const del = document.createElement("button"); del.type = "button"; del.textContent = "Delete"; del.className = "secondary";
        del.addEventListener("click", async () => { if (!confirm(`Delete the wish from ${wish.name}?`)) return; try { await adminRequest(`/api/admin/wishes/${encodeURIComponent(wish.id)}`, { method: "DELETE" }); await refreshAdminWishes(); await loadWishes(); } catch (error) { alert(error.message); } });
        row.append(copy, edit, del); list.appendChild(row);
      });
    } catch (error) { list.textContent = error.message; }
  }
  $("refreshAdminWishes").addEventListener("click", refreshAdminWishes);
  $("uploadSong").addEventListener("click", async () => {
    const file = $("adminSong").files[0]; const status = $("musicAdminStatus");
    if (!file) { status.textContent = "Choose a song first."; return; }
    if (file.size > 20 * 1024 * 1024) { status.textContent = "Please choose a song under 20 MB."; return; }
    status.textContent = "Uploading song...";
    const reader = new FileReader();
    reader.onload = async () => { try { const result = await adminRequest("/api/admin/music", { method: "POST", body: JSON.stringify({ name: file.name, data: reader.result }) }); status.textContent = "Song uploaded! Refresh the page to use it."; const musicTitle = $("music-title"); if (musicTitle) musicTitle.textContent = result.title; } catch (error) { status.textContent = error.message; } };
    reader.onerror = () => { status.textContent = "Could not read that file."; };
    reader.readAsDataURL(file);
  });
  $("adminLogout").addEventListener("click", async () => { try { await adminRequest("/api/admin/logout", { method: "POST", body: "{}" }); } catch {} adminToken = ""; closeOverlays(); });
})();
