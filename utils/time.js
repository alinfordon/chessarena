export function formatTime(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimeCompact(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (totalSeconds < 60) {
    return `${seconds}s`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 30) return 'just now';
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffHr < 1) return `${diffMin}m ago`;
  if (diffDay < 1) return `${diffHr}h ago`;
  if (diffMonth < 1) return `${diffDay}d ago`;
  if (diffYear < 1) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

export const TIME_CONTROLS = [
  { label: '1+0', initialTime: 60, increment: 0 },
  { label: '2+1', initialTime: 120, increment: 1 },
  { label: '3+0', initialTime: 180, increment: 0 },
  { label: '3+2', initialTime: 180, increment: 2 },
  { label: '5+0', initialTime: 300, increment: 0 },
  { label: '5+3', initialTime: 300, increment: 3 },
  { label: '10+0', initialTime: 600, increment: 0 },
  { label: '10+5', initialTime: 600, increment: 5 },
  { label: '15+10', initialTime: 900, increment: 10 },
  { label: '30+0', initialTime: 1800, increment: 0 },
];
