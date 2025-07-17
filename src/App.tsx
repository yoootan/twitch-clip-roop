import { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import './App.css';

// Google Analytics用の型定義
declare global {
  interface Window {
    gtag: (
      type: string,
      action: string,
      params?: { [key: string]: string | number | boolean | null }
    ) => void;
    resetTimerForSeek?: (newRemainingTime: number) => void;
    currentClipDuration?: number;
  }
}

// Google Analyticsのイベント送信関数
const sendGAEvent = (
  action: string,
  params?: { [key: string]: string | number | boolean | null }
) => {
  if (window.gtag) {
    // 基本的なイベントパラメータ
    const baseParams = {
      ...params,
      language: navigator.language, // ブラウザの言語設定
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // タイムゾーン
    };

    window.gtag('event', action, baseParams);
  }
};

interface TwitchClip {
  id: string;
  embed_url: string;
  broadcaster_name: string;
  creator_name: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  created_at: string;
  duration: number;
}

interface TwitchApiParams {
  broadcaster_id: string;
  first: number;
  after?: string;
  started_at?: string;
  ended_at?: string;
}

// 言語設定の型定義を追加
type Language = 'ja' | 'en';

// 翻訳用のオブジェクト
const translations = {
  ja: {
    title: 'Twitch Clip Loop',
    subtitle: 'お気に入りの配信者のクリップをループ再生',
    searchPlaceholder: '配信者IDを入力（例：k4sen、stylishnoob4）',
    searchButton: '検索',
    searching: '検索中...',
    sortNew: '新しい順',
    sortViews: '視聴回数順',
    sortDuration: '長さ順',
    time24h: '24時間以内',
    time7d: '7日以内',
    time30d: '30日以内',
    time180d: '半年以内',
    timeAll: '全期間',
    durationAll: 'すべての長さ',
    durationShort: '30秒以内',
    durationMedium: '30秒〜1分',
    durationLong: '1分以上',
    views: '視聴回数',
    duration: '再生時間',
    createdAt: '作成日時',
    broadcaster: '配信者',
    creator: '作成者',
    autoPlay: '自動再生',
    autoPlayOn: 'ON',
    autoPlayOff: 'OFF',

    notification: 'お知らせ',
    close: '閉じる',
    updateTitle: 'アップデート情報',
    updateContent: `
      【2024年2月21日 更新内容】
      
      ● Twitchネイティブコントロール有効化 🎉
      　- プレイヤー内で音量調整が可能になりました
      　- 再生/停止が正常に動作します
      　- 再生速度調整（0.25x〜2.0x）
      　- クリップ内のシーク機能
      
      ● 新しいコントロール機能
      　- 自動再生切り替え：ループ再生の制御
      　- 手動スキップ：いつでも次のクリップへ
      　- 機能しないUIを削除してスッキリ
      
      ● 使い方
      　- プレイヤーにマウスを置くとTwitchコントロール表示
      　- 音量スライダーで音量調整
      　- 「自動再生: OFF」でループ停止
      　- 「次のクリップ」で手動スキップ
      
      ● 基本機能
      　- Twitchクリップの自動ループ再生
      　- 期間・長さ・並び順でのフィルタリング
      　- 配信者のクリップ検索
      　- 日本語・英語切り替え
    `,
  },
  en: {
    title: 'Twitch Clip Loop',
    subtitle: 'Loop playback of your favorite streamers clips',
    searchPlaceholder: 'Enter streamer ID (e.g., k4sen, stylishnoob4)',
    searchButton: 'Search',
    searching: 'Searching...',
    sortNew: 'Newest',
    sortViews: 'Most Viewed',
    sortDuration: 'Duration',
    time24h: 'Last 24 Hours',
    time7d: 'Last 7 Days',
    time30d: 'Last 30 Days',
    time180d: 'Last 180 Days',
    timeAll: 'All Time',
    durationAll: 'All Lengths',
    durationShort: 'Under 30s',
    durationMedium: '30s - 1min',
    durationLong: 'Over 1min',
    views: 'views',
    duration: 'duration',
    createdAt: 'created at',
    broadcaster: 'Broadcaster',
    creator: 'Creator',
    autoPlay: 'Auto Play',
    autoPlayOn: 'ON',
    autoPlayOff: 'OFF',

    notification: 'Notification',
    close: 'Close',
    updateTitle: 'Update Information',
    updateContent: `
      【February 21, 2024 Updates】
      
      ● Native Twitch Controls Enabled 🎉
      　- Volume adjustment now works directly in player
      　- Play/pause functionality fully operational
      　- Playback speed control (0.25x - 2.0x)
      　- Seek functionality within clips
      
      ● New Control Features
      　- Auto-play toggle: Control loop behavior
      　- Manual skip: Jump to next clip anytime
      　- Removed non-functional UI elements
      
      ● How to Use
      　- Hover over player to see Twitch controls
      　- Use volume slider to adjust sound
      　- Click "Auto Play: OFF" to stop looping
      　- Click "Skip Clip" to manually advance
      
      ● Previous Improvements
      　- Authentication error fixes
      　- Project name correction
      　- Language switching (Japanese/English)
      　- Google Analytics integration
    `,
  },
};

const Container = styled.div`
  background-color: #18181b;
  min-height: 100vh;
  color: #efeff1;
`;

const Header = styled.header`
  background-color: #1f1f23;
  padding: 1rem 2rem;
  border-bottom: 1px solid #303032;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AppIcon = styled.svg`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
`;

const Title = styled.h1`
  color: #bf94ff;
  font-size: 1.5rem;
  margin: 0;
`;

const Subtitle = styled.p`
  color: #adadb8;
  font-size: 1rem;
  margin: 0.5rem 0 0;
`;

const MainContent = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const SearchForm = styled.form`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: 1px solid #303032;
  border-radius: 4px;
  background-color: #18181b;
  color: #efeff1;

  &:focus {
    outline: none;
    border-color: #bf94ff;
  }

  &::placeholder {
    color: #adadb8;
  }
`;

const SearchButton = styled.button`
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  background-color: #9147ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #772ce8;
  }

  &:disabled {
    background-color: #392e5c;
    cursor: not-allowed;
  }
`;

const ClipContainer = styled.div`
  background-color: #1f1f23;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 2rem;
`;

const NavigationButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(31, 31, 35, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  font-size: 24px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  &:hover {
    background-color: rgba(145, 71, 255, 0.8);
  }

  &:disabled {
    background-color: rgba(57, 46, 92, 0.8);
    cursor: not-allowed;
  }

  &.prev {
    left: 20px;
  }

  &.next {
    right: 20px;
  }
`;

const ClipEmbed = styled.div`
  position: relative;
  padding-top: 56.25%; /* 16:9 アスペクト比 */
`;

const ClipIframe = styled.iframe`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
`;

const ClipInfo = styled.div`
  padding: 1rem;
`;

const ClipTitle = styled.h2`
  color: #efeff1;
  font-size: 1.2rem;
  margin: 0 0 0.5rem 0;
`;

const ClipMeta = styled.div`
  color: #adadb8;
  font-size: 0.9rem;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  font-size: 1rem;
  background-color: #1f1f23;
  color: #efeff1;
  border: 1px solid #303032;
  border-radius: 4px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #bf94ff;
  }

  option {
    background-color: #1f1f23;
  }
`;

// 言語切り替えボタンのスタイル
const LanguageButton = styled.button`
  position: fixed;
  top: 80px;
  right: 20px;
  padding: 8px 16px;
  background-color: #1f1f23;
  color: #efeff1;
  border: 1px solid #303032;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #9147ff;
    background-color: #2f2f35;
  }
`;

const AutoPlayButton = styled.button`
  position: fixed;
  top: 120px;
  right: 20px;
  padding: 8px 16px;
  background-color: #1f1f23;
  color: #efeff1;
  border: 1px solid #303032;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #9147ff;
    background-color: #2f2f35;
  }

  &.enabled {
    border-color: #00ff88;
    color: #00ff88;
  }

  &.disabled {
    border-color: #ff4747;
    color: #ff4747;
  }
`;

const NotificationButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: 2px solid #bf94ff;
  color: #bf94ff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #bf94ff;
    color: white;
  }

  &::before {
    content: "🔔";
    font-size: 1.1rem;
  }
`;

const Modal = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => (isOpen ? 'block' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
`;

const ModalContent = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1f1f23;
  border: 1px solid #303032;
  border-radius: 8px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  color: #efeff1;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #303032;
`;

const ModalTitle = styled.h2`
  color: #bf94ff;
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #efeff1;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const UpdateContent = styled.div`
  white-space: pre-line;
  line-height: 1.6;
  font-size: 0.95rem;
`;

// Twitchアクセストークンを取得する関数
const getTwitchAccessToken = async (): Promise<string> => {
  try {
    const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Twitch Client ID or Client Secret is missing');
    }

    const response = await axios.post('https://id.twitch.tv/oauth2/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get Twitch access token:', error);
    throw new Error('アクセストークンの取得に失敗しました');
  }
};

function App() {
  const [streamerName, setStreamerName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentClip, setCurrentClip] = useState<TwitchClip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMoreClips, setHasMoreClips] = useState(true);
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'views' | 'created_at' | 'duration'>(
    'created_at'
  );
  const [timeFilter, setTimeFilter] = useState<
    '24h' | '7d' | '30d' | '180d' | 'all'
  >('24h');
  const [durationFilter, setDurationFilter] = useState<
    'short' | 'medium' | 'long' | 'all'
  >('all');
  const [language, setLanguage] = useState<Language>(() => {
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('ja') ? 'ja' : 'en';
  });
  const t = translations[language];

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // 自動遷移用のタイマーID
  const autoTransitionTimer = useRef<number | null>(null);
  // タイマー開始時刻を記録
  const timerStartTime = useRef<number | null>(null);
  // 定期的にタイマーをチェックするためのインターバル
  const timerCheckInterval = useRef<number | null>(null);

  // アクセストークンを取得する関数
  const initializeAccessToken = useCallback(async () => {
    try {
      const token = await getTwitchAccessToken();
      setAccessToken(token);
    } catch (error) {
      setError(
        '認証に失敗しました。しばらく時間をおいてから再度お試しください。'
      );
    }
  }, []);

  // アプリ起動時にアクセストークンを取得
  useEffect(() => {
    initializeAccessToken();
  }, [initializeAccessToken]);

  // クリップのフィルタリング関数（期間フィルターを削除し、長さと並び替えのみに）
  const filterClips = useCallback(
    (clips: TwitchClip[]) => {
      let filtered = [...clips];

      if (durationFilter !== 'all') {
        filtered = filtered.filter((clip) => {
          switch (durationFilter) {
            case 'short':
              return clip.duration <= 30;
            case 'medium':
              return clip.duration > 30 && clip.duration <= 60;
            case 'long':
              return clip.duration > 60;
            default:
              return true;
          }
        });
      }

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'views':
            return b.view_count - a.view_count;
          case 'duration':
            return b.duration - a.duration;
          case 'created_at':
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          default:
            return 0;
        }
      });

      return filtered;
    },
    [durationFilter, sortBy]
  );

  const fetchTotalClips = useCallback(async () => {
    if (!broadcasterId || !accessToken) return 0;

    try {
      const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;

      const now = new Date();
      const filterTimes: Record<'24h' | '7d' | '30d' | '180d' | 'all', number> =
        {
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
          '180d': 180 * 24 * 60 * 60 * 1000,
          all: 365 * 24 * 60 * 60 * 1000,
        };

      let params: TwitchApiParams = {
        broadcaster_id: broadcasterId,
        first: 1,
      };

      if (timeFilter !== 'all') {
        const filterTime = filterTimes[timeFilter];
        const endedAt = now.toISOString();
        const startDate = new Date(now.getTime() - filterTime);
        const startedAt = startDate.toISOString();

        params = {
          ...params,
          started_at: startedAt,
          ended_at: endedAt,
        };
      }

      const response = await axios.get('https://api.twitch.tv/helix/clips', {
        params,
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let total = 0;
      if (response.data.pagination?.cursor) {
        params.first = 100;
        const fullResponse = await axios.get(
          'https://api.twitch.tv/helix/clips',
          {
            params,
            headers: {
              'Client-ID': clientId,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        total = fullResponse.data.data.length;
        if (fullResponse.data.pagination?.cursor) {
          total = Math.max(100, total);
        }
      } else {
        total = response.data.data.length;
      }

      return total;
    } catch (err) {
      // アクセストークンが無効な場合は再取得を試行
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        try {
          await initializeAccessToken();
          return 0; // 再取得後は次回の呼び出しで使用される
        } catch (retryError) {
          return 0;
        }
      }
      return 0;
    }
  }, [broadcasterId, timeFilter, accessToken, initializeAccessToken]);

  const fetchClips = useCallback(
    async (after?: string | null) => {
      if (!broadcasterId || !accessToken) return null;

      try {
        const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;

        const now = new Date();
        const filterTimes: Record<
          '24h' | '7d' | '30d' | '180d' | 'all',
          number
        > = {
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
          '180d': 180 * 24 * 60 * 60 * 1000,
          all: 365 * 24 * 60 * 60 * 1000,
        };

        let params: TwitchApiParams = {
          broadcaster_id: broadcasterId,
          first: 1,
          ...(after ? { after } : {}),
        };

        if (timeFilter !== 'all') {
          const filterTime = filterTimes[timeFilter];
          const endedAt = now.toISOString();
          const startDate = new Date(now.getTime() - filterTime);
          const startedAt = startDate.toISOString();

          params = {
            ...params,
            started_at: startedAt,
            ended_at: endedAt,
          };
        }

        const response = await axios.get('https://api.twitch.tv/helix/clips', {
          params,
          headers: {
            'Client-ID': clientId,
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.data.data.length > 0) {
          const filteredClips = filterClips(response.data.data);

          if (filteredClips.length > 0) {
            setClips((prevClips) => {
              const newClips = after
                ? [...prevClips, ...filteredClips]
                : filteredClips;
              return newClips;
            });

            const nextCursor = response.data.pagination?.cursor;
            setHasMoreClips(!!nextCursor);
            setCursor(nextCursor || null);

            if (!after) {
              setCurrentClip(filteredClips[0]);
              setCurrentClipIndex(0);
            }

            return filteredClips;
          }

          if (!after) {
            setError('選択された期間内のクリップが見つかりませんでした。');
          }
          setHasMoreClips(false);
          return null;
        }

        if (!after) {
          setError('クリップが見つかりませんでした。');
        }
        setHasMoreClips(false);
        return null;
      } catch (err) {
        // アクセストークンが無効な場合は再取得を試行
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          try {
            await initializeAccessToken();
            setError('認証を更新しました。もう一度検索してください。');
            return null;
          } catch (retryError) {
            setError('認証エラー: アクセストークンの更新に失敗しました。');
            return null;
          }
        }
        setError('クリップの取得に失敗しました。');
        setHasMoreClips(false);
        return null;
      }
    },
    [broadcasterId, timeFilter, filterClips, accessToken, initializeAccessToken]
  );

  const playNextClip = useCallback(async () => {
    // Google Analyticsイベントの送信
    sendGAEvent('play_next_clip');

    const nextIndex = currentClipIndex + 1;

    if (nextIndex < clips.length) {
      setCurrentClip(clips[nextIndex]);
      setCurrentClipIndex(nextIndex);
    } else if (hasMoreClips && cursor) {
      try {
        const newClips = await fetchClips(cursor);
        if (newClips) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const updatedClips = clips.concat(newClips);
          if (nextIndex < updatedClips.length) {
            setCurrentClip(updatedClips[nextIndex]);
            setCurrentClipIndex(nextIndex);
          } else {
            setCurrentClipIndex(0);
            setCurrentClip(updatedClips[0]);
          }
        } else {
          setCurrentClipIndex(0);
          setCurrentClip(clips[0]);
        }
      } catch (error) {
        setError('次のクリップの取得に失敗しました。');
        setCurrentClipIndex(0);
        setCurrentClip(clips[0]);
      }
    } else {
      setCurrentClipIndex(0);
      setCurrentClip(clips[0]);
    }
  }, [currentClipIndex, clips, hasMoreClips, cursor, fetchClips]);

  // 自動遷移タイマーを設定する関数
  const setupAutoTransition = useCallback(() => {
    // 既存のタイマーとインターバルをクリア
    if (autoTransitionTimer.current) {
      window.clearTimeout(autoTransitionTimer.current);
    }
    if (timerCheckInterval.current) {
      window.clearInterval(timerCheckInterval.current);
    }

    // 自動再生が無効の場合はタイマーを設定しない
    if (!autoPlayEnabled || !currentClip) return;

    // タイマー開始時刻を記録
    timerStartTime.current = Date.now();

    // クリップの長さ - 2秒で次のクリップに遷移（2秒前に遷移）
    const transitionTime = Math.max(1000, (currentClip.duration - 2) * 1000);

    autoTransitionTimer.current = window.setTimeout(() => {
      playNextClip();
    }, transitionTime);

    // setupAutoTransition関数の最後でタイマーを再設定する関数
    const resetTimerForSeek = (newRemainingTime: number) => {
      console.log('Resetting timer for remaining time:', newRemainingTime);

      // 既存のタイマーをクリア
      if (autoTransitionTimer.current) {
        window.clearTimeout(autoTransitionTimer.current);
      }
      if (timerCheckInterval.current) {
        window.clearInterval(timerCheckInterval.current);
      }

      // 新しいタイマーを設定
      if (newRemainingTime > 2) {
        const newTransitionTime = Math.max(1000, (newRemainingTime - 2) * 1000);
        timerStartTime.current = Date.now();

        autoTransitionTimer.current = window.setTimeout(() => {
          console.log('Timer from resetTimerForSeek triggered');
          playNextClip();
        }, newTransitionTime);
      } else if (newRemainingTime > 0) {
        // 残り2秒以下の場合
        const newTransitionTime = Math.max(500, newRemainingTime * 500);
        timerStartTime.current = Date.now();

        autoTransitionTimer.current = window.setTimeout(() => {
          console.log('Short timer from resetTimerForSeek triggered');
          playNextClip();
        }, newTransitionTime);
      }
    };

    // クリップがシークされたかを監視する関数を開始時に設定
    if (currentClip) {
      // グローバルにアクセス可能にして、コンソールからも呼べるように
      window.resetTimerForSeek = resetTimerForSeek;
      window.currentClipDuration = currentClip.duration;
    }
  }, [currentClip, playNextClip, autoPlayEnabled]);

  // Twitch埋め込みプレイヤーからのメッセージを監視
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 自動再生が無効の場合は何もしない
      if (!autoPlayEnabled) return;

      // デバッグ用: すべてのメッセージをログ出力
      console.log('Message received:', {
        origin: event.origin,
        data: event.data,
      });

      // Twitchクリッププレイヤーからのメッセージを処理
      if (event.origin === 'https://clips.twitch.tv') {
        try {
          const data =
            typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;

          console.log('Twitch player message:', data);

          // より広範なイベントタイプをチェック
          const eventType =
            data.type || data.event || data.eventType || data.name;
          console.log('Event type detected:', eventType);

          // クリップ終了イベントを検知（より多くのパターンに対応）
          if (
            eventType === 'video-ended' ||
            eventType === 'ended' ||
            eventType === 'complete' ||
            eventType === 'finish' ||
            data.playbackStatus === 'ended' ||
            data.status === 'ended'
          ) {
            console.log('Video ended event detected');
            // 既存のタイマーをクリアして即座に次のクリップに遷移
            if (autoTransitionTimer.current) {
              window.clearTimeout(autoTransitionTimer.current);
            }
            if (timerCheckInterval.current) {
              window.clearInterval(timerCheckInterval.current);
            }
            playNextClip();
          }

          // シーク（時間変更）イベントを検知した場合、タイマーをリセット（より多くのパターンに対応）
          const currentTime =
            data.currentTime ||
            data.time ||
            data.position ||
            data.playbackPosition ||
            data.seconds;

          if (
            eventType === 'video-seek' ||
            eventType === 'seeked' ||
            eventType === 'seek' ||
            eventType === 'timeupdate' ||
            eventType === 'progress' ||
            eventType === 'playback-position' ||
            currentTime !== undefined
          ) {
            console.log('Seek event detected:', data);
            console.log('Current time detected:', currentTime);

            // タイマーをリセットして、残り時間を再計算
            if (currentClip && currentTime !== undefined) {
              const remainingTime = Math.max(
                0,
                currentClip.duration - currentTime
              );

              console.log('Remaining time after seek:', remainingTime);

              // 既存のタイマーをクリア
              if (autoTransitionTimer.current) {
                window.clearTimeout(autoTransitionTimer.current);
              }
              if (timerCheckInterval.current) {
                window.clearInterval(timerCheckInterval.current);
              }

              // 残り時間に基づいて新しいタイマーを設定（2秒前に遷移）
              if (remainingTime > 2) {
                const newTransitionTime = Math.max(
                  1000,
                  (remainingTime - 2) * 1000
                );
                console.log(
                  'Setting new timer for:',
                  newTransitionTime / 1000,
                  'seconds'
                );
                timerStartTime.current = Date.now();

                autoTransitionTimer.current = window.setTimeout(() => {
                  console.log('Timer triggered - playing next clip');
                  playNextClip();
                }, newTransitionTime);
              } else if (remainingTime > 0) {
                // 残り2秒以下の場合は少し待ってから遷移
                const newTransitionTime = Math.max(500, remainingTime * 500);
                console.log(
                  'Setting short timer for:',
                  newTransitionTime / 1000,
                  'seconds'
                );
                timerStartTime.current = Date.now();

                autoTransitionTimer.current = window.setTimeout(() => {
                  console.log('Short timer triggered - playing next clip');
                  playNextClip();
                }, newTransitionTime);
              }
            }
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [playNextClip, autoPlayEnabled, currentClip]);

  // クリップが変更されたときに自動遷移タイマーを設定（フォールバック）
  useEffect(() => {
    if (currentClip) {
      setupAutoTransition();
    }

    // クリーンアップ関数でタイマーとインターバルをクリア
    return () => {
      if (autoTransitionTimer.current) {
        window.clearTimeout(autoTransitionTimer.current);
      }
      if (timerCheckInterval.current) {
        window.clearInterval(timerCheckInterval.current);
      }
    };
  }, [currentClip, setupAutoTransition]);

  const playPreviousClip = () => {
    // 手動で前のクリップに移動する場合、現在のタイマーとインターバルをクリア
    if (autoTransitionTimer.current) {
      window.clearTimeout(autoTransitionTimer.current);
    }
    if (timerCheckInterval.current) {
      window.clearInterval(timerCheckInterval.current);
    }

    // Google Analyticsイベントの送信
    sendGAEvent('play_previous_clip');

    const prevIndex = currentClipIndex - 1;
    if (prevIndex >= 0) {
      setCurrentClip(clips[prevIndex]);
      setCurrentClipIndex(prevIndex);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamerName.trim() || !accessToken) return;

    // Google Analyticsイベントの送信
    sendGAEvent('search_streamer', {
      streamer_name: streamerName.trim(),
    });

    setLoading(true);
    setError(null);
    setIsSearching(true);
    setCurrentClip(null);
    setCursor(null);
    setBroadcasterId(null);
    setClips([]);
    setCurrentClipIndex(0);

    try {
      const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;

      const searchQuery = streamerName.trim();

      const userResponse = await axios.get(
        'https://api.twitch.tv/helix/search/channels',
        {
          params: {
            query: searchQuery,
            first: 1,
          },
          headers: {
            'Client-ID': clientId,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (userResponse.data.data.length > 0) {
        const broadcaster = userResponse.data.data[0];
        const broadcasterId = broadcaster.id;

        setBroadcasterId(broadcasterId);

        const now = new Date();
        const filterTimes: Record<
          '24h' | '7d' | '30d' | '180d' | 'all',
          number
        > = {
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
          '180d': 180 * 24 * 60 * 60 * 1000,
          all: 365 * 24 * 60 * 60 * 1000,
        };

        let params: TwitchApiParams = {
          broadcaster_id: broadcasterId,
          first: 100,
        };

        if (timeFilter !== 'all') {
          const filterTime = filterTimes[timeFilter];
          const endedAt = now.toISOString();
          const startDate = new Date(now.getTime() - filterTime);
          const startedAt = startDate.toISOString();

          params = {
            ...params,
            started_at: startedAt,
            ended_at: endedAt,
          };
        }

        const initialResponse = await axios.get(
          'https://api.twitch.tv/helix/clips',
          {
            params,
            headers: {
              'Client-ID': clientId,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (initialResponse.data.data.length > 0) {
          const filteredClips = filterClips(initialResponse.data.data);

          setClips(filteredClips);
          setCurrentClip(filteredClips[0]);
          setCurrentClipIndex(0);

          const hasNextPage = !!initialResponse.data.pagination?.cursor;
          setHasMoreClips(hasNextPage);
          setCursor(initialResponse.data.pagination?.cursor || null);
        } else {
          setError('クリップが見つかりませんでした。');
        }
      } else {
        setError('配信者が見つかりませんでした。');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          try {
            await initializeAccessToken();
            setError('認証を更新しました。もう一度検索してください。');
          } catch (retryError) {
            setError('認証エラー: アクセストークンの更新に失敗しました。');
          }
        } else if (err.response?.status === 400) {
          setError('リクエストエラー: パラメータが正しくありません。');
        } else {
          setError(`APIエラー: ${err.response?.data?.message || err.message}`);
        }
      } else {
        setError('予期せぬエラーが発生しました。');
      }
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleNextClip = () => {
    // 手動で次のクリップに移動する場合、現在のタイマーとインターバルをクリア
    if (autoTransitionTimer.current) {
      window.clearTimeout(autoTransitionTimer.current);
    }
    if (timerCheckInterval.current) {
      window.clearInterval(timerCheckInterval.current);
    }
    playNextClip();
  };

  useEffect(() => {
    if (clips.length > 0 && !currentClip) {
      setCurrentClip(clips[0]);
      setCurrentClipIndex(0);
    }
  }, [clips, currentClip]);

  useEffect(() => {
    if (broadcasterId) {
      setCurrentClip(null);
      setCursor(null);
      setClips([]);
      setCurrentClipIndex(0);
      fetchTotalClips().then(() => fetchClips(null));
    }
  }, [broadcasterId, fetchTotalClips, fetchClips]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFilterChange = (
    type: 'sortBy' | 'timeFilter' | 'durationFilter',
    value: string
  ) => {
    // Google Analyticsイベントの送信
    sendGAEvent('filter_change', {
      filter_type: type,
      filter_value: value,
    });

    switch (type) {
      case 'sortBy':
        setSortBy(value as 'views' | 'created_at' | 'duration');
        break;
      case 'timeFilter':
        setTimeFilter(value as '24h' | '7d' | '30d' | '180d' | 'all');
        break;
      case 'durationFilter':
        setDurationFilter(value as 'short' | 'medium' | 'long' | 'all');
        break;
    }
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'ja' ? 'en' : 'ja'));
    // Google Analyticsイベントの送信
    sendGAEvent('change_language', {
      language: language === 'ja' ? 'en' : 'ja',
    });
  };

  return (
    <Container>
      <Header>
        <AppIcon
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 32 32"
        >
          <rect width="32" height="32" fill="#9146FF" rx="4" />
          <path
            d="M8 12 L16 8 L16 11 L20 11 C22 11 24 13 24 15 L24 17 C24 19 22 21 20 21 L16 21 L16 24 L8 20 Z"
            fill="white"
            opacity="0.9"
          />
          <polygon points="12,14 12,18 16,16" fill="#9146FF" />
          <path
            d="M18 13 Q22 13 22 16 Q22 19 18 19"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
        </AppIcon>
        <div>
          <Title>{t.title}</Title>
          <Subtitle>{t.subtitle}</Subtitle>
        </div>
        <LanguageButton onClick={toggleLanguage}>
          {language === 'ja' ? 'English' : '日本語'}
        </LanguageButton>
        <AutoPlayButton
          className={autoPlayEnabled ? 'enabled' : 'disabled'}
          onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
        >
          {t.autoPlay}: {autoPlayEnabled ? t.autoPlayOn : t.autoPlayOff}
        </AutoPlayButton>
        <NotificationButton onClick={() => setShowNotification(true)}>
          {t.notification}
        </NotificationButton>
      </Header>

      <Modal
        isOpen={showNotification}
        onClick={() => setShowNotification(false)}
      >
        <ModalContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>{t.updateTitle}</ModalTitle>
            <CloseButton onClick={() => setShowNotification(false)}>
              ×
            </CloseButton>
          </ModalHeader>
          <UpdateContent>{t.updateContent}</UpdateContent>
        </ModalContent>
      </Modal>

      <MainContent>
        <FilterContainer>
          <FilterSelect
            value={sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            disabled={isSearching || !broadcasterId}
          >
            <option value="created_at">{t.sortNew}</option>
            <option value="views">{t.sortViews}</option>
            <option value="duration">{t.sortDuration}</option>
          </FilterSelect>

          <FilterSelect
            value={timeFilter}
            onChange={(e) => handleFilterChange('timeFilter', e.target.value)}
            disabled={isSearching || !broadcasterId}
          >
            <option value="24h">{t.time24h}</option>
            <option value="7d">{t.time7d}</option>
            <option value="30d">{t.time30d}</option>
            <option value="180d">{t.time180d}</option>
            <option value="all">{t.timeAll}</option>
          </FilterSelect>

          <FilterSelect
            value={durationFilter}
            onChange={(e) =>
              handleFilterChange('durationFilter', e.target.value)
            }
            disabled={isSearching || !broadcasterId}
          >
            <option value="all">{t.durationAll}</option>
            <option value="short">{t.durationShort}</option>
            <option value="medium">{t.durationMedium}</option>
            <option value="long">{t.durationLong}</option>
          </FilterSelect>
        </FilterContainer>

        <SearchForm onSubmit={handleSearch}>
          <SearchInput
            type="text"
            placeholder={t.searchPlaceholder}
            value={streamerName}
            onChange={(e) => setStreamerName(e.target.value)}
            disabled={isSearching}
          />
          <SearchButton
            type="submit"
            disabled={isSearching || !streamerName.trim()}
          >
            {isSearching ? t.searching : t.searchButton}
          </SearchButton>
        </SearchForm>

        {loading && <div>読み込み中...</div>}
        {error && <div style={{ color: '#ff4747' }}>{error}</div>}
        {currentClip && (
          <ClipContainer>
            <ClipEmbed>
              <NavigationButton className="prev" onClick={playPreviousClip}>
                ＜
              </NavigationButton>
              <NavigationButton className="next" onClick={handleNextClip}>
                ＞
              </NavigationButton>
              <ClipIframe
                ref={iframeRef}
                title="Twitch Clip Player"
                src={`https://clips.twitch.tv/embed?clip=${currentClip.id}&parent=${window.location.hostname}&parent=localhost&parent=127.0.0.1&autoplay=true&muted=false&controls=true&playbackRateControls=true&seekable=true&preload=auto`}
                allowFullScreen
                allow="autoplay"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                loading="lazy"
                referrerPolicy="origin"
              />
            </ClipEmbed>
            <ClipInfo>
              <ClipTitle>{currentClip.title}</ClipTitle>
              <ClipMeta>
                {t.views}: {currentClip.view_count.toLocaleString()} •
                {t.duration}: {currentClip.duration}秒 •{t.createdAt}:{' '}
                {formatDate(currentClip.created_at)}
              </ClipMeta>
            </ClipInfo>
          </ClipContainer>
        )}
      </MainContent>
    </Container>
  );
}

export default App;
