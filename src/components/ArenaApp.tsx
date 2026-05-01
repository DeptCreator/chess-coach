"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Square } from "chess.js";
import {
  Activity,
  Bot,
  ChartNoAxesColumn,
  Crown,
  Flag,
  Flame,
  History,
  Moon,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Repeat2,
} from "lucide-react";
import {
  applyMove,
  createChessFromState,
  createInitialGame,
  getCheckSquare,
  getCapturedPieces,
  getLegalMovesForSquare,
  getPieceAt,
  isPromotionMove,
  resultFromState,
  snapshotFromChess,
  type ChessGameState,
  type MoveInput,
  type PromotionPiece,
} from "@/domain/chess";
import type { ChessColor, CoachInsight, GameMode, GameRecord, LeaderboardEntry, RoomColorChoice, RoomState, TimeControl, UserProfile } from "@/domain/types";
import { getAppServices, type AiDifficulty, type AppServices } from "@/services";
import { ChessBoard } from "./ChessBoard";
import { ArenaScene } from "./ArenaScene";
import { MoveList } from "./MoveList";
import { PromotionModal } from "./PromotionModal";
import { RoomLinkPanel } from "./RoomLinkPanel";
import { UpgradeModal } from "./UpgradeModal";

type PendingPromotion = { from: Square; to: Square } | null;

const modes: Array<{ mode: GameMode; label: string; icon: typeof Users }> = [
  { mode: "local", label: "Local", icon: Users },
  { mode: "friend", label: "Friend Link", icon: Users },
  { mode: "ai", label: "vs AI", icon: Bot },
];

const aiDifficulties: Array<{ value: AiDifficulty; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitive" },
  { value: "expert", label: "Expert" },
];

const timeControls: Array<{ value: TimeControl; label: string; seconds: number }> = [
  { value: "bullet", label: "Bullet 1+0", seconds: 60 },
  { value: "blitz", label: "Blitz 5+0", seconds: 300 },
  { value: "rapid", label: "Rapid 10+0", seconds: 600 },
];

export function ArenaApp() {
  const [services] = useState<AppServices>(() => getAppServices());
  const [mode, setMode] = useState<GameMode>("local");
  const [game, setGame] = useState<ChessGameState>(() => createInitialGame());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ username: "Guest Player", city: "Local", isPro: false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [savedRoomGameId, setSavedRoomGameId] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("casual");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<ChessColor>("white");
  const [roomColorChoice, setRoomColorChoice] = useState<RoomColorChoice>("white");
  const [roomTimeControl, setRoomTimeControl] = useState<TimeControl>("rapid");
  const [resignationNotice, setResignationNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Choose a mode and make the first move.");
  const aiReplyInFlight = useRef(false);
  const profileDraftDirty = useRef(false);

  const activeGame = useMemo(() => (mode === "friend" && room ? gameFromRoom(room) : game), [game, mode, room]);
  const roomId = room?.id ?? null;
  const playerColor = useMemo(() => colorForPlayer(room, playerId), [playerId, room]);
  const canMoveInFriendMode =
    mode !== "friend" || (room?.status === "active" && playerColor !== null && room.turn === playerColor);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) {
      return [];
    }

    return getLegalMovesForSquare(activeGame, selectedSquare).map((move) => move.to);
  }, [activeGame, selectedSquare]);

  const checkSquare = useMemo(() => getCheckSquare(activeGame.fen), [activeGame.fen]);
  const captured = useMemo(() => getCapturedPieces(activeGame.moves), [activeGame.moves]);
  const whiteClockSeconds = mode === "friend" && room ? room.clocks.whiteSeconds : timeControlSeconds(roomTimeControl);
  const blackClockSeconds = mode === "friend" && room ? room.clocks.blackSeconds : timeControlSeconds(roomTimeControl);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (mode === "friend" && playerColor) {
      setBoardOrientation(playerColor);
    }
  }, [mode, playerColor]);

  useEffect(() => {
    if (activeGame.status === "resigned") {
      const resignedBy = mode === "friend" ? room?.resignedBy : activeGame.turn;
      const label = resignedBy ? capitalizeColor(resignedBy) : "A player";
      const message = `${label} resigned.`;
      setResignationNotice(message);
      setStatusMessage(message);
    }
  }, [activeGame.status, activeGame.turn, mode, room?.resignedBy]);

  useEffect(() => {
    if (!window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReducedMotion(media.matches);

    syncMotionPreference();
    media.addEventListener("change", syncMotionPreference);

    return () => media.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [profileResult, leaderboardResult, historyResult] = await Promise.all([
        services.profiles.getCurrentProfile(),
        services.profiles.listLeaderboard(),
        services.games.listHistory(null),
      ]);

      if (!mounted) {
        return;
      }

      if (profileResult.data) {
        setProfile(profileResult.data);
        if (!profileDraftDirty.current) {
          setProfileDraft({
            username: profileResult.data.username,
            city: profileResult.data.city,
            isPro: profileResult.data.isPro,
          });
        }
      }
      if (leaderboardResult.data) {
        setLeaderboard(leaderboardResult.data);
      }
      if (historyResult.data) {
        setHistory(historyResult.data);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [services]);

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      const result = await services.identity.getPlayerId();

      if (mounted && result.data) {
        setPlayerId(result.data);
      }
    }

    loadIdentity();

    return () => {
      mounted = false;
    };
  }, [services]);

  useEffect(() => {
    if (!playerId || room) {
      return;
    }

    const requestedRoomId = new URLSearchParams(window.location.search).get("room");

    if (!requestedRoomId) {
      return;
    }

    const joinRoomId = requestedRoomId;
    let cancelled = false;

    async function joinRoomFromUrl() {
      setMode("friend");
      setStatusMessage("Joining room link.");
      const result = await services.rooms.joinRoom(joinRoomId, playerId);

      if (cancelled) {
        return;
      }

      if (result.data) {
        setRoom(result.data);
        setSelectedSquare(null);
        setPendingPromotion(null);
        setStatusMessage(statusMessageForRoom(result.data, playerId));
      } else {
        setStatusMessage(result.error ?? "Could not join room.");
      }
    }

    joinRoomFromUrl();

    return () => {
      cancelled = true;
    };
  }, [playerId, room, services]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    return services.rooms.subscribeToRoom(roomId, (nextRoom) => {
      setRoom(nextRoom);
      setSelectedSquare(null);
      setStatusMessage(statusMessageForRoom(nextRoom, playerId));
    });
  }, [playerId, roomId, services]);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        mode,
        status: activeGame.status,
        turn: activeGame.turn,
        selectedSquare,
        legalTargets,
        lastMove: activeGame.lastMove,
        fen: activeGame.fen,
        pgn: activeGame.pgn,
        playerId,
        playerColor,
        room: room
          ? {
              id: room.id,
              status: room.status,
              turn: room.turn,
              whitePlayerId: room.whitePlayerId,
              blackPlayerId: room.blackPlayerId,
            }
          : null,
        aiThinking,
        aiDifficulty,
        boardOrientation,
        serviceSource: services.source,
        coordinateSystem: "Squares use algebraic notation; white is at ranks 1-2 and moves toward rank 8.",
      });
    window.advanceTime = () => undefined;
  }, [activeGame, aiDifficulty, aiThinking, boardOrientation, legalTargets, mode, playerColor, playerId, room, selectedSquare, services.source]);

  const persistCompletedGame = useCallback(
    async (finalState: ChessGameState, participants?: { whiteId: string | null; blackId: string | null }) => {
      const saved = await services.games.saveCompletedGame({
        whiteId: participants?.whiteId ?? profile?.id ?? null,
        blackId: participants?.blackId ?? (mode === "ai" ? "mock-ai" : null),
        mode,
        pgn: finalState.pgn,
        finalFen: finalState.fen,
        result: resultFromState(finalState),
        durationSeconds: Math.max(1, finalState.moves.length * 18),
      });

      if (saved.data) {
        setHistory((current) => [saved.data!, ...current].slice(0, 8));
        const coach = await services.coach.generateInsights(saved.data);
        setInsights(coach.data ?? []);
      }
    },
    [mode, profile?.id, services],
  );

  useEffect(() => {
    if (!room || mode !== "friend" || savedRoomGameId === room.id || room.status === "active" || room.status === "waiting") {
      return;
    }

    setSavedRoomGameId(room.id);
    persistCompletedGame(gameFromRoom(room), {
      whiteId: room.whitePlayerId,
      blackId: room.blackPlayerId,
    });
  }, [mode, persistCompletedGame, room, savedRoomGameId]);

  const commitMove = useCallback(
    (move: MoveInput, message: string) => {
      const result = applyMove(game, move);

      if (!result.ok) {
        setStatusMessage(result.error ?? "Illegal move.");
        return;
      }

      setGame(result.state);
      setSelectedSquare(null);
      setStatusMessage(result.state.status === "active" ? message : `Game ended: ${result.state.status}.`);

      if (result.state.status !== "active") {
        persistCompletedGame(result.state);
      }
    },
    [game, persistCompletedGame],
  );

  useEffect(() => {
    if (mode !== "ai" || game.turn !== "black" || game.status !== "active" || aiReplyInFlight.current) {
      return;
    }

    let cancelled = false;

    async function replyWithAi() {
      aiReplyInFlight.current = true;
      setAiThinking(true);
      setStatusMessage("AI is thinking.");
      const result = await services.ai.chooseMove(game, aiDifficulty);

      if (cancelled) {
        aiReplyInFlight.current = false;
        return;
      }

      if (result.move) {
        commitMove(result.move, result.message);
      } else {
        setStatusMessage(result.message);
      }

      aiReplyInFlight.current = false;
      setAiThinking(false);
    }

    const timer = window.setTimeout(replyWithAi, 180);

    return () => {
      cancelled = true;
      aiReplyInFlight.current = false;
      window.clearTimeout(timer);
    };
  }, [aiDifficulty, commitMove, game, mode, services.ai]);

  function handleModeChange(nextMode: GameMode) {
    setMode(nextMode);
    setGame(createInitialGame());
    setSelectedSquare(null);
    setPendingPromotion(null);
    setInsights([]);
    setAiThinking(false);
    setResignationNotice(null);
    setSavedRoomGameId(null);
    aiReplyInFlight.current = false;
    if (nextMode !== "friend") {
      setRoom(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (nextMode !== "friend") {
      setBoardOrientation("white");
    } else {
      setBoardOrientation(playerColor ?? (roomColorChoice === "black" ? "black" : "white"));
    }
    setStatusMessage(nextMode === "friend" ? "Create or open a room link from the panel." : "Mode ready.");
  }

  function handleSquareClick(square: Square) {
    if (activeGame.status !== "active" || pendingPromotion || aiThinking || !canMoveInFriendMode) {
      return;
    }

    if (mode === "ai" && activeGame.turn === "black") {
      return;
    }

    const piece = getPieceAt(activeGame.fen, square);

    if (!selectedSquare) {
      if (piece?.color === activeGame.turn && (mode !== "friend" || piece.color === playerColor)) {
        setSelectedSquare(square);
      }
      return;
    }

    if (legalTargets.includes(square)) {
      if (isPromotionMove(activeGame, selectedSquare, square)) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      commitSelectedMove({ from: selectedSquare, to: square });
      return;
    }

    if (piece?.color === activeGame.turn && (mode !== "friend" || piece.color === playerColor)) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  async function commitSelectedMove(move: MoveInput) {
    if (mode !== "friend") {
      commitMove(move, "Move accepted.");
      return;
    }

    if (!room || !playerId) {
      setStatusMessage("Room is not ready.");
      return;
    }

    const result = await services.rooms.submitMove(room.id, playerId, move as MoveInput & { from: Square; to: Square });

    if (result.data) {
      setRoom(result.data);
      setSavedRoomGameId(null);
      setSelectedSquare(null);
      setStatusMessage(result.data.status === "active" ? "Move synced." : `Game ended: ${result.data.status}.`);
    } else {
      setStatusMessage(result.error ?? "Move rejected.");
    }
  }

  function choosePromotion(piece: PromotionPiece) {
    if (!pendingPromotion) {
      return;
    }

    commitSelectedMove({ ...pendingPromotion, promotion: piece });
    setPendingPromotion(null);
  }

  async function createRoom() {
    setCreatingRoom(true);
    const identity = playerId ? { data: playerId, error: null } : await services.identity.getPlayerId();

    if (identity.data && !playerId) {
      setPlayerId(identity.data);
    }

    const result = await services.rooms.createRoom(identity.data ?? null, {
      colorChoice: roomColorChoice,
      timeControl: roomTimeControl,
    });
    setCreatingRoom(false);

    if (result.data) {
      setRoom(result.data);
      setMode("friend");
      setSelectedSquare(null);
      setPendingPromotion(null);
      setResignationNotice(null);
      setBoardOrientation(colorForPlayer(result.data, identity.data ?? null) ?? result.data.hostColor);
      setStatusMessage("Room link ready.");
      const url = new URL(window.location.href);
      url.searchParams.set("room", result.data.id);
      window.history.replaceState(null, "", url.toString());
    } else {
      setStatusMessage(result.error ?? "Could not create room.");
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    const result = await services.profiles.updateProfile({
      username: profileDraft.username.trim() || "Guest Player",
      city: profileDraft.city.trim() || "Local",
      isPro: profileDraft.isPro,
    });
    setSavingProfile(false);

    if (result.data) {
      profileDraftDirty.current = false;
      setProfile(result.data);
      setProfileDraft({
        username: result.data.username,
        city: result.data.city,
        isPro: result.data.isPro,
      });
      setStatusMessage("Profile saved.");
      const leaderboardResult = await services.profiles.listLeaderboard();
      if (leaderboardResult.data) {
        setLeaderboard(leaderboardResult.data);
      }
    } else {
      setStatusMessage(result.error ?? "Could not save profile.");
    }
  }

  function resetGame() {
    setGame(createInitialGame());
    setSelectedSquare(null);
    setPendingPromotion(null);
    setInsights([]);
    setAiThinking(false);

    if (mode === "friend") {
      setRoom(null);
      setSavedRoomGameId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    setStatusMessage("New game ready.");
  }

  return (
    <main className="min-h-svh overflow-x-hidden px-3 py-3 sm:px-5 lg:px-7">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <header className="arena-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arena-teal">Chess AI Coach Arena</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Active game workspace</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[8px] border border-white/10 bg-black/[0.18] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {services.source}
            </span>
            <button
              type="button"
              className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white/[0.035] px-3 text-sm text-[var(--muted)] transition hover:border-arena-teal/50 hover:text-[var(--text)]"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
              {theme}
            </button>
            <button
              type="button"
              className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-arena-gold px-3 text-sm font-bold text-graphite-950 shadow-[0_12px_34px_rgba(214,179,90,0.22)] transition hover:brightness-105"
              onClick={() => setUpgradeOpen(true)}
            >
              <Crown size={16} aria-hidden />
              Pro
            </button>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
          <aside className="order-2 space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <Activity size={16} className="text-arena-teal" aria-hidden />
                Play modes
              </div>
              <div className="grid gap-2">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.mode;

                  return (
                    <button
                      key={item.mode}
                      type="button"
                      className={[
                        "arena-focus group flex min-h-12 items-center justify-between gap-3 rounded-[8px] px-3 text-left text-sm font-semibold transition",
                        active
                          ? "bg-arena-teal text-graphite-950 shadow-[0_14px_38px_rgba(39,199,163,0.22)]"
                          : "bg-white/[0.04] text-[var(--muted)] hover:bg-white/[0.075] hover:text-[var(--text)]",
                      ].join(" ")}
                      onClick={() => handleModeChange(item.mode)}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={17} aria-hidden />
                        {item.label}
                      </span>
                      <span className={active ? "h-2 w-2 rounded-full bg-graphite-950" : "h-2 w-2 rounded-full bg-white/20 group-hover:bg-arena-teal"} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Profile</div>
                <div className="rounded-[8px] bg-arena-teal/[0.12] px-2 py-1 text-[11px] font-semibold text-arena-teal">
                  {profile?.rating ?? 1200}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-[8px] border border-arena-teal/30 bg-arena-teal/[0.12] text-lg font-bold text-arena-teal shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  {profile?.username.slice(0, 1) ?? "G"}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{profile?.username ?? "Guest Player"}</div>
                  <div className="text-sm text-[var(--muted)]">{profile?.city ?? "Local"} · {profileDraft.isPro ? "Pro" : "Free"}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Username
                  <input
                    className="arena-input"
                    value={profileDraft.username}
                    onChange={(event) => {
                      profileDraftDirty.current = true;
                      setProfileDraft((current) => ({ ...current, username: event.target.value }));
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  City
                  <input
                    className="arena-input"
                    value={profileDraft.city}
                    onChange={(event) => {
                      profileDraftDirty.current = true;
                      setProfileDraft((current) => ({ ...current, city: event.target.value }));
                    }}
                  />
                </label>
                <label className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 text-sm">
                  <span>Pro preview</span>
                  <input
                    type="checkbox"
                    checked={profileDraft.isPro}
                    onChange={(event) => {
                      profileDraftDirty.current = true;
                      setProfileDraft((current) => ({ ...current, isPro: event.target.checked }));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-arena-teal px-3 text-sm font-semibold text-graphite-950 transition hover:brightness-105"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  <Save size={15} aria-hidden />
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </section>

            <RoomLinkPanel
              room={room}
              creating={creatingRoom}
              onCreate={createRoom}
              playerColor={playerColor}
              colorChoice={roomColorChoice}
              timeControl={roomTimeControl}
              onColorChoiceChange={(value) => {
                setRoomColorChoice(value);
                setBoardOrientation(value === "black" ? "black" : "white");
              }}
              onTimeControlChange={setRoomTimeControl}
            />

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <Flame size={16} className="text-arena-amber" aria-hidden />
                Daily focus
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Streak</span>
                  <span className="font-mono text-arena-gold">3 days</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full w-2/3 rounded-full bg-arena-teal" />
                </div>
                <p className="text-sm text-[var(--muted)]">Win one clean endgame or finish a coach report to keep progress moving.</p>
              </div>
            </section>
          </aside>

          <section className="relative order-1 min-w-0 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-3 shadow-[0_28px_100px_rgba(0,0,0,0.28)] sm:p-4 xl:order-none">
            <ArenaScene
              status={activeGame.status}
              turn={activeGame.turn}
              lastMove={activeGame.lastMove}
              aiThinking={aiThinking}
              reducedMotion={reducedMotion}
            />

            <div className="relative z-10 flex min-w-0 flex-col items-center gap-3">
              <div className="arena-clock-row">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Black</div>
                  <div className="truncate font-semibold">
                    {mode === "ai" ? "Arena AI" : mode === "friend" ? (room?.blackPlayerId ? "Black connected" : "Opponent pending") : "Player Two"}
                  </div>
                </div>
                <div className="rounded-[8px] bg-black/25 px-3 py-2 font-mono text-xl font-semibold">{formatClock(blackClockSeconds)}</div>
              </div>

              {resignationNotice ? (
                <div className="w-full max-w-[720px] rounded-[8px] border border-arena-coral/35 bg-arena-coral/[0.1] px-4 py-3 text-sm font-semibold text-arena-coral" role="status">
                  {resignationNotice}
                </div>
              ) : null}

              <ChessBoard
                fen={activeGame.fen}
                selectedSquare={selectedSquare}
                legalTargets={legalTargets}
                lastMove={activeGame.lastMove}
                checkSquare={checkSquare}
                orientation={boardOrientation}
                onSquareClick={handleSquareClick}
              />

              <div className="arena-clock-row">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">White</div>
                  <div className="truncate font-semibold">
                    {mode === "friend" ? (room?.whitePlayerId ? "White connected" : "Waiting for white") : (profile?.username ?? "Guest Player")}
                  </div>
                </div>
                <div className="rounded-[8px] bg-black/25 px-3 py-2 font-mono text-xl font-semibold">{formatClock(whiteClockSeconds)}</div>
              </div>

              <div className="arena-panel w-full max-w-[720px] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                      <span className={["h-2.5 w-2.5 rounded-full", activeGame.status === "active" ? "bg-arena-teal" : "bg-arena-amber"].join(" ")} />
                      {activeGame.status}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {aiThinking ? "AI thinking..." : `${activeGame.turn} to move`} · {statusMessage}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mode === "ai" ? (
                      <label className="sr-only" htmlFor="ai-difficulty">
                        AI difficulty
                      </label>
                    ) : null}
                    {mode === "ai" ? (
                      <select
                        id="ai-difficulty"
                        aria-label="AI difficulty"
                        className="arena-input min-h-10 w-auto"
                        value={aiDifficulty}
                        onChange={(event) => setAiDifficulty(event.target.value as AiDifficulty)}
                      >
                        {aiDifficulties.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:border-arena-teal/50 hover:text-[var(--text)]"
                      onClick={() => setBoardOrientation((current) => (current === "white" ? "black" : "white"))}
                    >
                      <Repeat2 size={15} aria-hidden />
                      Flip board
                    </button>
                    <button
                      type="button"
                      className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:border-arena-teal/50 hover:text-[var(--text)]"
                      onClick={resetGame}
                    >
                      <RotateCcw size={15} aria-hidden />
                      New
                    </button>
                    <button
                      type="button"
                      className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-arena-coral/40 bg-arena-coral/[0.07] px-3 text-sm text-arena-coral transition hover:bg-arena-coral/[0.12]"
                      onClick={async () => {
                        if (mode === "friend" && room && playerId) {
                          const result = await services.rooms.resign(room.id, playerId);
                          if (result.data) {
                            setRoom(result.data);
                          }
                          return;
                        }

                        setGame((current) => ({ ...current, status: "resigned" }));
                      }}
                    >
                      <Flag size={15} aria-hidden />
                      Resign
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="order-3 space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
            <section className="arena-panel p-4">
              <MoveList moves={activeGame.moves} />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">White captured</div>
                  <div className="mt-1 min-h-6 text-lg">{captured.white.join(" ") || "None"}</div>
                </div>
                <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Black captured</div>
                  <div className="mt-1 min-h-6 text-lg">{captured.black.join(" ") || "None"}</div>
                </div>
              </div>
            </section>

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={17} className="text-arena-teal" aria-hidden />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">AI Coach</h2>
              </div>
              {insights.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                  Finish a game to generate engine-backed coach insights.
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div key={`${insight.moveNumber}-${insight.moveSan}`} className="coach-insight rounded-[8px] border border-white/10 bg-black/[0.14] p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-arena-amber">
                        {insight.classification}
                      </div>
                      <div className="text-sm font-semibold">Move {insight.moveNumber}: {insight.moveSan}</div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{insight.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trophy size={17} className="text-arena-gold" aria-hidden />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Leaderboard</h2>
              </div>
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.userId} className="grid min-h-9 grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-[8px] px-2 text-sm transition hover:bg-white/[0.045]">
                    <span className="text-[var(--muted)]">#{entry.rank}</span>
                    <span className="truncate font-medium">{entry.username}</span>
                    <span className="font-mono text-arena-gold">{entry.rating}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <History size={17} className="text-arena-teal" aria-hidden />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">History</h2>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Completed games will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 4).map((gameRecord) => (
                    <div key={gameRecord.id} className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{gameRecord.result}</div>
                        <ChartNoAxesColumn size={14} className="text-arena-teal" aria-hidden />
                      </div>
                      <div className="text-xs text-[var(--muted)]">{new Date(gameRecord.createdAt).toLocaleString()}</div>
                      <div className="mt-1 truncate text-xs text-[var(--muted)]">{gameRecord.pgn || "No notation recorded"}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <PromotionModal open={Boolean(pendingPromotion)} onChoose={choosePromotion} onCancel={() => setPendingPromotion(null)} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}

function gameFromRoom(room: RoomState): ChessGameState {
  const snapshot = snapshotFromChess(createChessFromState(room.fen, room.pgn));

  return {
    ...snapshot,
    fen: room.fen,
    pgn: room.pgn,
    status: room.status,
    turn: room.turn,
  };
}

function colorForPlayer(room: RoomState | null, playerId: string | null): ChessColor | null {
  if (!room || !playerId) {
    return null;
  }

  if (room.whitePlayerId === playerId) {
    return "white";
  }

  if (room.blackPlayerId === playerId) {
    return "black";
  }

  return null;
}

function statusMessageForRoom(room: RoomState, playerId: string | null): string {
  const color = colorForPlayer(room, playerId);

  if (room.status === "resigned") {
    return `${capitalizeColor(room.resignedBy ?? oppositeRoomColor(room.turn))} resigned.`;
  }

  if (room.status === "waiting") {
    return color === "white" ? "Share the room link. Opponent pending." : "Waiting for opponent.";
  }

  if (room.status !== "active") {
    return `Game ended: ${room.status}.`;
  }

  if (!color) {
    return "Spectating this room.";
  }

  return room.turn === color ? "Your move." : "Opponent to move.";
}

function capitalizeColor(color: ChessColor): string {
  return color === "white" ? "White" : "Black";
}

function oppositeRoomColor(color: ChessColor): ChessColor {
  return color === "white" ? "black" : "white";
}

function timeControlSeconds(value: TimeControl): number {
  return timeControls.find((item) => item.value === value)?.seconds ?? 600;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}
