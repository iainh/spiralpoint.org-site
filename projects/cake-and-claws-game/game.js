(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const startScreen = document.getElementById("start-screen");
  const endScreen = document.getElementById("end-screen");
  const pauseScreen = document.getElementById("pause-screen");
  const gameFrame = document.getElementById("game-frame");
  const toast = document.getElementById("toast");
  const pauseButton = document.getElementById("pause-button");
  const soundButton = document.getElementById("sound-button");
  const W = canvas.width;
  const H = canvas.height;

  const COLORS = {
    ink: "#56354d",
    inkDark: "#2e2135",
    cream: "#fff4d7",
    floor: "#f4d1a4",
    tile: "#edbf91",
    tileLight: "#ffdfae",
    tileDark: "#c98e72",
    pink: "#ed7e9d",
    pinkLight: "#ffb2bd",
    pinkDark: "#b94f73",
    purple: "#76528e",
    purpleLight: "#aa7db2",
    mint: "#75b99f",
    mintLight: "#a8dfba",
    mintDark: "#477b6b",
    aqua: "#79d4ce",
    wood: "#ad6c51",
    woodLight: "#dc9465",
    woodDark: "#794858",
    yellow: "#f3c65d",
    white: "#fffaf0",
    cocoa: "#754437",
    berry: "#d95275",
    silver: "#8f8aa0",
  };

  const RECIPES = {
    cupcake: { name: "Berry Cupcake", icon: "🧁", ingredients: ["flour", "berry"], points: 120 },
    cookie: { name: "Cocoa Cookie", icon: "🍪", ingredients: ["flour", "cocoa"], points: 100 },
    cake: { name: "Celebration Cake", icon: "🍰", ingredients: ["flour", "berry", "cocoa"], points: 180 },
  };

  const DECORATIONS = {
    sprinkles: { name: "Sprinkles", color: COLORS.pink },
    cream: { name: "Cream Swirl", color: COLORS.white },
  };

  const RUSH_LEVELS = [
    { label: "MORNING WARM-UP", served: 0 },
    { label: "LUNCH RUSH", served: 2 },
    { label: "AFTERNOON RUSH", served: 5 },
  ];

  const STREAK_BONUSES = { 3: 50, 5: 100, 8: 200 };
  const BEST_SCORE_KEY = "cakes-and-claws-best-score";

  const CUSTOMER_COLORS = ["#db8aa1", "#89a9c5", "#dca667", "#9d86b5", "#7eb6a0"];
  const keys = new Set();
  let state;
  let lastTime = 0;
  let toastTimer = 0;
  let audioContext;
  let audioEnabled = true;

  function createState() {
    return {
      mode: "intro",
      time: 150,
      score: 0,
      bestScore: loadBestScore(),
      served: 0,
      goal: 8,
      missed: 0,
      rush: 0,
      streak: 0,
      active: 0,
      tray: [],
      rack: [],
      oven: null,
      customers: [],
      nextCustomerIn: 0,
      cats: [
        { name: "Poppy", x: 420, y: 365, color: "#e39463", accent: COLORS.pink, facing: 1 },
        { name: "Miso", x: 540, y: 365, color: "#aaa2b5", accent: COLORS.mint, facing: -1 },
      ],
      particles: [],
      elapsed: 0,
    };
  }

  const stations = [
    { id: "flour", label: "FLOUR", x: 72, y: 160, w: 120, h: 100, kind: "ingredient" },
    { id: "berry", label: "BERRIES", x: 72, y: 320, w: 120, h: 100, kind: "ingredient" },
    { id: "cocoa", label: "COCOA", x: 768, y: 160, w: 120, h: 100, kind: "ingredient" },
    { id: "oven", label: "OVEN", x: 750, y: 332, w: 155, h: 120, kind: "oven" },
    { id: "counter", label: "SERVE", x: 350, y: 118, w: 260, h: 72, kind: "counter" },
    { id: "bin", label: "CLEAR", x: 230, y: 412, w: 74, h: 65, kind: "bin" },
    { id: "sprinkles", label: "SPRINKLES", x: 330, y: 225, w: 105, h: 72, kind: "decoration" },
    { id: "cream", label: "CREAM", x: 525, y: 225, w: 105, h: 72, kind: "decoration" },
  ];

  function startGame() {
    state = createState();
    state.mode = "playing";
    addCustomer();
    state.nextCustomerIn = 13;
    startScreen.classList.add("overlay--hidden");
    endScreen.classList.add("overlay--hidden");
    pauseScreen.classList.add("overlay--hidden");
    gameFrame.classList.remove("game-frame--modal");
    updateUtilityButtons();
    lastTime = performance.now();
    sound(440, 0.08, "square");
  }

  function addCustomer() {
    if (state.customers.length >= 3 || state.served + state.missed + state.customers.length >= 12) return;
    const recipeKeys = Object.keys(RECIPES);
    let type = recipeKeys[Math.floor(Math.random() * recipeKeys.length)];
    if (state.served < 2 && type === "cake") type = state.served === 0 ? "cupcake" : "cookie";
    const decorationKeys = Object.keys(DECORATIONS);
    state.customers.push({
      type,
      decoration: state.served >= 5 ? decorationKeys[Math.floor(Math.random() * decorationKeys.length)] : null,
      patience: 42,
      maxPatience: 42,
      color: CUSTOMER_COLORS[Math.floor(Math.random() * CUSTOMER_COLORS.length)],
      blink: Math.random() * 3,
    });
  }

  function update(dt) {
    if (!state || state.mode !== "playing") return;
    state.elapsed += dt;
    state.time -= dt;
    state.nextCustomerIn -= dt;

    const cat = state.cats[state.active];
    let dx = 0;
    let dy = 0;
    if (keys.has("arrowleft") || keys.has("a") || keys.has("left")) dx -= 1;
    if (keys.has("arrowright") || keys.has("d") || keys.has("right")) dx += 1;
    if (keys.has("arrowup") || keys.has("w") || keys.has("up")) dy -= 1;
    if (keys.has("arrowdown") || keys.has("s") || keys.has("down")) dy += 1;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const speed = 170;
      cat.x = clamp(cat.x + (dx / length) * speed * dt, 215, 745);
      cat.y = clamp(cat.y + (dy / length) * speed * dt, 220, 465);
      if (dx) cat.facing = Math.sign(dx);
    }

    if (state.oven) {
      state.oven.time -= dt;
      if (state.oven.time <= 0) finishBaking();
    }

    state.customers.forEach((customer) => {
      customer.blink += dt;
    });
    const waitingCustomer = state.customers[0];
    if (waitingCustomer) {
      waitingCustomer.patience -= dt;
      if (waitingCustomer.patience <= 0) {
        state.customers.shift();
        state.missed += 1;
        state.streak = 0;
        showToast("A customer left hungry…");
        sound(145, 0.18, "sawtooth");
      }
    }

    if (state.nextCustomerIn <= 0) {
      addCustomer();
      state.nextCustomerIn = Math.max(8, 14 - state.served * 0.45);
    }

    state.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);

    if (state.served >= state.goal) endGame(true);
    else if (state.missed >= 3) endGame(false, "missed");
    else if (state.time <= 0) endGame(false, "time");
  }

  function interact() {
    if (!state || state.mode !== "playing") return;
    const cat = state.cats[state.active];
    let nearest = null;
    let distance = Infinity;
    stations.forEach((station) => {
      const sx = station.x + station.w / 2;
      const sy = station.y + station.h / 2;
      const d = Math.hypot(cat.x - sx, cat.y - sy);
      if (d < distance) {
        distance = d;
        nearest = station;
      }
    });
    if (!nearest || distance > 125) {
      showToast("Move closer to a station!");
      return;
    }

    if (nearest.kind === "ingredient") addIngredient(nearest.id);
    if (nearest.kind === "oven") useOven();
    if (nearest.kind === "counter") serveCustomer();
    if (nearest.kind === "bin") clearTray();
    if (nearest.kind === "decoration") decorateTreat(nearest.id);
  }

  function addIngredient(ingredient) {
    if (state.tray.length >= 3) {
      showToast("The mixing bowl is full — clear or bake it!");
      sound(180, 0.08, "square");
      return;
    }
    state.tray.push(ingredient);
    burst(state.cats[state.active].x, state.cats[state.active].y - 20, ingredientColor(ingredient), 5);
    showToast(`${capitalize(ingredient)} added to the bowl`);
    sound(520 + state.tray.length * 70, 0.06, "square");
  }

  function useOven() {
    if (state.oven) {
      showToast(`${RECIPES[state.oven.type].name} is still baking!`);
      return;
    }
    const recipe = findRecipe(state.tray);
    if (!recipe) {
      showToast(state.tray.length ? "That mix isn't a recipe — use CLEAR" : "Gather ingredients first!");
      sound(170, 0.12, "square");
      return;
    }
    if (state.rack.length >= 3) {
      showToast("The cooling rack is full. Serve something first!");
      return;
    }
    state.oven = { type: recipe, time: recipe === "cake" ? 5 : 3.5, total: recipe === "cake" ? 5 : 3.5 };
    state.tray = [];
    showToast(`${RECIPES[recipe].name} is baking…`);
    sound(330, 0.1, "sine");
  }

  function finishBaking() {
    const type = state.oven.type;
    state.rack.push({ type, decoration: null });
    state.oven = null;
    burst(825, 345, COLORS.yellow, 12);
    showToast(`${RECIPES[type].name} is ready!`);
    sound(660, 0.08, "square");
    setTimeout(() => sound(880, 0.1, "square"), 90);
  }

  function serveCustomer() {
    if (!state.customers.length) {
      showToast("No one is waiting right now!");
      return;
    }
    const customer = state.customers[0];
    const rackIndex = state.rack.findIndex((treat) =>
      treat.type === customer.type && treat.decoration === customer.decoration
    );
    if (rackIndex === -1) {
      showToast(`They ordered ${describeOrder(customer)}!`);
      sound(210, 0.08, "square");
      return;
    }
    state.rack.splice(rackIndex, 1);
    state.customers.shift();
    const tip = Math.round((customer.patience / customer.maxPatience) * 80);
    const orderPoints = RECIPES[customer.type].points + tip;
    state.score += orderPoints;
    state.served += 1;
    state.streak += 1;
    const streakBonus = STREAK_BONUSES[state.streak] || 0;
    state.score += streakBonus;
    const previousRush = state.rush;
    state.rush = rushForServed(state.served);
    state.time = Math.min(150, state.time + 4);
    burst(480, 145, COLORS.pink, 20);
    const announcements = [];
    if (state.rush > previousRush) {
      const unlock = state.rush === 1
        ? " Celebration Cake unlocked!"
        : " Decorated orders unlocked and customers are arriving faster!";
      announcements.push(`${RUSH_LEVELS[state.rush].label}!${unlock}`);
    }
    if (streakBonus) announcements.push(`${state.streak}-order streak! +${streakBonus} bonus`);
    showToast(announcements.length ? announcements.join(" · ") : `Perfect order! +${orderPoints} points, +4 seconds`);
    sound(740, 0.08, "square");
    setTimeout(() => sound(990, 0.12, "square"), 100);
    state.nextCustomerIn = Math.min(state.nextCustomerIn, 3);
  }

  function decorateTreat(decoration) {
    if (state.rush < 2) {
      showToast("Decorating opens during the afternoon rush!");
      return;
    }
    const rackIndex = state.rack.findIndex((treat) => !treat.decoration);
    if (rackIndex === -1) {
      showToast(state.rack.length ? "Every treat on the rack is already decorated!" : "Bake a treat first!");
      return;
    }
    state.rack[rackIndex].decoration = decoration;
    const cat = state.cats[state.active];
    burst(cat.x, cat.y - 20, DECORATIONS[decoration].color, 8);
    showToast(`${DECORATIONS[decoration].name} added to ${RECIPES[state.rack[rackIndex].type].name}`);
    sound(decoration === "sprinkles" ? 720 : 610, 0.08, "square");
  }

  function clearTray() {
    if (state.tray.length) {
      state.tray = [];
      showToast("Mixing bowl cleared");
      sound(150, 0.08, "sine");
      return;
    }
    if (state.rack.length) {
      const discarded = state.rack.shift();
      showToast(`${RECIPES[discarded.type].name} discarded from the rack`);
      sound(150, 0.08, "sine");
      return;
    }
    showToast("The bowl and rack are already empty!");
    sound(150, 0.08, "sine");
  }

  function swapCat() {
    if (!state || state.mode !== "playing") return;
    state.active = state.active === 0 ? 1 : 0;
    const cat = state.cats[state.active];
    burst(cat.x, cat.y - 32, cat.accent, 8);
    showToast(`${cat.name} is on the move!`);
    sound(state.active ? 510 : 620, 0.07, "square");
  }

  function togglePause() {
    if (!state || (state.mode !== "playing" && state.mode !== "paused")) return;
    if (state.mode === "playing") {
      state.mode = "paused";
      keys.clear();
      pauseScreen.classList.remove("overlay--hidden");
      gameFrame.classList.add("game-frame--modal");
    } else {
      state.mode = "playing";
      pauseScreen.classList.add("overlay--hidden");
      gameFrame.classList.remove("game-frame--modal");
      lastTime = performance.now();
    }
    updateUtilityButtons();
  }

  function toggleSound() {
    audioEnabled = !audioEnabled;
    updateUtilityButtons();
    if (audioEnabled) sound(520, 0.07, "square");
  }

  function requestRestart() {
    const activeRun = state && (state.mode === "playing" || state.mode === "paused");
    if (activeRun && !window.confirm("Restart the current bakery shift?")) return;
    startGame();
  }

  function updateUtilityButtons() {
    pauseButton.textContent = state && state.mode === "paused" ? "RESUME" : "PAUSE";
    soundButton.textContent = audioEnabled ? "SOUND ON" : "SOUND OFF";
    soundButton.setAttribute("aria-label", audioEnabled ? "Turn sound off" : "Turn sound on");
    soundButton.setAttribute("aria-pressed", String(!audioEnabled));
  }

  function endGame(won, reason) {
    state.mode = won ? "won" : "lost";
    const newBest = saveBestScore();
    const stars = won ? (state.missed === 0 && state.time > 40 ? 3 : state.missed < 2 ? 2 : 1) : 0;
    document.getElementById("end-eyebrow").textContent = won ? "ALL CUSTOMERS FED" : "SHOP CLOSED";
    document.getElementById("end-title").textContent = won ? "Sweet success!" : "Oh, crumbs!";
    const endStars = document.getElementById("end-stars");
    endStars.innerHTML = Array.from({ length: 3 }, (_, index) =>
      `<span class="end-star${index < stars ? "" : " end-star--empty"}">★</span>`
    ).join("");
    endStars.setAttribute("aria-label", `${stars} out of 3 stars`);
    const result = won
      ? `Poppy and Miso served ${state.served} treats and scored ${state.score} points!`
      : reason === "missed"
        ? `Three customers left hungry. You served ${state.served} of ${state.goal} customers.`
        : `Closing time ran out. You served ${state.served} of ${state.goal} customers.`;
    document.getElementById("end-copy").textContent = `${result} ${newBest ? `New best: ${state.bestScore} points!` : `Best: ${state.bestScore} points.`}`;
    pauseScreen.classList.add("overlay--hidden");
    gameFrame.classList.add("game-frame--modal");
    endScreen.classList.remove("overlay--hidden");
    updateUtilityButtons();
    sound(won ? 600 : 160, 0.3, won ? "square" : "sawtooth");
  }

  function findRecipe(ingredients) {
    const sorted = [...ingredients].sort().join(",");
    return Object.keys(RECIPES).find((key) => [...RECIPES[key].ingredients].sort().join(",") === sorted);
  }

  function describeOrder(order) {
    const decoration = order.decoration ? ` with ${DECORATIONS[order.decoration].name}` : "";
    return `${RECIPES[order.type].icon} ${RECIPES[order.type].name}${decoration}`;
  }

  function rushForServed(served) {
    for (let index = RUSH_LEVELS.length - 1; index >= 0; index -= 1) {
      if (served >= RUSH_LEVELS[index].served) return index;
    }
    return 0;
  }

  function loadBestScore() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY), 10) || 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBestScore() {
    if (state.score <= state.bestScore) return false;
    state.bestScore = state.score;
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(state.bestScore));
    } catch (_) {
      // A blocked storage API should not prevent the game from ending.
    }
    return true;
  }

  function render() {
    drawBakery();
    if (!state) return;
    drawCustomers();
    drawStations();
    drawCats();
    drawParticles();
    drawHud();
    drawInteractionHint();
  }

  function drawBakery() {
    // Layered 16-bit tile floor with hard-edged highlights and grout.
    ctx.fillStyle = COLORS.tileDark;
    ctx.fillRect(0, 100, W, H - 100);
    for (let y = 106; y < H; y += 40) {
      for (let x = 0; x < W; x += 40) {
        const alternate = ((x / 40 + y / 40) | 0) % 2 === 0;
        ctx.fillStyle = alternate ? COLORS.floor : COLORS.tile;
        ctx.fillRect(x + 2, y + 2, 36, 36);
        ctx.fillStyle = alternate ? COLORS.tileLight : "#f7c99b";
        ctx.fillRect(x + 4, y + 4, 32, 4);
        ctx.fillRect(x + 4, y + 8, 4, 25);
        ctx.fillStyle = "rgba(121,72,88,0.14)";
        ctx.fillRect(x + 8, y + 33, 28, 3);
        ctx.fillRect(x + 33, y + 9, 3, 27);
      }
    }

    // Wallpaper, dado rail, and a repeating pastry motif.
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, W, 106);
    ctx.fillStyle = "#f7dcb9";
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, 20, 16, 82);
    ctx.fillStyle = "#eab99f";
    for (let x = 12; x < W; x += 64) {
      ctx.fillRect(x, 67, 4, 4);
      ctx.fillRect(x - 4, 71, 12, 4);
      ctx.fillRect(x, 75, 4, 4);
    }
    ctx.fillStyle = "#fff8dd";
    for (let x = 26; x < W; x += 64) {
      ctx.fillRect(x, 27, 3, 3);
      ctx.fillRect(x + 5, 43, 3, 3);
    }
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(0, 0, W, 12);
    ctx.fillStyle = COLORS.pinkDark;
    for (let x = 0; x < W; x += 32) {
      ctx.fillRect(x, 12, 16, 8);
    }
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 101, W, 6);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(0, 95, W, 6);

    drawWindow(220, 24);
    drawWindow(650, 24);
    drawShelf(34, 36);
    drawShelf(790, 36);
    drawWallPlaque(324, 30, "cupcake");
    drawWallPlaque(604, 30, "cookie");

    // Central woven work rug.
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(203, 202, 554, 280);
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(208, 207, 544, 270);
    ctx.fillStyle = "#e7b98d";
    ctx.fillRect(216, 215, 528, 254);
    ctx.fillStyle = "#dcae84";
    for (let x = 222; x < 740; x += 24) {
      ctx.fillRect(x, 219, 8, 4);
      ctx.fillRect(x + 8, 465, 8, 4);
    }
    ctx.fillStyle = "#c98f7d";
    for (let y = 232; y < 456; y += 32) {
      ctx.fillRect(222, y, 8, 16);
      ctx.fillRect(730, y + 8, 8, 16);
    }
    ctx.fillStyle = "#f3c89a";
    for (let x = 252; x < 710; x += 64) {
      for (let y = 244; y < 450; y += 64) {
        ctx.fillRect(x, y, 5, 5);
        ctx.fillRect(x + 5, y + 5, 5, 5);
      }
    }
    ctx.fillStyle = "rgba(86, 53, 77, 0.08)";
    ctx.fillRect(208, 207, 544, 270);

    drawPlant(18, 448, false);
    drawPlant(911, 448, true);
  }

  function drawWallPlaque(x, y, type) {
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 23, y - 5, 46, 57);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x - 19, y - 1, 38, 49);
    ctx.fillStyle = "#fff0bd";
    ctx.fillRect(x - 14, y + 4, 28, 35);
    drawTreat(type, x, y + 21, 0.72);
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(x - 12, y + 43, 24, 4);
  }

  function drawPlant(x, y, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(4, 35, 42, 43);
    ctx.fillStyle = COLORS.purple;
    ctx.fillRect(8, 38, 34, 34);
    ctx.fillStyle = COLORS.purpleLight;
    ctx.fillRect(12, 41, 7, 25);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(22, 10, 7, 32);
    ctx.fillRect(8, 16, 20, 8);
    ctx.fillRect(27, 3, 20, 8);
    ctx.fillRect(18, -3, 8, 20);
    ctx.fillStyle = COLORS.mintDark;
    ctx.fillRect(24, 12, 4, 27);
    ctx.fillRect(10, 18, 18, 4);
    ctx.fillRect(29, 5, 16, 4);
    ctx.fillRect(20, -1, 4, 17);
    ctx.fillStyle = COLORS.mintLight;
    ctx.fillRect(10, 18, 9, 4);
    ctx.fillRect(29, 5, 8, 4);
    ctx.fillRect(20, -1, 4, 8);
    ctx.restore();
  }

  function drawWindow(x, y) {
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 4, y - 4, 98, 76);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x, y, 90, 68);
    ctx.fillStyle = "#a9d7d1";
    ctx.fillRect(x + 6, y + 6, 78, 56);
    ctx.fillStyle = "#d9f4dc";
    ctx.fillRect(x + 9, y + 9, 32, 20);
    ctx.fillStyle = "#fff0a8";
    ctx.fillRect(x + 12, y + 12, 16, 16);
    ctx.fillStyle = "#78b6b0";
    ctx.fillRect(x + 49, y + 39, 32, 20);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x + 43, y + 6, 5, 56);
    ctx.fillRect(x + 6, y + 32, 78, 5);
    ctx.fillStyle = COLORS.mintDark;
    ctx.fillRect(x + 6, y + 50, 78, 12);
    ctx.fillStyle = COLORS.mintLight;
    ctx.fillRect(x + 12, y + 46, 14, 5);
    ctx.fillRect(x + 62, y + 43, 12, 7);
    const glint = state ? Math.floor((state.elapsed * 12 + x) % 52) : 8;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x + 10 + glint, y + 9, 4, 4);
    ctx.fillRect(x + 14 + glint, y + 13, 4, 4);
  }

  function drawShelf(x, y) {
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 4, y + 47, 143, 12);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x, y + 47, 135, 7);
    const jars = [COLORS.berry, COLORS.yellow, COLORS.cocoa];
    jars.forEach((color, index) => {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(x + 9 + index * 40, y + 7, 32, 43);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(x + 12 + index * 40, y + 13, 26, 35);
      ctx.fillStyle = color;
      ctx.fillRect(x + 16 + index * 40, y + 25, 18, 19);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(x + 16 + index * 40, y + 16, 5, 8);
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(x + 10 + index * 40, y + 9, 30, 5);
    });
  }

  function drawStations() {
    drawIngredientStation(stations[0], "flour");
    drawIngredientStation(stations[1], "berry");
    drawIngredientStation(stations[2], "cocoa");
    drawOven();
    drawCounter();
    drawBin();
    drawDecorationStation(stations[6]);
    drawDecorationStation(stations[7]);
  }

  function drawIngredientStation(station, ingredient) {
    ctx.fillStyle = "rgba(46,33,53,0.25)";
    ctx.fillRect(station.x + 5, station.y + 35, station.w + 10, station.h - 12);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(station.x - 6, station.y + 21, station.w + 12, station.h - 12);
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(station.x, station.y + 25, station.w, 59);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(station.x, station.y + 21, station.w, 10);
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(station.x + 8, station.y + 75, 12, 20);
    ctx.fillRect(station.x + station.w - 20, station.y + 75, 12, 20);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(station.x + 9, station.y + 35, station.w - 18, 34);
    ctx.fillStyle = "#dfb17f";
    ctx.fillRect(station.x + 14, station.y + 64, station.w - 28, 5);
    ctx.fillStyle = ingredientColor(ingredient);
    if (ingredient === "flour") {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(station.x + 34, station.y - 8, 56, 59);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(station.x + 38, station.y - 5, 48, 52);
      ctx.fillStyle = "#e8d9c7";
      ctx.fillRect(station.x + 38, station.y + 35, 48, 12);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(station.x + 43, station.y, 8, 25);
      ctx.fillStyle = COLORS.ink;
      pixelText("F", station.x + 62, station.y + 31, 22, "center");
    } else if (ingredient === "berry") {
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = COLORS.inkDark;
        ctx.beginPath();
        ctx.arc(station.x + 38 + (i % 3) * 20, station.y + 16 + Math.floor(i / 3) * 18, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.berry;
        ctx.beginPath();
        ctx.arc(station.x + 38 + (i % 3) * 20, station.y + 14 + Math.floor(i / 3) * 18, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.pinkLight;
        ctx.fillRect(station.x + 33 + (i % 3) * 20, station.y + 9 + Math.floor(i / 3) * 18, 4, 4);
      }
      ctx.fillStyle = COLORS.mintDark;
      ctx.fillRect(station.x + 56, station.y - 3, 10, 16);
      ctx.fillStyle = COLORS.mint;
      ctx.fillRect(station.x + 64, station.y, 15, 6);
    } else {
      ctx.fillStyle = COLORS.inkDark;
      ctx.beginPath();
      ctx.arc(station.x + 60, station.y + 23, 38, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(station.x + 22, station.y + 19, 76, 9);
      ctx.fillStyle = COLORS.cocoa;
      ctx.beginPath();
      ctx.arc(station.x + 60, station.y + 22, 34, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#4d2d30";
      ctx.fillRect(station.x + 34, station.y + 15, 52, 10);
      ctx.fillStyle = "#bc7653";
      ctx.fillRect(station.x + 45, station.y + 21, 30, 4);
    }
    label(station.label, station.x + station.w / 2, station.y + 92);
  }

  function drawOven() {
    const s = stations[3];
    ctx.fillStyle = "rgba(46,33,53,0.25)";
    ctx.fillRect(s.x + 8, s.y + 14, s.w + 5, s.h - 1);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(s.x - 5, s.y - 5, s.w + 10, s.h + 4);
    ctx.fillStyle = "#c8c1c4";
    ctx.fillRect(s.x, s.y, s.w, s.h - 6);
    ctx.fillStyle = "#f2e2d2";
    ctx.fillRect(s.x + 7, s.y + 6, s.w - 14, 8);
    ctx.fillStyle = COLORS.silver;
    ctx.fillRect(s.x + 12, s.y + 15, s.w - 24, 24);
    ctx.fillStyle = "#b9b3be";
    for (let x = s.x + 68; x < s.x + s.w - 12; x += 16) ctx.fillRect(x, s.y + 22, 8, 8);
    ctx.fillStyle = state && state.oven ? "#f3aa55" : "#3e3442";
    ctx.fillRect(s.x + 18, s.y + 50, s.w - 36, 50);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(s.x + 27, s.y + 58, s.w - 54, 34);
    ctx.fillStyle = "#473449";
    ctx.fillRect(s.x + 32, s.y + 63, s.w - 64, 5);
    if (state && state.oven) {
      const progress = 1 - state.oven.time / state.oven.total;
      const glow = Math.floor(state.elapsed * 8) % 2 ? COLORS.yellow : "#ff9d56";
      ctx.fillStyle = glow;
      ctx.fillRect(s.x + 27, s.y + 58, (s.w - 54) * progress, 34);
      drawTreat(state.oven.type, s.x + s.w / 2, s.y + 76, 1);
      ctx.fillStyle = COLORS.white;
      const steam = Math.floor(state.elapsed * 14) % 12;
      ctx.fillRect(s.x + 68, s.y - 12 - steam, 5, 8);
      ctx.fillRect(s.x + 77, s.y - 22 + steam, 5, 8);
      ctx.fillStyle = COLORS.aqua;
      ctx.fillRect(s.x + 69, s.y - 7 - steam, 4, 4);
      ctx.fillRect(s.x + 78, s.y - 17 + steam, 4, 4);
    }
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(s.x + 22, s.y + 21, 12, 12);
    ctx.fillStyle = COLORS.mintDark;
    ctx.fillRect(s.x + 44, s.y + 21, 12, 12);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(s.x + 13, s.y + 105, 18, 12);
    ctx.fillRect(s.x + s.w - 31, s.y + 105, 18, 12);
    label("OVEN", s.x + s.w / 2, s.y + 116);
  }

  function drawCounter() {
    const s = stations[4];
    ctx.fillStyle = "rgba(46,33,53,0.3)";
    ctx.fillRect(s.x + 6, s.y + 10, s.w + 8, s.h + 8);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(s.x - 6, s.y - 5, s.w + 12, s.h + 15);
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = COLORS.pinkLight;
    ctx.fillRect(s.x + 8, s.y + 15, s.w - 16, 8);
    ctx.fillStyle = COLORS.cream;
    for (let x = s.x; x < s.x + s.w; x += 32) {
      ctx.fillRect(x, s.y, 16, 12);
      ctx.fillStyle = COLORS.pinkLight;
      ctx.fillRect(x + 4, s.y, 8, 4);
      ctx.fillStyle = COLORS.cream;
    }
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(s.x + 18, s.y + 25, s.w - 36, 37);
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(s.x + 24, s.y + 31, s.w - 48, 6);
    label("ORDER COUNTER", s.x + s.w / 2, s.y + 52);
    if (state) {
      state.rack.forEach((treat, i) => {
        drawTreat(treat.type, s.x + 85 + i * 45, s.y + 31, 0.8, treat.decoration);
      });
    }
  }

  function drawBin() {
    const s = stations[5];
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(s.x - 3, s.y + 9, s.w + 6, s.h - 6);
    ctx.fillStyle = COLORS.mintDark;
    ctx.fillRect(s.x + 6, s.y + 17, s.w - 12, s.h - 23);
    ctx.fillStyle = COLORS.mint;
    ctx.fillRect(s.x + 11, s.y + 20, 8, s.h - 31);
    ctx.fillStyle = COLORS.silver;
    ctx.fillRect(s.x - 5, s.y + 6, s.w + 10, 12);
    ctx.fillStyle = "#d8d3d4";
    ctx.fillRect(s.x + 2, s.y + 7, s.w - 4, 4);
    label("CLEAR", s.x + s.w / 2, s.y + 57);
  }

  function drawDecorationStation(station) {
    ctx.fillStyle = "rgba(46,33,53,0.25)";
    ctx.fillRect(station.x + 5, station.y + 12, station.w, station.h - 2);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(station.x - 4, station.y + 8, station.w + 8, station.h - 5);
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(station.x, station.y + 12, station.w, station.h - 13);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(station.x, station.y + 8, station.w, 10);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(station.x + 25, station.y - 8, station.w - 50, 38);
    ctx.fillStyle = station.id === "sprinkles" ? COLORS.pink : COLORS.white;
    ctx.fillRect(station.x + 31, station.y - 3, station.w - 62, 27);
    if (station.id === "sprinkles") {
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(station.x + 38, station.y + 2, 5, 5);
      ctx.fillStyle = COLORS.aqua;
      ctx.fillRect(station.x + 56, station.y + 12, 5, 5);
      ctx.fillStyle = COLORS.berry;
      ctx.fillRect(station.x + 67, station.y + 4, 5, 5);
    } else {
      ctx.fillStyle = COLORS.pinkLight;
      ctx.fillRect(station.x + 42, station.y + 2, 21, 5);
      ctx.fillRect(station.x + 48, station.y - 4, 10, 7);
    }
    label(state && state.rush < 2 ? "LOCKED" : station.label, station.x + station.w / 2, station.y + 62);
  }

  function drawCustomers() {
    if (!state) return;
    state.customers.forEach((customer, index) => {
      const x = 395 + index * 95;
      const y = 78;
      drawCustomer(x, y, customer, index === 0);
    });
  }

  function drawCustomer(x, y, customer, first) {
    if (first) {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(x - 40, y - 57, 80, 47);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(x - 34, y - 50, 68, 42);
      ctx.fillStyle = "#fff0a8";
      ctx.fillRect(x - 28, y - 46, 56, 5);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(x - 8, y - 9, 16, 8);
      drawTreat(customer.type, x, y - 26, 0.8, customer.decoration);
    }
    ctx.fillStyle = "rgba(46,33,53,0.22)";
    ctx.fillRect(x - 27, y + 35, 58, 8);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x + 20, y + 13, 10, 24);
    ctx.fillRect(x + 28, y + 8, 10, 10);
    ctx.fillStyle = customer.color;
    ctx.fillRect(x + 23, y + 14, 5, 19);
    ctx.fillRect(x + 30, y + 10, 6, 6);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 25, y - 9, 50, 35);
    ctx.fillStyle = customer.color;
    ctx.fillRect(x - 21, y - 12, 42, 33);
    ctx.fillRect(x - 19, y + 18, 38, 20);
    ctx.fillStyle = customer.color;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 10);
    ctx.lineTo(x - 15, y - 28);
    ctx.lineTo(x - 3, y - 11);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 10);
    ctx.lineTo(x + 15, y - 28);
    ctx.lineTo(x + 3, y - 11);
    ctx.fill();
    ctx.fillStyle = COLORS.pinkLight;
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 11);
    ctx.lineTo(x - 14, y - 22);
    ctx.lineTo(x - 7, y - 11);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 11);
    ctx.lineTo(x + 14, y - 22);
    ctx.lineTo(x + 7, y - 11);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x - 17, y - 5, 7, 14);
    ctx.fillStyle = COLORS.ink;
    const blink = customer.blink % 4 > 3.82;
    ctx.fillRect(x - 12, y + 2, 5, blink ? 2 : 6);
    ctx.fillRect(x + 7, y + 2, 5, blink ? 2 : 6);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(x - 8, y + 10, 16, 8);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 2, y + 10, 4, 4);
    ctx.fillRect(x - 5, y + 16, 4, 2);
    ctx.fillRect(x + 1, y + 16, 4, 2);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 12, y + 21, 24, 15);
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(x - 3, y + 21, 6, 15);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x - 2, y + 24, 4, 4);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 29, y + 43, 58, 7);
    const patienceRatio = Math.max(0, customer.patience / customer.maxPatience);
    ctx.fillStyle = patienceRatio > 0.45 ? COLORS.mint : COLORS.berry;
    ctx.fillRect(x - 27, y + 45, 54 * patienceRatio, 3);
  }

  function drawCats() {
    if (!state) return;
    state.cats.forEach((cat, index) => drawCat(cat, index === state.active));
  }

  function drawCat(cat, active) {
    const walking = active && ["arrowleft", "a", "left", "arrowright", "d", "right", "arrowup", "w", "up", "arrowdown", "s", "down"]
      .some((key) => keys.has(key));
    const bob = Math.sin(state.elapsed * 10 + cat.x) * (walking ? 2 : 0.5);
    const step = walking && Math.floor(state.elapsed * 10) % 2 ? 3 : 0;
    const x = Math.round(cat.x);
    const y = Math.round(cat.y + bob);
    ctx.fillStyle = "rgba(46,33,53,0.28)";
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 37, 31, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(x - 29, y + 40, 58, 3);
      ctx.fillStyle = cat.accent;
      ctx.fillRect(x - 20, y + 43, 40, 3);
    }

    // Stepped tail silhouette gives the sprite a classic 16-bit profile.
    const tailX = cat.facing > 0 ? x - 32 : x + 25;
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(tailX, y + 7, 9, 24);
    ctx.fillRect(tailX + (cat.facing > 0 ? -7 : 7), y, 12, 10);
    ctx.fillStyle = cat.color;
    ctx.fillRect(tailX + 2, y + 8, 5, 20);
    ctx.fillRect(tailX + (cat.facing > 0 ? -5 : 9), y + 2, 8, 6);

    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 24, y - 31, 48, 53);
    ctx.fillStyle = cat.color;
    ctx.fillRect(x - 20, y - 30, 40, 48);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x - 16, y - 26, 7, 28);
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 27);
    ctx.lineTo(x - 16, y - 47);
    ctx.lineTo(x - 3, y - 30);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 27);
    ctx.lineTo(x + 16, y - 47);
    ctx.lineTo(x + 3, y - 30);
    ctx.fill();
    ctx.fillStyle = COLORS.pinkLight;
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 31);
    ctx.lineTo(x - 15, y - 41);
    ctx.lineTo(x - 8, y - 31);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 16, y - 31);
    ctx.lineTo(x + 15, y - 41);
    ctx.lineTo(x + 8, y - 31);
    ctx.fill();

    // Apron, collar, paws, and shaded folds.
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 24, y + 3, 48, 35);
    ctx.fillStyle = cat.accent;
    ctx.fillRect(x - 21, y + 5, 42, 31);
    ctx.fillStyle = cat.name === "Poppy" ? COLORS.pinkLight : COLORS.mintLight;
    ctx.fillRect(x - 17, y + 8, 7, 24);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 12, y + 4, 24, 32);
    ctx.fillStyle = "#eaded3";
    ctx.fillRect(x - 12, y + 30, 24, 6);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 4, y + 5, 8, 5);

    // Expressive face and muzzle.
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 12, y - 15, 5, 7);
    ctx.fillRect(x + 7, y - 15, 5, 7);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 11, y - 14, 2, 2);
    ctx.fillRect(x + 8, y - 14, 2, 2);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(x - 9, y - 6, 18, 10);
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(x - 2, y - 5, 4, 4);
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 6, y, 5, 2);
    ctx.fillRect(x + 1, y, 5, 2);
    ctx.fillRect(x - 28, y - 4, 17, 2);
    ctx.fillRect(x + 11, y - 4, 17, 2);
    ctx.fillRect(x - 26, y + 1, 15, 2);
    ctx.fillRect(x + 11, y + 1, 15, 2);
    ctx.fillRect(x - 8, y + 20, 16, 3);

    // Fur markings, blush, and apron embroidery use separate palette ramps.
    if (cat.name === "Poppy") {
      ctx.fillStyle = "#a85d51";
      ctx.fillRect(x - 12, y - 27, 5, 8);
      ctx.fillRect(x - 2, y - 30, 5, 10);
      ctx.fillRect(x + 8, y - 27, 5, 8);
      ctx.fillRect(x - 19, y - 3, 6, 3);
    } else {
      ctx.fillStyle = "#716b86";
      ctx.fillRect(x - 19, y - 28, 11, 8);
      ctx.fillRect(x - 19, y - 20, 6, 8);
      ctx.fillRect(x + 9, y - 27, 8, 5);
      ctx.fillRect(x + 13, y - 4, 6, 3);
    }
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(x - 17, y - 5, 4, 3);
    ctx.fillRect(x + 13, y - 5, 4, 3);
    ctx.fillStyle = cat.accent;
    ctx.fillRect(x - 5, y + 16, 10, 8);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 2, y + 18, 4, 4);

    // Hair accessory differentiates the sisters at sprite scale.
    ctx.fillStyle = cat.accent;
    if (cat.name === "Poppy") {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(x - 31, y - 48, 13, 12);
      ctx.fillRect(x - 17, y - 45, 13, 12);
      ctx.fillRect(x - 21, y - 46, 8, 11);
      ctx.fillStyle = cat.accent;
      ctx.fillRect(x - 28, y - 45, 8, 7);
      ctx.fillRect(x - 15, y - 42, 8, 7);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(x - 19, y - 43, 5, 6);
    } else {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(x + 15, y - 49, 8, 22);
      ctx.fillRect(x + 8, y - 42, 22, 8);
      ctx.fillStyle = cat.accent;
      ctx.fillRect(x + 17, y - 47, 4, 7);
      ctx.fillRect(x + 17, y - 34, 4, 5);
      ctx.fillRect(x + 10, y - 40, 7, 4);
      ctx.fillRect(x + 21, y - 40, 7, 4);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(x + 17, y - 40, 4, 4);
    }
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - 19, y + 33 + step, 14, 8 - step);
    ctx.fillRect(x + 5, y + 33, 14, 8);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 16, y + 33 + step, 8, 3);
    ctx.fillRect(x + 8, y + 33, 8, 3);
    if (active) label(cat.name.toUpperCase(), x, y + 58, cat.accent);
  }

  function drawHud() {
    if (!state) return;
    panel(14, 14, 185, 76);
    pixelText(RUSH_LEVELS[state.rush].label, 28, 36, 11);
    pixelText(`${state.served} / ${state.goal}`, 28, 68, 27);
    for (let index = 0; index < 3; index += 1) {
      drawPixelHeart(110 + index * 21, 54, index < 3 - state.missed);
    }

    panel(761, 14, 185, 76);
    pixelText("CLOSING TIME", 777, 36, 13);
    pixelText(`BEST ${Math.max(state.bestScore, state.score)}`, 923, 36, 10, "right");
    pixelText(formatTime(state.time), 777, 68, 27);
    pixelText(`${state.score} pts`, 923, 67, 13, "right");

    panel(315, 480, 330, 48);
    pixelText("BOWL", 329, 509, 12);
    if (!state.tray.length) pixelText("empty", 388, 509, 12);
    state.tray.forEach((ingredient, index) => {
      drawIngredientIcon(ingredient, 396 + index * 38, 499);
    });
    pixelText("RACK", 515, 509, 12);
    state.rack.forEach((treat, index) => {
      drawTreat(treat.type, 574 + index * 28, 501, 0.65, treat.decoration);
    });
  }

  function drawInteractionHint() {
    if (!state || state.mode !== "playing") return;
    const cat = state.cats[state.active];
    const nearby = stations.find((station) =>
      Math.hypot(cat.x - (station.x + station.w / 2), cat.y - (station.y + station.h / 2)) < 125
    );
    if (!nearby) return;
    const text = nearby.kind === "ingredient"
      ? `TAKE ${nearby.label}`
      : nearby.kind === "decoration"
        ? state.rush < 2 ? "LOCKED" : `ADD ${nearby.label}`
        : nearby.label;
    const x = clamp(cat.x, 90, W - 90);
    const y = nearby.kind === "decoration" ? nearby.y - 18 : cat.y - 82;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - 68, y - 16, 136, 28);
    ctx.fillStyle = COLORS.white;
    pixelText(`E  ${text}`, x, y + 3, 11, "center");
  }

  function drawIngredientIcon(ingredient, x, y) {
    ctx.fillStyle = ingredientColor(ingredient);
    if (ingredient === "berry") {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 8, y - 9, 16, 18);
    }
  }

  function drawPixelHeart(x, y, filled) {
    const rows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
    ctx.fillStyle = filled ? COLORS.pinkDark : "#d8c7c4";
    rows.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === "1") ctx.fillRect(x + columnIndex * 2, y + rowIndex * 2, 2, 2);
      });
    });
  }

  function drawTreat(type, x, y, scale = 1, decoration = null) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (type === "cupcake") {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(-13, -7, 26, 22);
      ctx.fillStyle = "#d9836c";
      ctx.fillRect(-10, 3, 20, 10);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(-6, 3, 4, 10);
      ctx.fillRect(3, 3, 4, 10);
      ctx.fillStyle = COLORS.pinkLight;
      ctx.fillRect(-10, -5, 20, 8);
      ctx.fillRect(-6, -10, 12, 6);
      ctx.fillRect(-2, -13, 5, 4);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(-6, -6, 5, 3);
      ctx.fillStyle = COLORS.berry;
      ctx.fillRect(-2, -15, 4, 4);
    } else if (type === "cookie") {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillRect(-8, -13, 16, 26);
      ctx.fillStyle = "#d99a52";
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillRect(-6, -10, 12, 20);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(-6, -7, 5, 4);
      ctx.fillStyle = COLORS.cocoa;
      ctx.fillRect(3, -5, 4, 4);
      ctx.fillRect(-4, 2, 4, 4);
      ctx.fillRect(4, 5, 3, 3);
    } else {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(-14, -10, 28, 25);
      ctx.fillStyle = "#f3cc89";
      ctx.fillRect(-11, -7, 22, 19);
      ctx.fillStyle = COLORS.berry;
      ctx.fillRect(-11, -2, 22, 5);
      ctx.fillStyle = COLORS.pinkLight;
      ctx.fillRect(-12, -10, 24, 6);
      ctx.fillRect(7, -7, 5, 19);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(-7, -9, 8, 2);
      ctx.fillStyle = COLORS.berry;
      ctx.fillRect(-2, -14, 5, 5);
      ctx.fillStyle = COLORS.mintDark;
      ctx.fillRect(2, -16, 5, 4);
    }
    if (decoration === "sprinkles") {
      ctx.fillStyle = COLORS.aqua;
      ctx.fillRect(-8, -7, 4, 3);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(-1, -10, 4, 3);
      ctx.fillStyle = COLORS.berry;
      ctx.fillRect(6, -5, 4, 3);
    } else if (decoration === "cream") {
      ctx.fillStyle = COLORS.inkDark;
      ctx.fillRect(-7, -15, 14, 7);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(-5, -16, 10, 7);
      ctx.fillRect(-2, -20, 5, 5);
    }
    ctx.restore();
  }

  function drawParticles() {
    if (!state) return;
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = COLORS.pinkLight;
    ctx.fillRect(x + 7, y + 7, w - 14, 4);
    ctx.fillRect(x + 7, y + 11, 4, h - 18);
    ctx.fillStyle = COLORS.pinkDark;
    ctx.fillRect(x + 7, y + h - 11, w - 14, 4);
    ctx.fillRect(x + w - 11, y + 11, 4, h - 18);
    ctx.fillStyle = COLORS.ink;
  }

  function label(text, x, y, color = COLORS.ink) {
    const width = text.length * 9 + 14;
    ctx.fillStyle = COLORS.inkDark;
    ctx.fillRect(x - width / 2 - 3, y - 16, width + 6, 27);
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y - 13, width, 21);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x - width / 2 + 3, y - 10, width - 6, 3);
    ctx.fillStyle = COLORS.white;
    pixelText(text, x, y + 2, 10, "center");
  }

  function pixelText(text, x, y, size = 14, align = "left") {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y);
  }

  function ingredientColor(ingredient) {
    return ingredient === "flour" ? COLORS.white : ingredient === "berry" ? COLORS.berry : COLORS.cocoa;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 75;
      state.particles.push({
        x, y, color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.45,
        maxLife: 0.95,
        size: 4 + Math.floor(Math.random() * 5),
      });
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("toast--show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("toast--show"), 1700);
  }

  function sound(frequency, duration, type) {
    if (!audioEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {
      // Audio is an optional enhancement; gameplay continues if unavailable.
    }
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    if ((key === "e" || key === " ") && !event.repeat) interact();
    else if (key === "q" && !event.repeat) swapCat();
    else if ((key === "p" || key === "escape") && !event.repeat) togglePause();
    else if (key === "m" && !event.repeat) toggleSound();
    else if (key === "r" && !event.repeat && state && state.mode !== "intro") requestRestart();
    keys.add(key);
  });

  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const release = () => keys.delete(control);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (control === "action") interact();
      else if (control === "swap") swapCat();
      else keys.add(control);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  document.getElementById("start-button").addEventListener("click", startGame);
  document.getElementById("restart-button").addEventListener("click", startGame);
  document.getElementById("resume-button").addEventListener("click", togglePause);
  pauseButton.addEventListener("click", togglePause);
  soundButton.addEventListener("click", toggleSound);

  state = createState();
  updateUtilityButtons();
  render();
  requestAnimationFrame(loop);
})();
