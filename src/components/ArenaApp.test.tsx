import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialGame } from "@/domain/chess";
import type { AuthSession, CoachInsight, LeaderboardEntry, RoomState, UserProfile } from "@/domain/types";
import type { AppServices } from "@/services/contracts";
import { ArenaApp } from "./ArenaApp";
import { ChessBoard } from "./ChessBoard";
import { PromotionModal } from "./PromotionModal";

const accountSession: AuthSession = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "player@example.com",
};
const accountProfile: UserProfile = {
  id: accountSession.userId,
  email: accountSession.email,
  username: "Player One",
  city: "Jerusalem",
  rating: 1200,
  avatarUrl: null,
  isPro: false,
};
let currentSession: AuthSession | null = null;
let currentProfile: UserProfile = accountProfile;
let leaderboardEntries: LeaderboardEntry[] = [];
let listLeaderboardCalls: Array<string | undefined> = [];
let coachInsights: CoachInsight[] = [];

vi.mock("@/services", () => ({
  getAppServices: () => createTestServices(),
}));

describe("Arena UI", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
    currentSession = null;
    currentProfile = accountProfile;
    listLeaderboardCalls = [];
    leaderboardEntries = [];
    coachInsights = [
      {
        moveNumber: 1,
        moveSan: "f3",
        classification: "mistake",
        explanation: "f3 weakens the king. e2e4 keeps more central control.",
        bestMove: "e2e4",
        evalBefore: 40,
        evalAfter: -120,
        practiceFen: createInitialGame().fen,
      },
    ];
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

  it("requires an account for room links as a guest", async () => {
    render(<ArenaApp />);

    expect(await screen.findByText(/sign in to create or join friend room links/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /friend link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create room/i })).not.toBeInTheDocument();
  });

  it("creates a room link panel for signed-in accounts", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    fireEvent.click(await screen.findByRole("button", { name: /create room/i }));

    expect(await screen.findByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByText(/waiting for black/i)).toBeInTheDocument();
  });

  it("does not render the Friends header tab for guests", async () => {
    render(<ArenaApp />);

    await screen.findByText(/sign in to save profile/i);

    expect(screen.queryByRole("button", { name: /friends/i })).not.toBeInTheDocument();
  });

  it("does not render the Pro header button for guests", async () => {
    render(<ArenaApp />);

    await screen.findByText(/sign in to save profile/i);

    expect(screen.queryByRole("button", { name: /^pro$/i })).not.toBeInTheDocument();
  });

  it("shows Friends for signed-in accounts", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    expect(await screen.findByRole("button", { name: /friends/i })).toBeInTheDocument();
  });

  it("shows Pro for signed-in accounts", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    expect(await screen.findByRole("button", { name: /^pro$/i })).toBeInTheDocument();
  });

  it("opens the Pro modal for signed-in accounts", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    fireEvent.click(await screen.findByRole("button", { name: /^pro$/i }));
    expect(await screen.findByRole("dialog", { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it("returns to Play when a user signs out from the Friends view", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    fireEvent.click(await screen.findByRole("button", { name: /friends/i }));
    expect(await screen.findByRole("heading", { name: /^friends$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /friends/i })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByTestId("chess-board")).toBeInTheDocument();
  });

  it("renders and changes AI difficulty", async () => {
    render(<ArenaApp />);
    await screen.findByText(/sign in to save profile/i);

    fireEvent.click(screen.getByRole("button", { name: /vs ai/i }));
    const difficulty = await screen.findByLabelText(/ai difficulty/i);
    fireEvent.change(difficulty, { target: { value: "expert" } });

    expect(difficulty).toHaveValue("expert");
  });

  it("shows account-required profile controls to guests", async () => {
    render(<ArenaApp />);

    expect(await screen.findByText(/sign in to save profile/i)).toBeInTheDocument();
  });

  it("saves edited profile details for signed-in accounts", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    const username = (await screen.findAllByLabelText(/username/i)).at(-1)!;
    const city = (await screen.findAllByLabelText(/city/i)).at(-1)!;

    fireEvent.change(username, { target: { value: "Mahiru" } });
    fireEvent.change(city, { target: { value: "Jerusalem" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => expect(screen.getAllByText("Mahiru").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Jerusalem/i).length).toBeGreaterThan(0);
  });

  it("renders structured AI Coach cards with practice actions", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    for (const [from, to] of [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]) {
      fireEvent.click(await screen.findByTestId(`square-${from}`));
      fireEvent.click(screen.getByTestId(`square-${to}`));
    }

    expect((await screen.findAllByText("Mistake")).length).toBeGreaterThan(0);
    expect(screen.getByText("Better move")).toBeInTheDocument();
    expect(screen.getByText("Why")).toBeInTheDocument();
    expect(screen.getByText("+0.4 -> -1.2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice this position/i })).toBeInTheDocument();
  });

  it("starts practice from a mistake and exits with New", async () => {
    currentSession = accountSession;
    render(<ArenaApp />);

    for (const [from, to] of [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]) {
      fireEvent.click(await screen.findByTestId(`square-${from}`));
      fireEvent.click(screen.getByTestId(`square-${to}`));
    }

    fireEvent.click(await screen.findByRole("button", { name: /practice this position/i }));
    expect(await screen.findByText(/practice mode: find the better move/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show engine hint/i })).toBeDisabled();

    fireEvent.click(screen.getByTestId("square-e2"));
    fireEvent.click(screen.getByTestId("square-e4"));

    await waitFor(() => expect(screen.getByRole("button", { name: /show engine hint/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /show engine hint/i }));
    expect(screen.getAllByText("e2e4").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    await waitFor(() => {
      const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
      expect(state.practice).toBeNull();
    });
  });

  it("filters leaderboard by city and shows the current city rank", async () => {
    currentSession = accountSession;
    leaderboardEntries = [
      { userId: "other", username: "Other", city: "Jerusalem", rating: 1300, wins: 2, losses: 0, rank: 1 },
      { userId: accountSession.userId, username: "Player One", city: "Jerusalem", rating: 1200, wins: 1, losses: 1, rank: 2 },
    ];

    render(<ArenaApp />);

    fireEvent.click(await screen.findByRole("button", { name: /^jerusalem$/i }));

    await waitFor(() => expect(listLeaderboardCalls).toContain("Jerusalem"));
    expect(await screen.findByText("#2 in Jerusalem")).toBeInTheDocument();
    expect(screen.getAllByText("Jerusalem").length).toBeGreaterThan(0);
  });

  it("shows an empty city leaderboard state without crashing", async () => {
    currentSession = accountSession;
    leaderboardEntries = [];

    render(<ArenaApp />);

    fireEvent.click(await screen.findByRole("button", { name: /^jerusalem$/i }));

    expect(await screen.findByText(/no ranked players in jerusalem yet/i)).toBeInTheDocument();
  });

});

function createTestServices(): AppServices {
  return {
    auth: {
      getSession: async () => ({ data: currentSession, error: null }),
      signUp: async ({ email }) => {
        currentSession = { userId: accountSession.userId, email };
        return { data: currentSession, error: null };
      },
      signIn: async ({ email }) => {
        currentSession = { userId: accountSession.userId, email };
        return { data: currentSession, error: null };
      },
      signOut: async () => {
        currentSession = null;
        return { data: null, error: null };
      },
    },
    identity: {
      getPlayerId: async () =>
        currentSession
          ? { data: currentSession.userId, error: null }
          : { data: null, error: "Sign in required." },
    },
    profiles: {
      getCurrentProfile: async () =>
        currentSession
          ? { data: currentProfile, error: null }
          : { data: null, error: "Sign in required." },
      updateProfile: async (input) => {
        currentProfile = { ...currentProfile, ...input };
        return { data: currentProfile, error: null };
      },
      listLeaderboard: async (city?: string) => {
        listLeaderboardCalls.push(city);
        return {
          data: city ? leaderboardEntries.filter((entry) => entry.city.toLowerCase() === city.toLowerCase()) : leaderboardEntries,
          error: null,
        };
      },
    },
    friends: {
      searchProfiles: async () => ({ data: [], error: null }),
      listFriendships: async () => ({ data: [], error: null }),
      sendRequest: async () => ({ data: null, error: "Not implemented in this test." }),
      acceptRequest: async () => ({ data: null, error: "Not implemented in this test." }),
      declineOrRemove: async () => ({ data: null, error: null }),
    },
    rooms: {
      createRoom: async (playerId) =>
        playerId ? { data: createRoom(playerId), error: null } : { data: null, error: "Sign in required." },
      joinRoom: async () => ({ data: null, error: "Not implemented in this test." }),
      loadRoom: async () => ({ data: null, error: "Not implemented in this test." }),
      submitMove: async () => ({ data: null, error: "Not implemented in this test." }),
      resign: async () => ({ data: null, error: "Not implemented in this test." }),
      subscribeToRoom: () => () => undefined,
    },
    ai: {
      chooseMove: async () => ({ move: null, source: "fallback", message: "No move." }),
    },
    games: {
      saveCompletedGame: async (input) => ({
        data: {
          id: "game-1",
          whiteId: input.whiteId,
          blackId: input.blackId,
          pgn: input.pgn,
          finalFen: input.finalFen,
          result: input.result,
          durationSeconds: input.durationSeconds,
          createdAt: new Date().toISOString(),
        },
        error: null,
      }),
      listHistory: async () => ({ data: [], error: null }),
      loadReplay: async () => ({ data: null, error: "Not implemented in this test." }),
    },
    coach: {
      generateInsights: async () => ({ data: coachInsights, error: null }),
      loadInsights: async () => ({ data: [], error: null }),
    },
  };
}

function createRoom(playerId: string): RoomState {
  return {
    id: "room-test",
    whitePlayerId: playerId,
    blackPlayerId: null,
    hostColor: "white",
    timeControl: "rapid",
    fen: createInitialGame().fen,
    pgn: "",
    status: "waiting",
    turn: "white",
    clocks: {
      whiteSeconds: 600,
      blackSeconds: 600,
      incrementSeconds: 0,
      lastTickAt: null,
    },
  };
}
