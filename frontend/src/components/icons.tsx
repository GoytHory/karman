import type { ReactNode } from 'react';

const icon = (children: ReactNode, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const icons = {
  library: icon(<><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>),
  playlists: icon(<><path d="M4 6.5h9" /><path d="M4 11h9" /><path d="M4 15.5h6" /><path d="M17 12.5v6.2l4.4-3.1z" /></>),
  history: icon(<><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6V12l3 1.9" /></>),
  clock: icon(<><circle cx="12" cy="12" r="8.2" /><path d="M12 7.4V12l3.1 1.8" /></>),
  alert: icon(<><path d="M12 4.2 21 19.5H3z" /><path d="M12 9.6v4.2" /><path d="M12 16.8v.1" /></>),
  wrench: icon(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  settings: icon(<><path d="M4 7.5h8" /><path d="M17 7.5h3" /><path d="M4 16.5h4" /><path d="M13 16.5h7" /><circle cx="14.5" cy="7.5" r="2" /><circle cx="10.5" cy="16.5" r="2" /></>),
  logout: icon(<><path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" /><path d="M16 8.5l3.5 3.5-3.5 3.5" /><path d="M19.5 12H9.5" /></>),
  plus: icon(<><path d="M12 5.5v13" /><path d="M5.5 12h13" /></>),
  search: icon(<><circle cx="11" cy="11" r="6.4" /><path d="M15.8 15.8 20 20" /></>),
  menu: icon(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>),
  download: icon(<><path d="M12 4v10" /><path d="m8 10.5 4 4 4-4" /><path d="M4.5 19.5h15" /></>),
  close: icon(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>),
  chevronLeft: icon(<path d="M14.5 6l-6 6 6 6" />, 15),
  chevronRight: icon(<path d="M9.5 6l6 6-6 6" />, 15),
  thumbUp: icon(<><path d="M7 10.5v9" /><path d="M7 10.5 11.6 3.6a1.4 1.4 0 0 1 2.6.8V9.4h4.6a1.6 1.6 0 0 1 1.6 2l-1.2 6a1.6 1.6 0 0 1-1.6 1.4H7" /><path d="M7 19.5H4.4v-9H7" /></>, 17),
  thumbDown: icon(<><path d="M7 13.5v-9" /><path d="M7 13.5 11.6 20.4a1.4 1.4 0 0 0 2.6-.8v-5h4.6a1.6 1.6 0 0 0 1.6-2l-1.2-6a1.6 1.6 0 0 0-1.6-1.4H7" /><path d="M7 4.5H4.4v9H7" /></>, 17),
  trash: icon(<><path d="M4 6.5h16" /><path d="M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" /><path d="M6.6 6.5 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" /><path d="M10.5 10.5v6" /><path d="M13.5 10.5v6" /></>, 17),
  back: icon(<path d="M10 6l-6 6 6 6" />, 14),
  external: icon(<><path d="M8 6h10v10" /><path d="M18 6 7 17" /></>, 13),

  // плеер
  play: <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><path d="M8 5.2c0-.8.9-1.3 1.6-.9l9.4 6.2c.6.4.6 1.3 0 1.7l-9.4 6.2c-.7.4-1.6-.1-1.6-.9z" /></svg>,
  pause: <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.6" height="14" rx="1" /><rect x="13.4" y="5" width="3.6" height="14" rx="1" /></svg>,
  replay: <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4" /><path d="M4.3 4.6v4.2h4.2" /></svg>,
  skipBack: icon(<><path d="M4.2 12a7.8 7.8 0 1 0 2.4-5.6" /><path d="M4 4.4v4.4h4.4" /><path d="M10.6 9.4v5.2" /><path d="M15.4 9.4v5.2" /></>, 19),
  skipForward: icon(<><path d="M19.8 12a7.8 7.8 0 1 1-2.4-5.6" /><path d="M20 4.4v4.4h-4.4" /><path d="M10.6 9.4v5.2" /><path d="M15.4 9.4v5.2" /></>, 19),
  volume: icon(<><path d="M4.5 9.5h3L12 5.6v12.8L7.5 14.5h-3z" /><path d="M15.6 9.2a4 4 0 0 1 0 5.6" /><path d="M18.2 6.9a7.4 7.4 0 0 1 0 10.2" /></>, 17),
  volumeOff: icon(<><path d="M4.5 9.5h3L12 5.6v12.8L7.5 14.5h-3z" /><path d="m16 10 4 4" /><path d="m20 10-4 4" /></>, 17),
  pip: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="12" y="11.5" width="7" height="5.5" rx="1" /></>, 17),
  fullscreen: icon(<><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" /><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" /><path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" /></>, 17),
  fullscreenExit: icon(<><path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" /><path d="M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20" /><path d="M20 15h-3.5a1.5 1.5 0 0 0-1.5 1.5V20" /><path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" /></>, 17),
  next: icon(<><path d="M5 6.5l7 5.5-7 5.5z" /><path d="M18 6v12" /></>, 15),
  prev: icon(<><path d="M19 6.5 12 12l7 5.5z" /><path d="M6 6v12" /></>, 15),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7" />, 15),
  loading: <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="rgba(255,255,255,0.22)" strokeWidth="2.4" /><path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>,
};
