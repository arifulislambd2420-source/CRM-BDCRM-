/**
 * Unified Inbox — WhatsApp + Messenger conversations in a single view.
 *
 * Layout:
 *   Left panel  — conversation list (sorted by lastMessageAt desc)
 *   Center      — message thread
 *   Right panel — customer info + link-customer action
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, User, Search, RefreshCw, Link } from 'lucide-react';
import { apiFetch } from '../services/api';
import type { Conversation, Message } from '../types';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800',
  messenger: 'bg-blue-100 text-blue-800',
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function listConversations(channel?: string): Promise<Conversation[]> {
  const q = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return apiFetch(`/api/conversations${q}`);
}

async function getConversation(id: string): Promise<Conversation> {
  return apiFetch(`/api/conversations/${encodeURIComponent(id)}`);
}

async function markRead(id: string): Promise<void> {
  await apiFetch(`/api/conversations/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

async function sendMessage(id: string, text: string): Promise<Message> {
  return apiFetch(`/api/conversations/${encodeURIComponent(id)}/send`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

async function linkCustomer(convId: string, customerId: string): Promise<void> {
  await apiFetch(`/api/conversations/${encodeURIComponent(convId)}/link-customer`, {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConversations(channelFilter || undefined);
      setConversations(data);
    } finally {
      setLoading(false);
    }
  }, [channelFilter]);

  useEffect(() => { load(); }, [load]);

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setDraftText('');
    setLinkInput('');
    setLinkError('');
    const conv = await getConversation(id);
    setActive(conv);
    if (conv.unreadCount > 0) {
      await markRead(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
      );
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  const handleSend = async () => {
    if (!active || !draftText.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(active.id, draftText.trim());
      setActive((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setDraftText('');
    } catch (err: any) {
      alert('পাঠানো ব্যর্থ: ' + (err?.message ?? 'অজানা ত্রুটি'));
    } finally {
      setSending(false);
    }
  };

  const handleLink = async () => {
    if (!active || !linkInput.trim()) return;
    setLinkBusy(true);
    setLinkError('');
    try {
      await linkCustomer(active.id, linkInput.trim());
      const refreshed = await getConversation(active.id);
      setActive(refreshed);
      setLinkInput('');
    } catch {
      setLinkError('কাস্টমার আইডি পাওয়া যায়নি। সঠিক ID দিন।');
    } finally {
      setLinkBusy(false);
    }
  };

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.remoteId.includes(q) ||
      c.customer?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex" style={{ minHeight: 0 }}>
      {/* ── Conversation list ────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900 text-sm">ইনবক্স</h2>
            <button
              onClick={load}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="রিফ্রেশ"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="খুঁজুন…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">সব চ্যানেল</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="messenger">Messenger</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">লোড হচ্ছে…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">কোনো কথোপকথন নেই</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedId === conv.id ? 'bg-teal-50 border-l-2 border-l-teal-500' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sm font-medium text-navy-900 truncate">
                    {conv.customer?.name ?? conv.displayName}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 bg-teal-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${CHANNEL_COLORS[conv.channel] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {CHANNEL_LABELS[conv.channel] ?? conv.channel}
                  </span>
                  <span className="text-xs text-gray-400 truncate">{conv.remoteId}</span>
                </div>
                {conv.messages[0]?.body && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{conv.messages[0].body}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Message thread ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">একটি কথোপকথন বেছে নিন</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">
                <User size={18} />
              </div>
              <div>
                <div className="font-medium text-sm text-navy-900">
                  {active.customer?.name ?? active.displayName}
                </div>
                <div className="text-xs text-gray-400">
                  {CHANNEL_LABELS[active.channel]} · {active.remoteId}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {active.messages.length === 0 && (
                <p className="text-center text-sm text-gray-400">কোনো বার্তা নেই</p>
              )}
              {active.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-xl text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-teal-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {msg.body ?? <em className="opacity-60">[মিডিয়া: {msg.mediaType}]</em>}
                    <div className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-teal-200' : 'text-gray-400'}`}>
                      {new Date(msg.sentAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div className="p-3 bg-white border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="বার্তা লিখুন…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!draftText.trim() || sending}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Customer panel ───────────────────────────────────── */}
      {active && (
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">কাস্টমার</h3>
            {active.customer ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-navy-900">{active.customer.name}</p>
                <p className="text-xs text-gray-500">{active.customer.phone}</p>
                <a
                  href={`/customers/${active.customer.id}`}
                  className="text-xs text-teal-600 hover:underline"
                >
                  প্রোফাইল দেখুন →
                </a>
              </div>
            ) : (
              <p className="text-xs text-gray-400">কোনো কাস্টমার লিঙ্ক করা নেই</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Link size={12} /> কাস্টমার লিঙ্ক
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              কাস্টমার ID দিয়ে এই কথোপকথন লিঙ্ক করুন
            </p>
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Customer ID"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 mb-1.5"
            />
            {linkError && <p className="text-xs text-red-500 mb-1.5">{linkError}</p>}
            <button
              onClick={handleLink}
              disabled={!linkInput.trim() || linkBusy}
              className="w-full text-xs bg-teal-600 text-white rounded px-2 py-1.5 hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {linkBusy ? 'সংযুক্ত করছে…' : 'লিঙ্ক করুন'}
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">চ্যানেল</h3>
            <span className={`text-xs px-2 py-1 rounded ${CHANNEL_COLORS[active.channel] ?? 'bg-gray-100'}`}>
              {CHANNEL_LABELS[active.channel]}
            </span>
            <p className="text-xs text-gray-400 mt-1 break-all">{active.remoteId}</p>
          </div>
        </div>
      )}
    </div>
  );
}
