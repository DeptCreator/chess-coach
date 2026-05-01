import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialGame } from "@/domain/chess";
import { ArenaApp } from "./ArenaApp";
import { ChessBoard } from "./ChessBoard";
import { PromotionModal } from "./PromotionModal";

describe("Arena UI", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
  });

  it("renders the board from FEN", () => {
    const game = createInitialGame();

    render(
      <ChessBoard
        fen={game.fen}
        selectedSquare={null}
        legalTargets={[]}
        lastMove={null}
        checkSquare={null}
        onSquareClick={() => undefined}
      />,
    );

    expect(screen.getByTestId("square-e2")).toHaveAccessibleName(/white p/i);
    expect(screen.getByTestId("square-e7")).toHaveAccessibleName(/black p/i);
  });

  it("shows legal hints after selecting a piece", async () => {
    render(<ArenaApp />);

    fireEvent.click(screen.getByTestId("square-e2"));

    expect(await screen.findByTestId("hint-e4")).toBeInTheDocument();
  });

  it("updates move list after a legal move", async () => {
    render(<ArenaApp />);

    fireEvent.click(screen.getByTestId("square-e2"));
    fireEvent.click(screen.getByTestId("square-e4"));

    await waitFor(() => expect(screen.getByText("e4")).toBeInTheDocument());
  });

  it("renders promotion choices", () => {
    const choices: string[] = [];

    render(
      <PromotionModal
        open
        onChoose={(piece) => choices.push(piece)}
        onCancel={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /queen/i }));
    expect(choices).toEqual(["q"]);
  });

  it("creates a room link panel", async () => {
    render(<ArenaApp />);

    fireEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(await screen.findByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByText(/waiting for black/i)).toBeInTheDocument();
  });

  it("opens the Upgrade to Pro modal", async () => {
    render(<ArenaApp />);

    fireEvent.click(screen.getByRole("button", { name: /^pro$/i }));

    expect(await screen.findByRole("dialog", { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it("renders and changes AI difficulty", async () => {
    render(<ArenaApp />);
    await screen.findAllByDisplayValue("Guest Player");

    fireEvent.click(screen.getByRole("button", { name: /vs ai/i }));
    const difficulty = await screen.findByLabelText(/ai difficulty/i);
    fireEvent.change(difficulty, { target: { value: "expert" } });

    expect(difficulty).toHaveValue("expert");
  });

  it("saves edited profile details", async () => {
    render(<ArenaApp />);

    const username = (await screen.findAllByLabelText(/username/i)).at(-1)!;
    const city = (await screen.findAllByLabelText(/city/i)).at(-1)!;
    expect(screen.getByText("mock")).toBeInTheDocument();

    fireEvent.change(username, { target: { value: "Mahiru" } });
    fireEvent.change(city, { target: { value: "Jerusalem" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => expect(screen.getAllByText("Mahiru").length).toBeGreaterThan(0));
    expect(screen.getByText(/Jerusalem/i)).toBeInTheDocument();
  });

  it("registers a mock account", async () => {
    render(<ArenaApp />);

    fireEvent.click(screen.getByRole("button", { name: /register/i }));
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getAllByLabelText(/username/i)[0], { target: { value: "Player One" } });
    fireEvent.change(screen.getAllByLabelText(/city/i)[0], { target: { value: "Almaty" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Account created.")).toBeInTheDocument();
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });
});
