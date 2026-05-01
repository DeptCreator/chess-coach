"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Square } from "chess.js";
import {
  Activity,
  Bot,
  Bell,
  Check,
  ChartNoAxesColumn,
  Crown,
  Flag,
  Flame,
  History,
  Mail,
  Moon,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trophy,
  UserRoundPlus,
  Users,
  X,
  Repeat2,
} from "lucide-react";
import Link from "next/link";
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
import type { AuthSession, ChessColor, CoachInsight, FriendProfile, Friendship, GameMode, GameRecord, LeaderboardEntry, RoomColorChoice, RoomState, TimeControl, UserProfile } from "@/domain/types";
import { getAppServices, type AiDifficulty, type AppServices } from "@/services";
import { createDeviceGameService } from "@/services/device-history";
import { createTemplateInsights } from "@/services/engine/template-coach";
import { ChessBoard } from "./ChessBoard";
import { ArenaScene } from "./ArenaScene";
import { MoveList } from "./MoveList";
import { PromotionModal } from "./PromotionModal";
import { RoomLinkPanel } from "./RoomLinkPanel";
import { UpgradeModal } from "./UpgradeModal";

type PendingPromotion = { from: Square; to: Square } | null;
type ClockState = Record<ChessColor, number>;
type AppView = "play" | "friends";
type LeaderboardFilter = "global" | "city";

interface PracticeSession {
  sourceInsight: CoachInsight;
  recommendedMove: string;
  attempted: boolean;
  hintVisible: boolean;
}

interface PersistedArenaState {
  version: 1;
  mode: GameMode;
  game: ChessGameState;
  clocks: ClockState;
  aiDifficulty: AiDifficulty;
  boardOrientation: ChessColor;
  roomColorChoice: RoomColorChoice;
  roomTimeControl: TimeControl;
  statusMessage: string;
}

interface FriendSettings {
  defaultTimeControl: TimeControl;
  preferredColor: RoomColorChoice;
}

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

const arenaStateKey = "mahiru:arena-state:v1";

export function ArenaApp() {
  const [services] = useState<AppServices>(() => getAppServices());
  const [deviceGames] = useState(() => createDeviceGameService());
  const [activeView, setActiveView] = useState<AppView>("play");
  const [mode, setMode] = useState<GameMode>("local");
  const [game, setGame] = useState<ChessGameState>(() => createInitialGame());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({ username: "Guest Player", city: "Local", isPro: false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("global");
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendSearchResults, setFriendSearchResults] = useState<FriendProfile[]>([]);
  const [friendsBusy, setFriendsBusy] = useState(false);
  const [friendsMessage, setFriendsMessage] = useState<string | null>(null);
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
  const [localClocks, setLocalClocks] = useState<ClockState>(() => createClockState("rapid"));
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [resignationNotice, setResignationNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Choose a mode and make the first move.");
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const aiReplyInFlight = useRef(false);
  const profileDraftDirty = useRef(false);
  const preservedInitialClock = useRef(false);

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
  const friendClocks = useMemo(() => (room ? liveRoomClocks(room, clockNow) : null), [clockNow, room]);
  const whiteClockSeconds = mode === "friend" && friendClocks ? friendClocks.white : localClocks.white;
  const blackClockSeconds = mode === "friend" && friendClocks ? friendClocks.black : localClocks.black;
  const leaderboardCity = session && leaderboardFilter === "city" ? profile?.city.trim() : "";
  const currentLeaderboardEntry = useMemo(
    () => leaderboard.find((entry) => entry.userId === playerId) ?? null,
    [leaderboard, playerId],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const restoredState = readPersistedArenaState();

    if (!restoredState) {
      return;
    }

    preservedInitialClock.current = true;
    setMode(restoredState.mode);
    setGame(restoredState.game);
    setLocalClocks(restoredState.clocks);
    setAiDifficulty(restoredState.aiDifficulty);
    setBoardOrientation(restoredState.boardOrientation);
    setRoomColorChoice(restoredState.roomColorChoice);
    setRoomTimeControl(restoredState.roomTimeControl);
    setStatusMessage(restoredState.statusMessage);
  }, []);

  useEffect(() => {
    if (preservedInitialClock.current) {
      preservedInitialClock.current = false;
      return;
    }

    setLocalClocks(createClockState(roomTimeControl));
  }, [roomTimeControl]);

  useEffect(() => {
    if (mode === "friend") {
      return;
    }

    writePersistedArenaState({
      version: 1,
      mode,
      game,
      clocks: localClocks,
      aiDifficulty,
      boardOrientation,
      roomColorChoice,
      roomTimeControl,
      statusMessage,
    });
  }, [aiDifficulty, boardOrientation, game, localClocks, mode, roomColorChoice, roomTimeControl, statusMessage]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode === "friend" || activeGame.status !== "active" || aiThinking) {
      return;
    }

    const interval = window.setInterval(() => {
      setLocalClocks((current) => {
        const next = {
          ...current,
          [activeGame.turn]: Math.max(0, current[activeGame.turn] - 1),
        };

        if (next[activeGame.turn] === 0) {
          setGame((gameState) => ({ ...gameState, status: "timeout" }));
          setStatusMessage(`${capitalizeColor(activeGame.turn)} ran out of time.`);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeGame.status, activeGame.turn, aiThinking, mode]);

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
      const sessionResult = await services.auth.getSession();

      if (!mounted) {
        return;
      }

      if (sessionResult.data) {
        setSession(sessionResult.data);
        setPlayerId(sessionResult.data.userId);

        const [profileResult, leaderboardResult, historyResult, friendshipsResult] = await Promise.all([
          services.profiles.getCurrentProfile(),
          services.profiles.listLeaderboard(),
          services.games.listHistory(sessionResult.data.userId),
          services.friends.listFriendships(),
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
        if (friendshipsResult.data) {
          setFriendships(friendshipsResult.data);
        }
        return;
      }

      setSession(null);
      setPlayerId(null);
      setProfile(null);
      setLeaderboard([]);
      setLeaderboardFilter("global");
      setFriendships([]);
      const historyResult = await deviceGames.listHistory(null);
      if (mounted && historyResult.data) {
        setHistory(historyResult.data);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [deviceGames, services]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (leaderboardFilter === "city" && !profile?.city.trim()) {
      setLeaderboardFilter("global");
      return;
    }

    let cancelled = false;

    async function loadLeaderboard() {
      const result = await services.profiles.listLeaderboard(leaderboardFilter === "city" ? profile?.city.trim() : undefined);

      if (!cancelled && result.data) {
        setLeaderboard(result.data);
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [leaderboardFilter, profile?.city, services.profiles, session]);

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
        accountState: session ? "account" : "guest",
        leaderboardFilter,
        practice: practiceSession
          ? {
              moveNumber: practiceSession.sourceInsight.moveNumber,
              recommendedMove: practiceSession.recommendedMove,
              attempted: practiceSession.attempted,
              hintVisible: practiceSession.hintVisible,
            }
          : null,
        coordinateSystem: "Squares use algebraic notation; white is at ranks 1-2 and moves toward rank 8.",
      });
    window.advanceTime = () => undefined;
  }, [activeGame, aiDifficulty, aiThinking, boardOrientation, leaderboardFilter, legalTargets, mode, playerColor, playerId, practiceSession, room, selectedSquare, session]);

  const persistCompletedGame = useCallback(
    async (finalState: ChessGameState, participants?: { whiteId: string | null; blackId: string | null }) => {
      const gamesService = session ? services.games : deviceGames;
      const saved = await gamesService.saveCompletedGame({
        whiteId: participants?.whiteId ?? profile?.id ?? null,
        blackId: participants?.blackId ?? (mode === "ai" ? "system-ai" : null),
        mode,
        pgn: finalState.pgn,
        finalFen: finalState.fen,
        result: resultFromState(finalState),
        durationSeconds: Math.max(1, finalState.moves.length * 18),
      });

      if (saved.data) {
        setHistory((current) => [saved.data!, ...current].slice(0, 8));
        if (session) {
          const coach = await services.coach.generateInsights(saved.data);
          setInsights(coach.data ?? []);
        } else {
          setInsights(createTemplateInsights(saved.data));
        }
      }
    },
    [deviceGames, mode, profile?.id, services, session],
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

      if (practiceSession) {
        setPracticeSession((current) => (current ? { ...current, attempted: true } : current));
        setStatusMessage("Practice attempt recorded. Use the hint to compare with the engine idea.");
        return;
      }

      setStatusMessage(result.state.status === "active" ? message : `Game ended: ${result.state.status}.`);

      if (result.state.status !== "active") {
        persistCompletedGame(result.state);
      }
    },
    [game, persistCompletedGame, practiceSession],
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
    if (nextMode === "friend" && !session) {
      setActiveView("play");
      setStatusMessage("Sign in to use friend rooms.");
      return;
    }

    setMode(nextMode);
    setGame(createInitialGame());
    setLocalClocks(createClockState(roomTimeControl));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setInsights([]);
    setPracticeSession(null);
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

  function handleBoardMoveAttempt(from: Square, to: Square) {
    if (activeGame.status !== "active" || pendingPromotion || aiThinking || !canMoveInFriendMode) {
      return;
    }

    if (mode === "ai" && activeGame.turn === "black") {
      return;
    }

    const piece = getPieceAt(activeGame.fen, from);

    if (!piece || piece.color !== activeGame.turn || (mode === "friend" && piece.color !== playerColor)) {
      setStatusMessage("Move rejected.");
      return;
    }

    if (!getLegalMovesForSquare(activeGame, from).some((move) => move.to === to)) {
      setStatusMessage("Illegal move.");
      return;
    }

    if (isPromotionMove(activeGame, from, to)) {
      setPendingPromotion({ from, to });
      return;
    }

    commitSelectedMove({ from, to });
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

  async function createRoom(options?: { colorChoice: RoomColorChoice; timeControl: TimeControl }) {
    if (!session || !playerId) {
      setStatusMessage("Sign in to create friend rooms.");
      setActiveView("play");
      return;
    }

    setCreatingRoom(true);
    const result = await services.rooms.createRoom(playerId, {
      colorChoice: options?.colorChoice ?? roomColorChoice,
      timeControl: options?.timeControl ?? roomTimeControl,
    });
    setCreatingRoom(false);

    if (result.data) {
      setRoom(result.data);
      setMode("friend");
      setSelectedSquare(null);
      setPendingPromotion(null);
      setPracticeSession(null);
      setResignationNotice(null);
      setBoardOrientation(colorForPlayer(result.data, playerId) ?? result.data.hostColor);
      setStatusMessage("Room link ready.");
      const url = new URL(window.location.href);
      url.searchParams.set("room", result.data.id);
      window.history.replaceState(null, "", url.toString());
    } else {
      setStatusMessage(result.error ?? "Could not create room.");
    }
  }

  async function saveProfile() {
    if (!session) {
      setStatusMessage("Sign in to save a cloud profile.");
      return;
    }

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
      const nextCity = result.data.city.trim();
      const leaderboardResult = await services.profiles.listLeaderboard(leaderboardFilter === "city" && nextCity ? nextCity : undefined);
      if (leaderboardResult.data) {
        setLeaderboard(leaderboardResult.data);
      }
    } else {
      setStatusMessage(result.error ?? "Could not save profile.");
    }
  }

  async function signOut() {
    setAuthBusy(true);
    await services.auth.signOut();
    const historyResult = await deviceGames.listHistory(null);
    setAuthBusy(false);
    setSession(null);
    setPlayerId(null);
    setProfile(null);
    setLeaderboardFilter("global");
    setLeaderboard([]);
    setFriendships([]);
    setFriendSearchResults([]);
    setHistory(historyResult.data ?? []);
    setAuthMessage("Signed out.");
  }

  async function searchFriends(query: string) {
    if (!session) {
      setFriendsMessage("Sign in to search players.");
      return;
    }

    setFriendsBusy(true);
    setFriendsMessage(null);
    const result = await services.friends.searchProfiles(query);
    setFriendsBusy(false);

    if (result.data) {
      setFriendSearchResults(result.data);
    } else {
      setFriendsMessage(result.error ?? "Could not search players.");
    }
  }

  async function sendFriendRequest(profileId: string) {
    setFriendsBusy(true);
    setFriendsMessage(null);
    const result = await services.friends.sendRequest(profileId);
    setFriendsBusy(false);

    if (result.data) {
      setFriendships((current) => [result.data!, ...current]);
      setFriendSearchResults((current) => current.filter((profile) => profile.id !== profileId));
      setFriendsMessage("Friend request sent.");
    } else {
      setFriendsMessage(result.error ?? "Could not send friend request.");
    }
  }

  async function acceptFriendRequest(friendshipId: string) {
    setFriendsBusy(true);
    setFriendsMessage(null);
    const result = await services.friends.acceptRequest(friendshipId);
    setFriendsBusy(false);

    if (result.data) {
      setFriendships((current) => current.map((item) => (item.id === friendshipId ? result.data! : item)));
      setFriendsMessage("Friend added.");
    } else {
      setFriendsMessage(result.error ?? "Could not accept request.");
    }
  }

  async function removeFriendship(friendshipId: string) {
    setFriendsBusy(true);
    setFriendsMessage(null);
    const result = await services.friends.declineOrRemove(friendshipId);
    setFriendsBusy(false);

    if (!result.error) {
      setFriendships((current) => current.filter((item) => item.id !== friendshipId));
    } else {
      setFriendsMessage(result.error);
    }
  }

  function resetGame() {
    setGame(createInitialGame());
    setLocalClocks(createClockState(roomTimeControl));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setInsights([]);
    setPracticeSession(null);
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

  function startPracticeFromInsight(insight: CoachInsight) {
    if (!insight.practiceFen || !isPracticeInsight(insight)) {
      return;
    }

    let practiceGame: ChessGameState;

    try {
      practiceGame = snapshotFromChess(createChessFromState(insight.practiceFen));
    } catch {
      setStatusMessage("Practice position could not be loaded.");
      return;
    }
    setMode("local");
    setRoom(null);
    setSavedRoomGameId(null);
    setGame(practiceGame);
    setLocalClocks(createClockState(roomTimeControl));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setAiThinking(false);
    setResignationNotice(null);
    setPracticeSession({
      sourceInsight: insight,
      recommendedMove: insight.bestMove,
      attempted: false,
      hintVisible: false,
    });
    aiReplyInFlight.current = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setStatusMessage("Practice mode: find the better move.");
  }

  const visibleViews: AppView[] = session ? ["play", "friends"] : ["play"];
  const visibleModes = session ? modes : modes.filter((item) => item.mode !== "friend");
  const effectiveActiveView: AppView = session ? activeView : "play";

  useEffect(() => {
    if (!session && activeView === "friends") {
      setActiveView("play");
    }
  }, [activeView, session]);

  return (
    <main className="min-h-svh overflow-x-hidden px-3 py-3 sm:px-5 lg:px-7">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <header className="arena-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arena-teal">Chess AI Coach Arena</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Active game workspace</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[8px] border border-[var(--line)] bg-black/[0.16] p-1">
              {visibleViews.map((view) => (
                <button
                  key={view}
                  type="button"
                  className={[
                    "arena-focus inline-flex min-h-8 items-center gap-2 rounded-[7px] px-3 text-sm font-semibold transition",
                    effectiveActiveView === view ? "bg-arena-teal text-graphite-950" : "text-[var(--muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                  onClick={() => setActiveView(view)}
                >
                  {view === "play" ? <Activity size={15} aria-hidden /> : <Users size={15} aria-hidden />}
                  {view === "play" ? "Play" : "Friends"}
                </button>
              ))}
            </div>
            <span className="rounded-[8px] border border-white/10 bg-black/[0.18] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {session ? "Account" : "Guest"}
            </span>
            <button
              type="button"
              className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white/[0.035] px-3 text-sm text-[var(--muted)] transition hover:border-arena-teal/50 hover:text-[var(--text)]"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
              {theme}
            </button>
            {session ? (
              <button
                type="button"
                className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-arena-gold px-3 text-sm font-bold text-graphite-950 shadow-[0_12px_34px_rgba(214,179,90,0.22)] transition hover:brightness-105"
                onClick={() => setUpgradeOpen(true)}
              >
                <Crown size={16} aria-hidden />
                Pro
              </button>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
          <aside className="order-2 space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Account</div>
                <span className="rounded-[8px] bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                  {session ? "Signed in" : "Guest"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-[8px] border border-arena-teal/30 bg-arena-teal/[0.12] text-sm font-bold text-arena-teal">
                  {(profile?.username ?? "G").slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{profile?.username ?? "Guest Player"}</div>
                  <div className="truncate text-sm text-[var(--muted)]">{session?.email ?? "Progress saved on this device"}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {session ? (
                  <button
                    type="button"
                    className="arena-focus col-span-2 inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[var(--line)] text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                    onClick={signOut}
                    disabled={authBusy}
                  >
                    {authBusy ? "Signing out..." : "Sign out"}
                  </button>
                ) : (
                  <>
                    <Link
                      className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[var(--line)] text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                      href="/login"
                    >
                      Login
                    </Link>
                    <Link
                      className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] bg-arena-teal text-sm font-semibold text-graphite-950 transition hover:brightness-105"
                      href="/register"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
              {authMessage ? <div className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm text-[var(--muted)]">{authMessage}</div> : null}
            </section>

            <section className="arena-panel p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <Activity size={16} className="text-arena-teal" aria-hidden />
                Play modes
              </div>
              <div className="grid gap-2">
                {visibleModes.map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.mode;
                  const disabled = item.mode === "friend" && !session;

                  return (
                    <button
                      key={item.mode}
                      type="button"
                      className={[
                        "arena-focus group flex min-h-12 items-center justify-between gap-3 rounded-[8px] px-3 text-left text-sm font-semibold transition",
                        disabled
                          ? "cursor-not-allowed bg-white/[0.025] text-[var(--muted)] opacity-60"
                          : active
                          ? "bg-arena-teal text-graphite-950 shadow-[0_14px_38px_rgba(39,199,163,0.22)]"
                          : "bg-white/[0.04] text-[var(--muted)] hover:bg-white/[0.075] hover:text-[var(--text)]",
                      ].join(" ")}
                      onClick={() => handleModeChange(item.mode)}
                      disabled={disabled}
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
              {session ? (
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
              ) : (
                <div className="mt-4 rounded-[8px] border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  Sign in to save profile, rating, leaderboard, and cloud history.
                </div>
              )}
            </section>

            {session ? (
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
            ) : (
              <section className="arena-panel p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <Users size={16} className="text-arena-teal" aria-hidden />
                  Friend Room
                </div>
                <p className="text-sm text-[var(--muted)]">Sign in to create or join friend room links.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[var(--line)] text-sm font-semibold text-[var(--muted)]" href="/login">
                    Login
                  </Link>
                  <Link className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] bg-arena-teal text-sm font-semibold text-graphite-950" href="/register">
                    Register
                  </Link>
                </div>
              </section>
            )}

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
            {effectiveActiveView === "play" ? (
              <>
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
                onMoveAttempt={handleBoardMoveAttempt}
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
                      {practiceSession ? "Practice" : activeGame.status}
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
                {practiceSession ? (
                  <div className="mt-3 rounded-[8px] border border-arena-amber/35 bg-arena-amber/[0.08] p-3 text-sm">
                    <div className="font-semibold text-arena-amber">Practice from move {practiceSession.sourceInsight.moveNumber}: {practiceSession.sourceInsight.moveSan}</div>
                    <div className="mt-1 text-[var(--muted)]">
                      Replay the position and try to find the engine idea before revealing the hint.
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="arena-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-arena-amber/40 px-3 text-sm font-semibold text-arena-amber transition hover:bg-arena-amber/[0.1] disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => setPracticeSession((current) => (current ? { ...current, hintVisible: true } : current))}
                        disabled={!practiceSession.attempted && !practiceSession.hintVisible}
                      >
                        <Sparkles size={15} aria-hidden />
                        Show engine hint
                      </button>
                      {practiceSession.hintVisible ? (
                        <span className="font-mono text-sm text-[var(--text)]">{practiceSession.recommendedMove}</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">{practiceSession.attempted ? "Hint is available after your try." : "Make a move to unlock the hint."}</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
              </>
            ) : (
              <FriendsWorkspace
                session={session}
                friendships={friendships}
                searchResults={friendSearchResults}
                busy={friendsBusy}
                message={friendsMessage}
                timeControls={timeControls}
                onSearch={searchFriends}
                onSendRequest={sendFriendRequest}
                onAccept={acceptFriendRequest}
                onRemove={removeFriendship}
                onCreateChallengeRoom={(settings) => {
                  setRoomColorChoice(settings.preferredColor);
                  setRoomTimeControl(settings.defaultTimeControl);
                  setActiveView("play");
                  void createRoom({
                    colorChoice: settings.preferredColor,
                    timeControl: settings.defaultTimeControl,
                  });
                }}
              />
            )}
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
                    <div key={`${insight.moveNumber}-${insight.moveSan}`} className={coachInsightClassName(insight.classification)}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-arena-amber">
                            {coachPrimaryLabel(insight)}
                          </div>
                          <div className="mt-1 text-sm font-semibold">Move {insight.moveNumber}: {insight.moveSan}</div>
                        </div>
                        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 px-2 py-1 font-mono text-xs text-[var(--muted)]">
                          {formatEvalSwing(insight.evalBefore, insight.evalAfter)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm">
                        <CoachInsightBlock label={coachMoveLabel(insight)} value={insight.moveSan} />
                        <CoachInsightBlock label={coachBestMoveLabel(insight)} value={insight.bestMove || "No engine move"} />
                        <CoachInsightBlock label={coachWhyLabel(insight)} value={insight.explanation} muted />
                      </div>
                      {isPracticeInsight(insight) && insight.practiceFen ? (
                        <button
                          type="button"
                          className="arena-focus mt-3 inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-arena-amber/40 bg-arena-amber/[0.08] px-3 text-sm font-semibold text-arena-amber transition hover:bg-arena-amber/[0.13]"
                          onClick={() => startPracticeFromInsight(insight)}
                        >
                          <RotateCcw size={15} aria-hidden />
                          Practice this position
                        </button>
                      ) : null}
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
              {session && profile?.city.trim() ? (
                <div className="mb-3 flex rounded-[8px] border border-[var(--line)] bg-black/[0.16] p-1">
                  {(["global", "city"] as LeaderboardFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={[
                        "arena-focus min-h-8 flex-1 rounded-[7px] px-2 text-xs font-semibold transition",
                        leaderboardFilter === filter ? "bg-arena-gold text-graphite-950" : "text-[var(--muted)] hover:text-[var(--text)]",
                      ].join(" ")}
                      onClick={() => setLeaderboardFilter(filter)}
                    >
                      {filter === "global" ? "Global" : profile.city}
                    </button>
                  ))}
                </div>
              ) : null}
              {currentLeaderboardEntry && leaderboardFilter === "city" && leaderboardCity ? (
                <div className="mb-3 rounded-[8px] border border-arena-gold/35 bg-arena-gold/[0.08] px-3 py-2 text-sm font-semibold text-arena-gold">
                  #{currentLeaderboardEntry.rank} in {leaderboardCity}
                </div>
              ) : null}
              {leaderboard.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                  {leaderboardFilter === "city" && leaderboardCity ? `No ranked players in ${leaderboardCity} yet.` : "No leaderboard data yet."}
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry) => (
                    <div key={entry.userId} className="grid min-h-11 grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-[8px] px-2 text-sm transition hover:bg-white/[0.045]">
                      <span className="text-[var(--muted)]">#{entry.rank}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{entry.username}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{entry.city || "Unknown city"}</span>
                      </span>
                      <span className="font-mono text-arena-gold">{entry.rating}</span>
                    </div>
                  ))}
                </div>
              )}
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

function FriendsWorkspace({
  session,
  friendships,
  searchResults,
  busy,
  message,
  timeControls,
  onSearch,
  onSendRequest,
  onAccept,
  onRemove,
  onCreateChallengeRoom,
}: {
  session: AuthSession | null;
  friendships: Friendship[];
  searchResults: FriendProfile[];
  busy: boolean;
  message: string | null;
  timeControls: Array<{ value: TimeControl; label: string; seconds: number }>;
  onSearch(query: string): void;
  onSendRequest(profileId: string): void;
  onAccept(friendshipId: string): void;
  onRemove(friendshipId: string): void;
  onCreateChallengeRoom(settings: FriendSettings): void;
}) {
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<FriendSettings>({
    defaultTimeControl: "rapid",
    preferredColor: "white",
  });
  const acceptedFriends = friendships.filter((friendship) => friendship.direction === "accepted");
  const incomingRequests = friendships.filter((friendship) => friendship.direction === "incoming");
  const outgoingRequests = friendships.filter((friendship) => friendship.direction === "outgoing");
  const [selectedFriendId, setSelectedFriendId] = useState("");

  useEffect(() => {
    if (acceptedFriends.length === 0) {
      setSelectedFriendId("");
      return;
    }

    if (!acceptedFriends.some((friendship) => friendship.friend.id === selectedFriendId)) {
      setSelectedFriendId(acceptedFriends[0].friend.id);
    }
  }, [acceptedFriends, selectedFriendId]);

  return (
    <div className="relative z-10 grid min-h-[760px] gap-5 p-1 sm:p-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arena-teal">Social chess</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Friends</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">Find account players, manage requests, and prepare challenge rooms.</p>
        </div>
        <button
          type="button"
          className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-arena-teal px-3 text-sm font-semibold text-graphite-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onCreateChallengeRoom(settings)}
          disabled={!session || !selectedFriendId || busy}
        >
          <UserRoundPlus size={16} aria-hidden />
          Create challenge
        </button>
      </div>

      {!session ? (
        <section className="arena-panel p-5">
          <h3 className="text-lg font-semibold">Sign in to use friends</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Friend requests, accepted friends, and challenge rooms are available only for accounts.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)]" href="/login">
              Login
            </Link>
            <Link className="arena-focus inline-flex min-h-10 items-center justify-center rounded-[8px] bg-arena-teal px-4 text-sm font-semibold text-graphite-950" href="/register">
              Register
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="arena-panel p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <Search size={16} className="text-arena-teal" aria-hidden />
            Add friend
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="arena-input min-h-11 flex-1"
              placeholder="Search username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!session}
            />
            <button
              type="button"
              className="arena-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-arena-teal px-4 text-sm font-semibold text-graphite-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSearch(query)}
              disabled={!session || busy || query.trim().length < 2}
            >
              <Mail size={16} aria-hidden />
              Search
            </button>
          </div>

          {message ? <div className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm text-[var(--muted)]">{message}</div> : null}

          <div className="mt-4 grid gap-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{session ? "Search by username to add an account." : "Login required."}</p>
            ) : null}
            {searchResults.map((entry) => (
              <div key={entry.id} className="flex min-h-12 items-center justify-between gap-3 rounded-[8px] bg-white/[0.04] px-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{entry.username}</div>
                  <div className="text-xs text-[var(--muted)]">{entry.city} · {entry.rating}</div>
                </div>
                <button
                  type="button"
                  className="arena-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSendRequest(entry.id)}
                  disabled={busy}
                >
                  <UserRoundPlus size={15} aria-hidden />
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="arena-panel p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <Settings size={16} className="text-arena-gold" aria-hidden />
            Challenge settings
          </div>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Friend
              <select
                className="arena-input"
                value={selectedFriendId}
                onChange={(event) => setSelectedFriendId(event.target.value)}
                disabled={!session || acceptedFriends.length === 0}
              >
                {acceptedFriends.length === 0 ? <option value="">No accepted friends</option> : null}
                {acceptedFriends.map((friendship) => (
                  <option key={friendship.friend.id} value={friendship.friend.id}>{friendship.friend.username}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Time control
              <select
                className="arena-input"
                value={settings.defaultTimeControl}
                onChange={(event) => setSettings((current) => ({ ...current, defaultTimeControl: event.target.value as TimeControl }))}
                disabled={!session}
              >
                {timeControls.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Preferred color
              <select
                className="arena-input"
                value={settings.preferredColor}
                onChange={(event) => setSettings((current) => ({ ...current, preferredColor: event.target.value as RoomColorChoice }))}
                disabled={!session}
              >
                <option value="white">White</option>
                <option value="black">Black</option>
                <option value="random">Random</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FriendRequestList title="Incoming" icon={<Bell size={16} className="text-arena-amber" aria-hidden />} friendships={incomingRequests} empty="No incoming requests." onAccept={onAccept} onRemove={onRemove} />
        <FriendRequestList title="Friends" icon={<Users size={16} className="text-arena-teal" aria-hidden />} friendships={acceptedFriends} empty="Accepted friends appear here." onAccept={onAccept} onRemove={onRemove} />
        <FriendRequestList title="Sent" icon={<Mail size={16} className="text-arena-gold" aria-hidden />} friendships={outgoingRequests} empty="No pending outgoing requests." onAccept={onAccept} onRemove={onRemove} />
      </div>
    </div>
  );
}

function CoachInsightBlock({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.12] p-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className={["mt-1 leading-snug", muted ? "text-[var(--muted)]" : "font-semibold text-[var(--text)]"].join(" ")}>{value}</div>
    </div>
  );
}

function isPracticeInsight(insight: CoachInsight): boolean {
  return insight.classification === "mistake" || insight.classification === "blunder";
}

function coachInsightClassName(classification: CoachInsight["classification"]): string {
  const base = "coach-insight rounded-[8px] border p-3";

  if (classification === "blunder") {
    return `${base} border-arena-coral/45 bg-arena-coral/[0.09]`;
  }

  if (classification === "mistake") {
    return `${base} border-arena-amber/45 bg-arena-amber/[0.08]`;
  }

  return `${base} border-white/10 bg-black/[0.14]`;
}

function coachPrimaryLabel(insight: CoachInsight): string {
  return isPracticeInsight(insight) ? "Mistake" : "Move";
}

function coachMoveLabel(insight: CoachInsight): string {
  return isPracticeInsight(insight) ? "Mistake" : "Move";
}

function coachBestMoveLabel(insight: CoachInsight): string {
  return isPracticeInsight(insight) ? "Better move" : "Engine idea";
}

function coachWhyLabel(insight: CoachInsight): string {
  return isPracticeInsight(insight) ? "Why" : "Why it worked";
}

function formatEvalSwing(evalBefore: number, evalAfter: number): string {
  return `${formatEval(evalBefore)} -> ${formatEval(evalAfter)}`;
}

function formatEval(value: number): string {
  const pawns = value / 100;
  const formatted = Math.abs(pawns).toFixed(1);

  if (pawns > 0) {
    return `+${formatted}`;
  }

  if (pawns < 0) {
    return `-${formatted}`;
  }

  return "0.0";
}

function FriendRequestList({
  title,
  icon,
  friendships,
  empty,
  onAccept,
  onRemove,
}: {
  title: string;
  icon: ReactNode;
  friendships: Friendship[];
  empty: string;
  onAccept(id: string): void;
  onRemove(id: string): void;
}) {
  return (
    <section className="arena-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {icon}
        {title}
      </div>
      {friendships.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <div className="grid gap-2">
          {friendships.map((friendship) => (
            <div key={friendship.id} className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] p-3">
              <div className="font-semibold">{friendship.friend.username}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{friendship.friend.city || "Unknown"} · {friendship.direction}</div>
              <div className="mt-3 flex gap-2">
                {friendship.direction === "incoming" ? (
                  <button
                    type="button"
                    className="arena-focus inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-[8px] bg-arena-teal text-sm font-semibold text-graphite-950"
                    onClick={() => onAccept(friendship.id)}
                  >
                    <Check size={15} aria-hidden />
                    Accept
                  </button>
                ) : null}
                <button
                  type="button"
                  className="arena-focus inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-[8px] border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
                  onClick={() => onRemove(friendship.id)}
                >
                  <X size={15} aria-hidden />
                  {friendship.direction === "accepted" ? "Remove" : "Dismiss"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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

function createClockState(value: TimeControl): ClockState {
  const seconds = timeControlSeconds(value);

  return { white: seconds, black: seconds };
}

function liveRoomClocks(room: RoomState, now: number): ClockState {
  const clocks = {
    white: room.clocks.whiteSeconds,
    black: room.clocks.blackSeconds,
  };

  if (room.status !== "active" || !room.clocks.lastTickAt) {
    return clocks;
  }

  const elapsed = Math.max(0, Math.floor((now - new Date(room.clocks.lastTickAt).getTime()) / 1000));

  return {
    ...clocks,
    [room.turn]: Math.max(0, clocks[room.turn] - elapsed),
  };
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readPersistedArenaState(): PersistedArenaState | null {
  const state = readLocalJson<PersistedArenaState | null>(arenaStateKey, null);

  if (!state || state.version !== 1 || state.mode === "friend") {
    return null;
  }

  return state;
}

function writePersistedArenaState(state: PersistedArenaState): void {
  writeLocalJson(arenaStateKey, state);
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}
