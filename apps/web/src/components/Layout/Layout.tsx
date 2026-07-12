import { ReactNode, useRef, useCallback, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatPanel from '../CopilotKit/ChatPanel';
import './Layout.css';
import { useAppContext } from '../../context/AppContext';

const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 600;
const CHAT_DEFAULT_WIDTH = 600;

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { state, dispatch } = useAppContext();
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem('chatPanelWidth');
    const val = saved ? parseInt(saved, 10) : CHAT_DEFAULT_WIDTH;
    return Math.max(CHAT_MIN_WIDTH, Math.min(val, CHAT_MAX_WIDTH));
  });
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      setChatWidth(Math.max(CHAT_MIN_WIDTH, Math.min(newWidth, CHAT_MAX_WIDTH)));
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setChatWidth((w) => {
          localStorage.setItem('chatPanelWidth', String(w));
          return w;
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className={`layout ${state.sidebarCollapsed ? 'layout--collapsed' : ''}`}>
      <Sidebar />
      {state.mobileSidebarOpen && (
        <div
          className="layout__overlay"
          onClick={() => dispatch({ type: 'TOGGLE_MOBILE_SIDEBAR' })}
        />
      )}
      <div className="layout__body" ref={containerRef}>
        <div className="layout__main">
          <Header />
          <main className="layout__content">
            {children}
          </main>
        </div>
        <div className="layout__splitter" onMouseDown={handleMouseDown} />
        <div className="layout__chat" style={{ width: chatWidth }}>
          <ChatPanel />
        </div>
      </div>
      {/* Rendered outside layout__chat so it's visible on mobile (FAB + popup) */}
      <ChatPanel mobile />
    </div>
  );
}
