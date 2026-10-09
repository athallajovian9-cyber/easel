// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 자산 보관함: docs/design/assets/의 이미지·폰트 목록, 올리기(단추·끌어 놓기), 고르기(이미지 바꾸기).
import { useCallback, useEffect, useState } from "react";

import { api } from "./api";
import { Icon } from "./icons";

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

/** 목록(왼쪽 패널 탭이나 고르기 창 안) */
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
        <Icon name="plus" size={14} /> {busy ? "올리는 중…" : "올리기 (이미지·폰트, 끌어 놓기도 돼요)"}
        <input type="file" hidden multiple accept="image/*,.woff,.woff2,.ttf,.otf" onChange={(e) => e.target.files && void up(e.target.files)} />
      </label>
      {list == null ? (
        <p className="empty">
          <span className="spinner" aria-hidden="true" /> 불러오는 중…
        </p>
      ) : shown.length === 0 ? (
        <p className="empty">자산이 없어요. 이미지를 올리면 docs/design/assets/에 저장되고 화면에서 ../assets/이름 으로 써요.</p>
      ) : (
        <ul className="asset-grid">
          {shown.map((a) => (
            <li key={a.name}>
              <button
                className="asset"
                title={`${a.ref} · ${kb(a.size)}${p.onPick ? "" : " · 누르면 경로 복사"}`}
                aria-label={`${a.name}${p.pickLabel ?? ""}`}
                onClick={() => (p.onPick ? p.onPick(a) : void navigator.clipboard.writeText(a.ref).catch(() => {}))}
              >
                {a.kind === "image" ? <img src={a.url} alt="" loading="lazy" /> : <span className="asset-font">{a.kind === "font" ? "Aa" : "파일"}</span>}
                <span className="asset-name">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 이미지 바꾸기 창 */
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
      <div className="dialog wide" role="dialog" aria-modal="true" aria-label="이미지 고르기">
        <h2>이미지 고르기</h2>
        <AssetGrid version={version} only="image" pickLabel="(으)로 바꾸기" onPick={onPick} onError={onError} onUploaded={(a) => a[0] && a[0].kind === "image" && onPick(a[0])} />
        <div className="dialog-actions">
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
