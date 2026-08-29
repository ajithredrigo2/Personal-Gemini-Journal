import React from 'react';
import { ShieldCheck, Lock, KeyRound, Cpu, Database, CheckCircle2, X, MapPin } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#3A3A35] text-[#F5F5F0] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#5A5A40]/40 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#5A5A40]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/30 border border-[#5A5A40]/50 flex items-center justify-center text-[#E8E6DF]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#F5F5F0]">
                Security Architecture & Privacy Directives
              </h2>
              <p className="text-xs text-[#B5B4AC] font-sans">
                Cloud Run • Secret Manager • Cloud Firestore Isolation
              </p>
            </div>
          </div>

          <button
            id="close-security-modal-btn"
            onClick={onClose}
            className="p-2 text-[#B5B4AC] hover:text-[#F5F5F0] rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6 text-xs text-[#E8E6DF]">
          {/* Firestore Security Rules Card */}
          <div className="bg-[#2D2D29] p-4 rounded-xl border border-[#5A5A40]/30">
            <div className="flex items-center gap-2 text-[#C4C3BA] font-semibold mb-2">
              <Database className="w-4 h-4 text-[#5A5A40]" />
              <span>Strict Firestore User Data Isolation</span>
            </div>
            <p className="text-[#B5B4AC] mb-2 leading-relaxed font-sans">
              Every document is stored under <code className="text-[#F5F5F0] bg-black/20 px-1.5 py-0.5 rounded font-mono">/users/&#123;userId&#125;/interactions/&#123;interactionId&#125;</code> and governed by owner-bound Firestore security rules:
            </p>
            <pre className="bg-[#1E1E1C] p-3 rounded-lg font-mono text-[11px] text-[#E8E6DF] overflow-x-auto border border-white/10">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`}
            </pre>
          </div>

          {/* Key Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#2D2D29] p-3.5 rounded-xl border border-[#5A5A40]/20">
              <div className="flex items-center gap-2 text-[#E8E6DF] font-semibold mb-1">
                <Lock className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Federated Identity</span>
              </div>
              <p className="text-[#B5B4AC] leading-relaxed text-[11px] font-sans">
                Authentication is outsourced entirely to Google Identity Services via Firebase Auth. No passwords are ever entered, handled, or stored.
              </p>
            </div>

            <div className="bg-[#2D2D29] p-3.5 rounded-xl border border-[#5A5A40]/20">
              <div className="flex items-center gap-2 text-[#E8E6DF] font-semibold mb-1">
                <KeyRound className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Zero Secret Exposure</span>
              </div>
              <p className="text-[#B5B4AC] leading-relaxed text-[11px] font-sans">
                Gemini API keys are never exposed to browser runtimes. All interactions are securely brokered via server-side API proxy routes.
              </p>
            </div>

            <div className="bg-[#2D2D29] p-3.5 rounded-xl border border-[#5A5A40]/20 sm:col-span-2">
              <div className="flex items-center gap-2 text-[#E8E6DF] font-semibold mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Location Privacy & Zero Auto-Tracking</span>
              </div>
              <p className="text-[#B5B4AC] leading-relaxed text-[11px] font-sans">
                No automatic GPS tracking. Users explicitly search and attach real places via Google Maps Places API. Location metadata (name, place ID, address, coordinates) is stored exclusively under the user's isolated Firestore document and can be removed at any time.
              </p>
            </div>

            <div className="bg-[#2D2D29] p-3.5 rounded-xl border border-[#5A5A40]/20 sm:col-span-2">
              <div className="flex items-center gap-2 text-[#E8E6DF] font-semibold mb-1">
                <Cpu className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Resilient Model Fallback Ladder</span>
              </div>
              <p className="text-[#B5B4AC] leading-relaxed text-[11px] font-sans">
                Automated graceful fallback matrix: <code className="text-[#F5F5F0] bg-black/20 px-1 py-0.5 rounded">gemini-3.6-flash</code> &rarr; <code className="text-[#F5F5F0] bg-black/20 px-1 py-0.5 rounded">gemini-3.1-flash-lite</code> &rarr; <code className="text-[#F5F5F0] bg-black/20 px-1 py-0.5 rounded">gemini-flash-latest</code> &rarr; <code className="text-[#F5F5F0] bg-black/20 px-1 py-0.5 rounded">gemini-3.7-flash</code> to guarantee uninterrupted service.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            id="security-modal-understand-btn"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
