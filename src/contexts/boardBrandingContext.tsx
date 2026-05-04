import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type BoardBrandingState = {
  /** `project.background` khi đang xem bảng; null khi rời bảng hoặc chưa tải. */
  boardBackground: string | null;
  setBoardBrandingBackground: (value: string | null) => void;
};

const BoardBrandingContext = createContext<BoardBrandingState | null>(null);

export function BoardBrandingProvider({ children }: { children: ReactNode }) {
  const [boardBackground, setBoardBackground] = useState<string | null>(null);

  const setBoardBrandingBackground = useCallback((value: string | null) => {
    setBoardBackground(value);
  }, []);

  const value = useMemo(
    () => ({ boardBackground, setBoardBrandingBackground }),
    [boardBackground, setBoardBrandingBackground]
  );

  return (
    <BoardBrandingContext.Provider value={value}>{children}</BoardBrandingContext.Provider>
  );
}

export function useBoardBranding(): BoardBrandingState {
  const ctx = useContext(BoardBrandingContext);
  if (!ctx) {
    throw new Error('useBoardBranding must be used within BoardBrandingProvider');
  }
  return ctx;
}

/** Sidebar / layout khi có thể không bọc provider (an toàn). */
export function useBoardBrandingOptional(): BoardBrandingState | null {
  return useContext(BoardBrandingContext);
}
