// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 마일스톤별로 붙는 추가 API와 감시기. createServer의 extraRoutes로 들어간다.
import { watchDesign } from "./watch.mjs";

export const extraRoutes = [];

/** 서버가 뜬 뒤 붙일 것(파일 감시 등) */
export async function attach(app) {
  const stop = watchDesign(app.ctx);
  const close = app.close;
  app.close = async () => {
    await stop();
    await close();
  };
}
