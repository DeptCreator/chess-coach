import { expect, test } from "@playwright/test";

async function renderedState(page: import("@playwright/test").Page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? "{}"));
}

async function canvasHasPixels(page: import("@playwright/test").Page) {
  return page.getByTestId("arena-scene-canvas").evaluate((canvas) => {
    const source = canvas as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = source.width;
    probe.height = source.height;
    const context = probe.getContext("2d");

    if (!context || source.width === 0 || source.height === 0) {
      return false;
    }

    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;

    for (let index = 3; index < pixels.length; index += 16) {
      if (pixels[index] > 0) {
        return true;
      }
    }

    return false;
  });
}

test("local move, room link, and pro modal smoke test", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("chess-board")).toBeVisible();
  await expect(page.getByTestId("arena-scene-canvas")).toBeVisible();
  await expect.poll(async () => canvasHasPixels(page), { timeout: 10000 }).toBe(true);
  await page.getByTestId("square-e2").click();
  await expect(page.getByTestId("hint-e4")).toBeVisible();
  await page.getByTestId("square-e4").click();
  await expect(page.getByText("e4")).toBeVisible();

  const state = await renderedState(page);
  expect(state.lastMove.san).toBe("e4");

  await page.getByRole("button", { name: /create room/i }).click();
  await expect(page.getByRole("button", { name: /copy/i })).toBeVisible();

  await page.getByRole("button", { name: /^pro$/i }).click();
  await expect(page.getByRole("dialog", { name: /upgrade to pro/i })).toBeVisible();
});

test("responsive arena layout keeps the board playable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByTestId("chess-board")).toBeVisible();
  await expect(page.getByTestId("arena-scene-canvas")).toBeVisible();
  await page.getByTestId("square-e2").click();
  await expect(page.getByTestId("hint-e4")).toBeVisible();

  const boardBox = await page.getByTestId("chess-board").boundingBox();
  const headerBox = await page.getByText("Active game workspace").boundingBox();

  expect(boardBox?.width).toBeGreaterThan(300);
  expect(boardBox?.height).toBeGreaterThan(300);
  expect(headerBox && boardBox ? headerBox.y + headerBox.height < boardBox.y : true).toBe(true);
});

test("reduced motion still renders a nonblank 3D canvas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByTestId("arena-scene-canvas")).toBeVisible();
  await expect.poll(async () => canvasHasPixels(page), { timeout: 10000 }).toBe(true);
  await expect(page.getByTestId("chess-board")).toBeVisible();
});

test("AI mode replies with a legal black move", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /vs ai/i }).click();
  await page.getByLabel(/ai difficulty/i).selectOption("beginner");

  await page.getByTestId("square-e2").click();
  await expect(page.getByTestId("hint-e4")).toBeVisible();
  await page.getByTestId("square-e4").click();

  await expect.poll(async () => (await renderedState(page)).turn, { timeout: 15000 }).toBe("white");
  const state = await renderedState(page);
  expect(state.lastMove.color).toBe("black");
  expect(state.pgn).toContain("e4");
});

test("mode change resets the current game and board can flip", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("square-e2").click();
  await page.getByTestId("square-e4").click();
  await expect(page.getByText("e4")).toBeVisible();

  await page.getByRole("button", { name: /flip board/i }).click();
  await expect.poll(async () => (await renderedState(page)).boardOrientation).toBe("black");

  await page.getByRole("button", { name: /vs ai/i }).click();
  const state = await renderedState(page);
  expect(state.pgn).not.toContain("e4");
  expect(state.turn).toBe("white");
  expect(state.boardOrientation).toBe("white");
});

test("friend room supports side and time setup", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /^black$/i }).click();
  await page.getByLabel(/time control/i).selectOption("bullet");
  await page.getByRole("button", { name: /create room/i }).click();

  await expect(page.getByRole("button", { name: /copy/i })).toBeVisible();
  await expect(page.getByText("Bullet 1+0")).toBeVisible();
  await expect(page.getByText("Your side").locator("..").getByText("Black")).toBeVisible();
  await expect.poll(async () => (await renderedState(page)).playerColor).toBe("black");
  await expect.poll(async () => (await renderedState(page)).boardOrientation).toBe("black");
  await expect(page.getByText("1:00").first()).toBeVisible();
});

test("resign shows a clear resignation notice", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /resign/i }).click();

  await expect(page.getByRole("status")).toContainText("White resigned.");
  expect((await renderedState(page)).status).toBe("resigned");
});

test("registration and drag move work in demo mode", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/^email$/i).fill("demo@example.com");
  await page.getByLabel(/^password$/i).fill("secret123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText("Account created.")).toBeVisible();
  await expect(page.getByText("demo@example.com")).toBeVisible();

  await page.dragAndDrop('[data-testid="square-e2"]', '[data-testid="square-e4"]');
  await expect(page.getByText("e4")).toBeVisible();
  expect((await renderedState(page)).lastMove.san).toBe("e4");
});

test("profile edit persists after reload in mock mode", async ({ page }) => {
  await page.goto("/");

  const profilePanel = page.locator("section").filter({ hasText: "Profile" });
  await profilePanel.getByLabel(/username/i).fill("Mahiru");
  await profilePanel.getByLabel(/city/i).fill("Jerusalem");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Mahiru").first()).toBeVisible();
  await expect(page.getByText(/Jerusalem/).first()).toBeVisible();
});

test("coach report appears after a completed local game", async ({ page }) => {
  await page.goto("/");

  for (const [from, to] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ]) {
    await page.getByTestId(`square-${from}`).click();
    await page.getByTestId(`square-${to}`).click();
  }

  await expect.poll(async () => (await renderedState(page)).status, { timeout: 10000 }).toBe("checkmate");
  await expect(page.getByText(/Move 1:/).first()).toBeVisible({ timeout: 15000 });
});

test("friend room create, join, move sync, and reconnect", async ({ browser }) => {
  const whiteContext = await browser.newContext();
  const blackContext = await browser.newContext();
  const white = await whiteContext.newPage();
  const black = await blackContext.newPage();
  const websocketUrls: string[] = [];
  white.on("websocket", (socket) => websocketUrls.push(socket.url()));
  black.on("websocket", (socket) => websocketUrls.push(socket.url()));

  await white.goto("/");
  await white.getByRole("button", { name: /create room/i }).click();
  await expect(white.getByRole("button", { name: /copy/i })).toBeVisible({ timeout: 15000 });

  const roomUrl = white.url();
  expect(roomUrl).toContain("room=");

  await black.goto(roomUrl);

  await expect.poll(async () => (await renderedState(black)).room?.status).toBe("active");
  await expect.poll(async () => (await renderedState(white)).room?.status).toBe("active");
  expect(websocketUrls.some((url) => url.endsWith("/ws/rooms"))).toBe(true);

  const whiteState = await renderedState(white);
  const blackState = await renderedState(black);
  expect(whiteState.playerColor).toBe("white");
  expect(blackState.playerColor).toBe("black");

  await white.getByTestId("square-e2").click();
  await expect(white.getByTestId("hint-e4")).toBeVisible();
  await white.getByTestId("square-e4").click();

  await expect.poll(async () => (await renderedState(black)).lastMove?.san).toBe("e4");
  await expect.poll(async () => (await renderedState(white)).turn).toBe("black");

  const pgnAfterWhiteMove = (await renderedState(white)).pgn;
  await white.getByTestId("square-d2").click();
  await white.getByTestId("square-d4").click();
  expect((await renderedState(white)).pgn).toBe(pgnAfterWhiteMove);

  await black.getByTestId("square-e7").click();
  await expect(black.getByTestId("hint-e5")).toBeVisible();
  await black.getByTestId("square-e5").click();

  await expect.poll(async () => (await renderedState(white)).lastMove?.san).toBe("e5");
  await expect.poll(async () => (await renderedState(black)).lastMove?.san).toBe("e5");
  const fenBeforeReload = (await renderedState(black)).fen;
  const pgnBeforeReload = (await renderedState(black)).pgn;

  await black.reload();

  await expect.poll(async () => (await renderedState(black)).fen).toBe(fenBeforeReload);
  expect((await renderedState(black)).pgn).toBe(pgnBeforeReload);
  expect((await renderedState(black)).turn).toBe("white");

  await whiteContext.close();
  await blackContext.close();
});
