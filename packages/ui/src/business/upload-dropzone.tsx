import { cn } from 'cn';
import { Upload } from 'lucide-react';
import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type UploadDropzoneProps = {
  /** 文件选择框的可访问名称，也是区域里的主文字。 */
  label: string;
  /** 与 <input accept> 相同的写法；拖入的文件也按它检查。 */
  accept: string;
  maxFiles?: number;
  /** 返回错误信息表示不接受这个文件；先于 accept 检查，信息更具体。 */
  validate?: (file: File) => string | undefined;
  onFiles: (files: File[]) => void;
  hint?: ReactNode;
  disabled?: boolean;
};

/** 按 accept 的写法（扩展名、MIME、image/*）检查文件，与文件选择框的过滤一致。 */
export function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/** 拖入或点击选择文件；逐个检查，不合格时显示原因、不交出文件。超出 maxFiles 的只取前面的。 */
export function UploadDropzone({
  label,
  accept,
  maxFiles = 1,
  validate,
  onFiles,
  hint,
  disabled = false,
}: UploadDropzoneProps) {
  const { t } = useTranslation('common');
  const inputId = useId();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, maxFiles);
    for (const file of files) {
      const message =
        validate?.(file) ??
        (matchesAccept(file, accept) ? undefined : t('upload.invalidType'));
      if (message) {
        setError(message);
        return;
      }
    }
    setError(undefined);
    if (files.length > 0) onFiles(files);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) take(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        id={inputId}
        aria-label={label}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={disabled}
        className="peer sr-only"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          dragging ? 'border-primary bg-accent' : 'hover:bg-accent/50',
        )}
      >
        <Upload aria-hidden className="size-6 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {hint ?? t('upload.dropHint')}
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
