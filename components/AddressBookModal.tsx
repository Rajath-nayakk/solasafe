"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, User, Copy, Check, AlertCircle } from "lucide-react";
import { isValidSolanaAddress, truncateAddress } from "@/lib/solana";
import { Contact } from "@/lib/types";

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onAddContact: (contact: Contact) => void;
  onRemoveContact: (name: string) => void;
}

export function AddressBookModal({
  isOpen,
  onClose,
  contacts,
  onAddContact,
  onRemoveContact,
}: AddressBookModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setError("Please enter a contact name.");
      return;
    }

    if (contacts.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError(`A contact named "${trimmedName}" already exists.`);
      return;
    }

    if (!isValidSolanaAddress(trimmedAddress)) {
      setError("Please enter a valid Solana public key (base58, on ed25519 curve).");
      return;
    }

    onAddContact({
      name: trimmedName,
      address: trimmedAddress,
      addedAt: Date.now(),
    });

    setName("");
    setAddress("");
  };

  const handleCopy = (contact: Contact) => {
    navigator.clipboard.writeText(contact.address);
    setCopiedName(contact.name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0c101d] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Address Book</h2>
              <p className="text-[11px] text-zinc-400">Map names to verified Solana addresses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Add Contact Form */}
          <form onSubmit={handleAdd} className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/[0.06]">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Add New Contact
            </h3>
            {error && (
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <input
                type="text"
                placeholder='Contact Name (e.g. "Amit", "Bob")'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#121626] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Solana Base58 Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#121626] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 solana-gradient-btn font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Contact</span>
            </button>
          </form>

          {/* Contact List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Saved Contacts ({contacts.length})</span>
              <span className="text-[11px] text-zinc-500">Stored in localStorage</span>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs">
                No contacts saved yet. Add one above!
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {contacts.map((c) => (
                  <div
                    key={c.name}
                    className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between gap-3 group hover:border-white/[0.12] transition"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white">{c.name}</div>
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <span>{truncateAddress(c.address, 6)}</span>
                        <button
                          onClick={() => handleCopy(c)}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 transition"
                          title="Copy address"
                        >
                          {copiedName === c.name ? (
                            <Check className="w-3 h-3 text-[#14F195]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveContact(c.name)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/[0.06] transition"
                      title="Remove contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
