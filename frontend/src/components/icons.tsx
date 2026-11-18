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
};
