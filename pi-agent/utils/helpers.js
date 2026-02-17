/**
 * Helper utilities for PI Agent
 */

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function truncate(text, maxLength = 280) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
  formatDate,
  formatDuration,
  truncate
};
