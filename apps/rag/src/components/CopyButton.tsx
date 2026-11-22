import { Button } from '@admin-web/ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** 复制一段文字到剪贴板；不支持剪贴板时什么也不做（文字本身仍可手动选择）。 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}
