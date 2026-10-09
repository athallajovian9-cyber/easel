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
    await fs.rename(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
