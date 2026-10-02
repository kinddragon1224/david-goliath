/** 오프라인 설치판 진입점. 서버 렌더링 없이 게임 화면만 띄운다. */
import { createRoot } from "react-dom/client";
import { GameApp } from "../src/game/GameApp";
import "../src/styles.css";

const el = document.getElementById("app");
if (el) {
  createRoot(el).render(<GameApp />);
}
