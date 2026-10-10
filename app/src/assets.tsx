// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Asset library: images and fonts in docs/design/assets/, upload (button or drag and drop), pick (replace image).
import { useCallback, useEffect, useState } from "react";

import { api } from "./api";
import { Icon } from "./icons";
import { strings } from "./strings";

export type Asset = { name: string; size: number; kind: "image" | "font" | "file"; url: string; ref: string };

export function useAssets(version: number) {
  const [list, setList] = useState<Asset[] | null>(null);
  const reload = useCallback(() => api.get<{ assets: Asset[] }>("/api/assets").then((r) => setList(r.assets)).catch(() => setList([])), []);
  useEffect(() => {
    void reload();
  }, [reload, version]);
  return { list, reload };
}

export async function uploadAssets(files: FileList | File[]) {
  const out: Asset[] = [];
  for (const f of Array.from(files)) {
    const data = await new Promise<string>((res) => {
      const rd = new FileReader();
      rd.onload = () => res(String(rd.result).split(",")[1] ?? "");
      rd.readAsDataURL(f);
    });
    out.push(await api.post<Asset>("/api/assets", { name: f.name, data }));
  }
  return out;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** Grid (in the left panel tab or inside the picker dialog) */
export function AssetGrid(p: { version: number; onPick?: (a: Asset) => void; pickLabel?: string; onError: (msg: string) => void; onUploaded?: (a: Asset[]) => void; only?: "image" }) {
  const { list, reload } = useAssets(p.version);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const up = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      const made = await uploadAssets(files);
      await reload();
      p.onUploaded?.(made);
    } catch (e) {
      p.onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shown = (list ?? []).filter((a) => !p.only || a.kind === p.only);
  return (
    <div
      className={`assets ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) void up(e.dataTransfer.files);
      }}
    >
      <label className="upload">
        <Icon name="plus" size={14} /> {busy ? strings.assets.uploading : strings.assets.upload}
        <input type="file" hidden multiple accept="image/*,.woff,.woff2,.ttf,.otf" onChange={(e) => e.target.files && void up(e.target.files)} />
      </label>
      {list == null ? (
        <p className="empty">
          <span className="spinner" aria-hidden="true" /> {strings.assets.loading}
        </p>
      ) : shown.length === 0 ? (
        <p className="empty">{strings.assets.empty}</p>
      ) : (
        <ul className="asset-grid">
          {shown.map((a) => (
            <li key={a.name}>
              <button
                className="asset"
                title={`${a.ref} · ${kb(a.size)}${p.onPick ? "" : strings.assets.copyPath}`}
                aria-label={`${a.name}${p.pickLabel ?? ""}`}
                onClick={() => (p.onPick ? p.onPick(a) : void navigator.clipboard.writeText(a.ref).catch(() => {}))}
              >
                {a.kind === "image" ? <img src={a.url} alt="" loading="lazy" /> : <span className="asset-font">{a.kind === "font" ? "Aa" : strings.assets.file}</span>}
                <span className="asset-name">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Replace image dialog */
export function AssetPicker({ open, version, onClose, onPick, onError }: { open: boolean; version: number; onClose: () => void; onPick: (a: Asset) => void; onError: (m: string) => void }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-label={strings.assets.pickImage}>
        <h2>{strings.assets.pickImage}</h2>
        <AssetGrid version={version} only="image" pickLabel={strings.assets.pickLabel} onPick={onPick} onError={onError} onUploaded={(a) => a[0] && a[0].kind === "image" && onPick(a[0])} />
        <div className="dialog-actions">
          <button onClick={onClose}>{strings.assets.close}</button>
        </div>
      </div>
    </div>
  );
}
