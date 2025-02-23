import { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import './App.css';

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

const Container = styled.div`
  background-color: #18181b;
  min-height: 100vh;
  color: #efeff1;
`;

const Header = styled.header`
  background-color: #1f1f23;
  padding: 1rem 2rem;
  border-bottom: 1px solid #303032;
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

const ClipLink = styled.a`
  display: block;
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #1f1f23;
  border-radius: 8px;
  padding: 8px;
  border: 1px solid #303032;
  transition: all 0.2s;
  text-decoration: none;
  width: 200px;

  &:hover {
    transform: scale(1.05);
    border-color: #9147ff;
  }
`;

const ClipThumbnail = styled.img`
  width: 100%;
  border-radius: 4px;
  margin-bottom: 8px;
`;

const ClipLinkTitle = styled.div`
  color: #efeff1;
  font-size: 0.9rem;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ClipLinkMeta = styled.div`
  color: #adadb8;
  font-size: 0.8rem;
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
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [sortBy, setSortBy] = useState<'views' | 'created_at' | 'duration'>(
    'created_at'
  );
  const [timeFilter, setTimeFilter] = useState<
    '24h' | '7d' | '30d' | '180d' | 'all'
  >('24h');
  const [durationFilter, setDurationFilter] = useState<
    'short' | 'medium' | 'long' | 'all'
  >('all');
  const [totalClips, setTotalClips] = useState<number>(0);

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
    if (!broadcasterId) return 0;

    try {
      const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;
      const accessToken = import.meta.env.VITE_TWITCH_ACCESS_TOKEN;

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

      setTotalClips(total);
      return total;
    } catch (err) {
      return 0;
    }
  }, [broadcasterId, timeFilter]);

  const fetchClips = useCallback(
    async (after?: string | null) => {
      if (!broadcasterId) return null;

      try {
        const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;
        const accessToken = import.meta.env.VITE_TWITCH_ACCESS_TOKEN;

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
        setError('クリップの取得に失敗しました。');
        setHasMoreClips(false);
        return null;
      }
    },
    [broadcasterId, timeFilter, filterClips]
  );

  const playNextClip = useCallback(async () => {
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

  const playPreviousClip = () => {
    const prevIndex = currentClipIndex - 1;
    if (prevIndex >= 0) {
      setCurrentClip(clips[prevIndex]);
      setCurrentClipIndex(prevIndex);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamerName.trim()) return;

    setLoading(true);
    setError(null);
    setIsSearching(true);
    setCurrentClip(null);
    setCursor(null);
    setBroadcasterId(null);
    setClips([]);
    setCurrentClipIndex(0);
    setTotalClips(0);

    try {
      const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;
      const accessToken = import.meta.env.VITE_TWITCH_ACCESS_TOKEN;

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

          const estimatedTotal = hasNextPage
            ? Math.max(100, filteredClips.length)
            : filteredClips.length;
          setTotalClips(estimatedTotal);
        } else {
          setError('クリップが見つかりませんでした。');
        }
      } else {
        setError('配信者が見つかりませんでした。');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('認証エラー: アクセストークンが無効または期限切れです。');
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
    playNextClip();
  };

  useEffect(() => {
    if (clips.length > 0 && !currentClip) {
      setCurrentClip(clips[0]);
      setCurrentClipIndex(0);
    }
  }, [clips, currentClip]);

  useEffect(() => {
    let timeoutId: number;

    if (currentClip) {
      timeoutId = window.setTimeout(
        () => {
          playNextClip();
        },
        (currentClip.duration + 3) * 1000
      );

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }
  }, [currentClip, playNextClip]);

  useEffect(() => {
    if (broadcasterId) {
      setCurrentClip(null);
      setCursor(null);
      setClips([]);
      setCurrentClipIndex(0);
      setTotalClips(0);
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

  return (
    <Container>
      <Header>
        <Title>Twitch Clip Roop</Title>
        <Subtitle>お気に入りの配信者のクリップが流れ続けます</Subtitle>
      </Header>
      <MainContent>
        <FilterContainer>
          <FilterSelect
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'views' | 'created_at' | 'duration')
            }
            disabled={isSearching || !broadcasterId}
          >
            <option value="created_at">新しい順</option>
            <option value="views">視聴回数順</option>
            <option value="duration">長さ順</option>
          </FilterSelect>

          <FilterSelect
            value={timeFilter}
            onChange={(e) =>
              setTimeFilter(
                e.target.value as '24h' | '7d' | '30d' | '180d' | 'all'
              )
            }
            disabled={isSearching || !broadcasterId}
          >
            <option value="24h">24時間以内</option>
            <option value="7d">7日以内</option>
            <option value="30d">30日以内</option>
            <option value="180d">半年以内</option>
            <option value="all">全期間</option>
          </FilterSelect>

          <FilterSelect
            value={durationFilter}
            onChange={(e) =>
              setDurationFilter(
                e.target.value as 'short' | 'medium' | 'long' | 'all'
              )
            }
            disabled={isSearching || !broadcasterId}
          >
            <option value="all">すべての長さ</option>
            <option value="short">30秒以内</option>
            <option value="medium">30秒〜1分</option>
            <option value="long">1分以上</option>
          </FilterSelect>
        </FilterContainer>

        <SearchForm onSubmit={handleSearch}>
          <SearchInput
            type="text"
            placeholder="配信者IDを入力（例：k4sen、stylishnoob4）"
            value={streamerName}
            onChange={(e) => setStreamerName(e.target.value)}
            disabled={isSearching}
          />
          <SearchButton
            type="submit"
            disabled={isSearching || !streamerName.trim()}
          >
            {isSearching ? '検索中...' : '検索'}
          </SearchButton>
        </SearchForm>

        {loading && <div>読み込み中...</div>}
        {error && <div style={{ color: '#ff4747' }}>{error}</div>}
        {currentClip && (
          <>
            <ClipContainer>
              <ClipEmbed>
                <NavigationButton className="prev" onClick={playPreviousClip}>
                  ＜
                </NavigationButton>
                <NavigationButton className="next" onClick={handleNextClip}>
                  ＞
                </NavigationButton>
                <ClipIframe
                  ref={playerRef}
                  title="Twitch Clip Player"
                  src={`https://clips.twitch.tv/embed?clip=${currentClip.id}&parent=${window.location.hostname}&parent=localhost&parent=127.0.0.1&autoplay=true&muted=false&controls=false&playbackRateControls=false&seekable=false&preload=auto`}
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
                  視聴回数: {currentClip.view_count.toLocaleString()} •
                  再生時間: {currentClip.duration}秒 • 作成日時:{' '}
                  {formatDate(currentClip.created_at)}
                </ClipMeta>
              </ClipInfo>
            </ClipContainer>
            <ClipLink
              href={`https://clips.twitch.tv/${currentClip.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ClipThumbnail
                src={currentClip.thumbnail_url}
                alt={currentClip.title}
              />
              <ClipLinkTitle>{currentClip.title}</ClipLinkTitle>
              <ClipLinkMeta>
                配信者: {currentClip.broadcaster_name} • 作成者:{' '}
                {currentClip.creator_name} • 再生時間: {currentClip.duration}秒
                • {formatDate(currentClip.created_at)}
              </ClipLinkMeta>
            </ClipLink>
          </>
        )}
      </MainContent>
    </Container>
  );
}

export default App;
