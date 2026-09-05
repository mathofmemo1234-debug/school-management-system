// Real-time BroadcastChannel bridge for instant cross-tab synchronization
const CHANNEL_NAME = 'msc_realtime_sync_channel';

let channel = null;
try {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported:', e);
}

export function broadcastRealtimeEvent(type, payload) {
  const eventData = { type, payload, timestamp: Date.now() };
  if (channel) {
    try {
      channel.postMessage(eventData);
    } catch (e) {}
  }
  // Fallback via localStorage storage event
  try {
    localStorage.setItem('msc_last_broadcast_event', JSON.stringify(eventData));
  } catch (e) {}
}

export function subscribeRealtimeEvents(callback) {
  const handleMsg = (e) => {
    if (e?.data) callback(e.data);
  };

  const handleStorage = (e) => {
    if (e.key === 'msc_last_broadcast_event' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch (err) {}
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMsg);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel) channel.removeEventListener('message', handleMsg);
    window.removeEventListener('storage', handleStorage);
  };
}
