// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 원자적 쓰기: 같은 폴더의 임시 파일(.dc-tmp-*)에 쓴 뒤 rename으로 바꾼다.
// 쓰는 도중 서버가 꺼져도 원본은 옛 내용이나 새 내용 중 하나로 남는다. 감시기는 .으로 시작하는 파일을 무시한다.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.dc-tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
  try {
    await fs.writeFile(tmp, text, "utf8");
    // 원래 파일의 권한을 지킨다
    const st = await fs.stat(file).catch(() => null);
    if (st) await fs.chmod(tmp, st.mode & 0o777);
    await renameRetry(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

/** Windows에서는 감시기·백신이 파일을 잠깐 잡고 있어 rename이 EPERM·EBUSY로 실패할 수 있다 → 조금 기다렸다 다시 */
async function renameRetry(from, to, tries = 6) {
  for (let i = 0; ; i++) {
    try {
      return await fs.rename(from, to);
    } catch (e) {
      if (i >= tries - 1 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
}

/** OS 경로(\\ 또는 /) → URL·board.json용 / 경로 */
export const toPosix = (rel, sep = path.sep) => rel.split(sep).join("/");
