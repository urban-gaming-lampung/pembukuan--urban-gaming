# Challenge Bulan Ini - Data Layer & Hooks

Folder ini berisi fondasi arsitektur data dan hooks untuk mendukung fitur **Challenge Bulan Ini** (Leaderboard & Game Retro Pegawai).

## Struktur Folder
```text
src/games/
├── types.ts              # Type definitions untuk game, leaderboard, winner
├── constants.ts          # Nilai konstanta (GAME_ROTATION, MONTH_PRIZE, MAX_SCORE_CAP)
├── README.md             # Dokumentasi ini
├── hooks/
│   ├── useGameConfig.ts  # Membaca konfigurasi game aktif bulan ini
│   ├── useLeaderboard.ts # Real-time leaderboard dengan data profile enrichment
│   ├── usePrevWinner.ts  # Mengambil pemenang bulan lalu (one-time fetch)
│   └── useGameSession.ts # Mengelola play session, daily limits, dan submit skor
└── utils/
    ├── monthKey.ts       # Format helper monthKey ("YYYY-MM")
    └── scoreValidator.ts # Validasi skor di sisi client (basic)
```

## Penggunaan Hooks

### 1. `useGameConfig`
Digunakan untuk mendengarkan game aktif dan prize bulan ini secara real-time.
```typescript
import { useGameConfig } from './hooks/useGameConfig';

const { config, loading, error } = useGameConfig();
// config: { activeGame, monthKey, rotationIndex, prizeAmount }
```

### 2. `useLeaderboard`
Mendengarkan 10 skor tertinggi pegawai bulan ini secara real-time, di-enrich dengan data profile (`name` & `photoUrl`) dari `/users/{email}`.
```typescript
import { useLeaderboard } from './hooks/useLeaderboard';

const { entries, loading, currentUserRank, currentUserEntry } = useLeaderboard(monthKey);
```

### 3. `usePrevWinner`
Mengambil data pemenang bulan lalu secara *one-time get* saat mount.
```typescript
import { usePrevWinner } from './hooks/usePrevWinner';

const { winner, loading } = usePrevWinner(prevMonthKey);
```

### 4. `useGameSession`
Mengelola pengiriman skor ke Cloud Function dan pembatasan sesi harian (10 kali per hari).
```typescript
import { useGameSession } from './hooks/useGameSession';

const { submitScore, canPlay, attemptsLeftToday, loading, error, optimisticHighScore } = useGameSession(
  monthKey,
  gameType,
  currentHighScore
);

// Panggil saat game selesai
const handleGameOver = async (score) => {
  const result = await submitScore({
    score,
    gameType,
    seed: 'random_seed_123',
    actionLog: 'key_press_logs...',
    duration: 35,
    clientTimestamp: Date.now()
  });
  
  if (result.success) {
    console.log(result.isNewHighScore ? 'Rekor baru!' : 'Skor masuk!');
  }
};
```
