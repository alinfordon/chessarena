'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function ShareButton({ username }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiază linkul profilului', url);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleShare}>
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? 'Copiat' : 'Share'}
    </Button>
  );
}
