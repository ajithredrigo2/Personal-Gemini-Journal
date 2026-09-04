import React, { useState } from 'react';
import {
  WebhookConfig,
  WebhookProvider,
  WebhookTrigger,
} from '../types';
import {
  Bell,
  X,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { saveWebhookConfig, deleteWebhookConfig, logAuditEvent, authedFetch } from '../firebase';

interface WebhookSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string | null;
  webhooks: WebhookConfig[];
}

export const WebhookSettingsModal: React.FC<WebhookSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  webhooks,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<WebhookProvider>('slack');
  const [url, setUrl] = useState('');
  const [trigger, setTrigger] = useState<WebhookTrigger>('all');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this integration');
      return;
    }
    if (!url.trim() || !url.startsWith('https://')) {
      setError('Please provide a valid HTTPS webhook URL');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const newWebhook: WebhookConfig = {
        id: `wh_${Date.now()}`,
        userId,
        name: name.trim(),
        provider,
        url: url.trim(),
        enabled: true,
        trigger,
        createdAt: new Date().toISOString(),
      };

      await saveWebhookConfig(userId, newWebhook);
      await logAuditEvent({
        eventType: 'webhook_dispatched',
        severity: 'info',
        actorId: userId,
        actorEmail: userEmail || 'user@local',
        details: `Configured new ${provider.toUpperCase()} notification webhook: "${name}"`,
      });

      setName('');
      setUrl('');
      setIsAdding(false);
    } catch (err: unknown) {
      console.warn('Failed to save webhook notice:', err);
      setError((err as Error)?.message || 'Failed to save webhook configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (wh: WebhookConfig) => {
    try {
      const updated: WebhookConfig = {
        ...wh,
        enabled: !wh.enabled,
      };
      await saveWebhookConfig(userId, updated);
    } catch (err) {
      console.warn('Failed to toggle webhook notice:', err);
    }
  };

  const handleDelete = async (webhookId: string, whName: string) => {
    try {
      await deleteWebhookConfig(userId, webhookId);
      await logAuditEvent({
        eventType: 'webhook_dispatched',
        severity: 'info',
        actorId: userId,
        actorEmail: userEmail || 'user@local',
        details: `Deleted webhook integration: "${whName}"`,
      });
    } catch (err) {
      console.warn('Failed to delete webhook notice:', err);
    }
  };

  const handleTestWebhook = async (wh: WebhookConfig) => {
    setTestingId(wh.id);
    setTestResult(null);
    try {
      const res = await authedFetch('/api/notifications/test', {
        method: 'POST',
        body: JSON.stringify({
          url: wh.url,
          provider: wh.provider,
          name: wh.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ id: wh.id, success: true, message: data.message || 'Notification delivered successfully!' });
      } else {
        setTestResult({ id: wh.id, success: false, message: data.error || 'Webhook test failed' });
      }
    } catch (err: unknown) {
      setTestResult({
        id: wh.id,
        success: false,
        message: (err as Error)?.message || 'Network error connecting to webhook endpoint',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div
      id="webhook-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1E1C]/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#262624] text-[#E8E6DF] rounded-2xl max-w-2xl w-full border border-[#484842] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#3D3D38] flex items-center justify-between bg-[#2F2F2B]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5A5A40]/40 border border-[#5A5A40]/60 flex items-center justify-center text-[#E8E6DF]">
              <Bell className="w-5 h-5 text-[#C4C3BA]" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-[#F5F5F0]">
                External Notifications & Webhooks
              </h2>
              <p className="text-xs text-[#A8A79E] font-sans">
                Automatically dispatch reflection summaries & action items to Slack or Discord
              </p>
            </div>
          </div>
          <button
            id="close-webhook-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#8C8B82] hover:text-[#E8E6DF] rounded-lg hover:bg-[#3D3D38] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Notification Directive Notice */}
          <div className="p-3.5 bg-[#1F1F1D] rounded-xl border border-[#3E3E38] text-xs flex items-start gap-3">
            <Radio className="w-4 h-4 text-[#9AC29F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-[#E8E6DF]">
                Server-Side Secure Dispatch Directive
              </span>
              <p className="text-[#A8A79E] leading-relaxed">
                All external webhooks are safely proxied through the backend Express server, keeping credentials protected from browser CORS constraints and preventing tampering.
              </p>
            </div>
          </div>

          {/* Webhook List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#C4C3BA] uppercase tracking-wider">
                Configured Endpoints ({webhooks.length})
              </span>
              {!isAdding && (
                <button
                  id="add-webhook-btn"
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[#5A5A40] text-white rounded-lg hover:bg-[#68684D] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Integration</span>
                </button>
              )}
            </div>

            {webhooks.length === 0 && !isAdding && (
              <div className="p-6 bg-[#1F1F1D] rounded-xl border border-dashed border-[#3D3D38] text-center space-y-2">
                <Bell className="w-6 h-6 text-[#73726B] mx-auto opacity-70" />
                <p className="text-xs text-[#A8A79E]">
                  No external notification channels configured yet.
                </p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="text-xs text-[#9AC29F] hover:underline font-medium inline-block mt-1 cursor-pointer"
                >
                  Connect Slack, Discord, or Custom Webhook &rarr;
                </button>
              </div>
            )}

            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="p-4 bg-[#1F1F1D] rounded-xl border border-[#3E3E38] space-y-3 transition-all hover:border-[#52524A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                        wh.provider === 'slack'
                          ? 'bg-[#E01E5A]/20 text-[#FF6B8B] border border-[#E01E5A]/40'
                          : wh.provider === 'discord'
                          ? 'bg-[#5865F2]/20 text-[#8EA1E1] border border-[#5865F2]/40'
                          : 'bg-[#5A5A40]/20 text-[#C4C3BA] border border-[#5A5A40]/40'
                      }`}
                    >
                      {wh.provider}
                    </span>
                    <span className="font-medium text-sm text-[#F5F5F0]">{wh.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        wh.enabled
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                          : 'bg-[#33332E] text-[#888] border border-[#444]'
                      }`}
                    >
                      {wh.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`test-wh-btn-${wh.id}`}
                      onClick={() => handleTestWebhook(wh)}
                      disabled={testingId === wh.id}
                      title="Send Test Notification"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#2F2F2B] hover:bg-[#3D3D38] text-[#E8E6DF] rounded-lg border border-[#484842] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3 h-3 text-[#9AC29F]" />
                      <span>{testingId === wh.id ? 'Sending...' : 'Test'}</span>
                    </button>
                    <button
                      id={`delete-wh-btn-${wh.id}`}
                      onClick={() => handleDelete(wh.id, wh.name)}
                      title="Delete Integration"
                      className="p-1.5 text-[#8C8B82] hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-mono text-[#8C8B82] truncate bg-[#161614] px-2.5 py-1.5 rounded-md border border-[#2D2D29]">
                  {wh.url}
                </div>

                <div className="flex items-center justify-between text-xs text-[#A8A79E] pt-1 border-t border-[#2F2F2B]">
                  <span className="capitalize">
                    Trigger: <strong className="text-[#E8E6DF]">{wh.trigger.replace(/_/g, ' ')}</strong>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <span>Enable</span>
                    <input
                      type="checkbox"
                      checked={wh.enabled}
                      onChange={() => handleToggle(wh)}
                      className="accent-[#5A5A40] rounded w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Test Feedback */}
                {testResult && testResult.id === wh.id && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/40 border border-rose-800/60 text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Webhook Form */}
          {isAdding && (
            <form
              onSubmit={handleSave}
              className="p-4 bg-[#1F1F1D] rounded-xl border border-[#5A5A40]/60 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-[#33332E] pb-2">
                <h3 className="text-xs font-bold text-[#E8E6DF] uppercase tracking-wider">
                  New Webhook Destination
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setError(null);
                  }}
                  className="text-xs text-[#8C8B82] hover:text-[#E8E6DF] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#C4C3BA] mb-1 font-medium">Integration Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Workspace Slack Channel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#2A2A26] border border-[#484842] rounded-lg text-xs text-[#F5F5F0] focus:outline-hidden focus:border-[#737255]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C4C3BA] mb-1 font-medium">Destination Platform</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as WebhookProvider)}
                    className="w-full px-3 py-2 bg-[#2A2A26] border border-[#484842] rounded-lg text-xs text-[#F5F5F0] focus:outline-hidden focus:border-[#737255]"
                  >
                    <option value="slack">Slack (Incoming Webhook / Block Kit)</option>
                    <option value="discord">Discord (Channel Webhook / Embeds)</option>
                    <option value="custom">Custom Webhook / HTTP Endpoint</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#C4C3BA] mb-1 font-medium">
                  Webhook URL (HTTPS)
                </label>
                <input
                  type="url"
                  placeholder={
                    provider === 'slack'
                      ? 'https://hooks.slack.com/services/...'
                      : provider === 'discord'
                      ? 'https://discord.com/api/webhooks/...'
                      : 'https://api.yourdomain.com/webhooks/journal'
                  }
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#2A2A26] border border-[#484842] rounded-lg text-xs font-mono text-[#F5F5F0] focus:outline-hidden focus:border-[#737255]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#C4C3BA] mb-1 font-medium">Trigger Condition</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as WebhookTrigger)}
                  className="w-full px-3 py-2 bg-[#2A2A26] border border-[#484842] rounded-lg text-xs text-[#F5F5F0] focus:outline-hidden focus:border-[#737255]"
                >
                  <option value="all">Every Saved Reflection</option>
                  <option value="action_items_only">Only when Action Items are extracted</option>
                  <option value="action_plan_only">Only for Action Plan Mode reflections</option>
                  <option value="deep_inquiry_only">Only for Deep Inquiry reflections</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-[#A8A79E] hover:text-[#E8E6DF] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#5A5A40] text-white rounded-lg hover:bg-[#68684D] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Webhook Integration'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3D3D38] bg-[#242421] flex items-center justify-between text-xs text-[#8C8B82]">
          <span className="flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Payloads adapt dynamically to Slack Block Kit & Discord Embeds
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#3D3D38] hover:bg-[#484842] text-[#E8E6DF] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
