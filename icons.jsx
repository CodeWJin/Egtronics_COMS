// Simple inline-SVG icons (no external deps)
const Icon = ({ name, size = 16, stroke = 1.6, ...rest }) => {
  const S = size;
  const common = {
    width: S, height: S, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    ...rest,
  };
  switch (name) {
    case 'check':       return <svg {...common}><path d="M4 12l5 5L20 6"/></svg>;
    case 'x':           return <svg {...common}><path d="M5 5l14 14M19 5L5 19"/></svg>;
    case 'search':      return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'plus':        return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevron-down':return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-up':  return <svg {...common}><path d="M6 15l6-6 6 6"/></svg>;
    case 'chevron-right':return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-left':  return <svg {...common}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>;
    case 'barcode':     return <svg {...common}><path d="M4 6v12M7 6v12M10 6v12M13 6v12M16 6v12M19 6v12"/></svg>;
    case 'map-pin':     return <svg {...common}><path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'calendar':    return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'filter':      return <svg {...common}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case 'table':       return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 16h18M9 4v16M15 4v16"/></svg>;
    case 'grid':        return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
    case 'columns':     return <svg {...common}><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="16" rx="1.5"/><rect x="17" y="4" width="4" height="16" rx="1.5"/></svg>;
    case 'timeline':    return <svg {...common}><path d="M5 4v16"/><circle cx="5" cy="8" r="2"/><circle cx="5" cy="16" r="2"/><path d="M9 8h11M9 16h7"/></svg>;
    case 'package':     return <svg {...common}><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>;
    case 'factory':     return <svg {...common}><path d="M3 21V11l5 3V11l5 3V11l5 3v7z"/><path d="M3 21h18"/></svg>;
    case 'cart':        return <svg {...common}><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-8H6"/></svg>;
    case 'sparkle':     return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l3 3M15.5 15.5l3 3M5.5 18.5l3-3M15.5 8.5l3-3"/></svg>;
    case 'shield':      return <svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'bolt':        return <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>;
    case 'wifi':        return <svg {...common}><path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19.5" r="1"/></svg>;
    case 'cable':       return <svg {...common}><path d="M5 3v4a4 4 0 008 0V3M11 21v-4a4 4 0 018 0v4M5 3h4M15 3h4M9 21h4"/></svg>;
    case 'cpu':         return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>;
    case 'building':    return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>;
    case 'user':        return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case 'bell':        return <svg {...common}><path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></svg>;
    case 'alert':       return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16v.5"/></svg>;
    case 'info':        return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/></svg>;
    case 'lock':        return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>;
    case 'eye':         return <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'list':        return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01"/></svg>;
    case 'doc':         return <svg {...common}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>;
    case 'save':        return <svg {...common}><path d="M5 5v14h14V8l-3-3H5z"/><path d="M8 5v5h8V5M8 19v-6h8v6"/></svg>;
    case 'refresh':     return <svg {...common}><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>;
    case 'tag':         return <svg {...common}><path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>;
    case 'spark':       return <svg {...common}><path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/></svg>;
    case 'menu-dots':   return <svg {...common}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    case 'fire':        return <svg {...common}><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 1-2 2-3 2 0-3 2-5 2-8-3 1-7 4-7 9 0 3-3 4-3 9 0 4 3 7 7 7z"/></svg>;
    case 'download':    return <svg {...common}><path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>;
    case 'printer':     return <svg {...common}><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M8 17h8v4H8z"/></svg>;
    case 'clock':       return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
    case 'sliders':     return <svg {...common}><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>;
    case 'truck':       return <svg {...common}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>;
    case 'phone':       return <svg {...common}><path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2C8 21 3 8 3 5a2 2 0 012-2z"/></svg>;
    case 'settings':    return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'hash':        return <svg {...common}><path d="M5 9h14M5 15h14M9 4l-1.5 16M16.5 4L15 20"/></svg>;
    case 'external':    return <svg {...common}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>;
    case 'copy':        return <svg {...common}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/></svg>;
    case 'trash':       return <svg {...common}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
    case 'edit':        return <svg {...common}><path d="M11 4H6a2 2 0 00-2 2v13a2 2 0 002 2h13a2 2 0 002-2v-5"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'users':       return <svg {...common}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
    default: return <svg {...common}/>;
  }
};

window.Icon = Icon;
