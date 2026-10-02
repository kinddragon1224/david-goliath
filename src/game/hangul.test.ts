import assert from "node:assert/strict";
import { test } from "node:test";
import { backspaceJamo, typeJamo } from "./hangul.ts";

const type = (keys: string) => [...keys].reduce((s, k) => typeJamo(s, k), "");

test("기본 글자 조합", () => {
  assert.equal(type("ㄱㅣㅁㅁㅣㄴㅈㅜㄴ"), "김민준");
  assert.equal(type("ㅇㅣㅅㅓㅇㅠㄴ"), "이서윤");
  assert.equal(type("ㄷㅏㅇㅜㅣㅅ"), "다윗");
  assert.equal(type("ㄱㅗㄹㄹㅣㅇㅏㅅ"), "골리앗");
});

test("받침이 다음 글자로 넘어간다", () => {
  assert.equal(type("ㄱㅏㄱㅏ"), "가가");
  assert.equal(type("ㅎㅏㄴㅡㄹ"), "하늘");
});

test("겹받침과 겹모음", () => {
  assert.equal(type("ㄷㅏㄹㄱ"), "닭");
  assert.equal(type("ㄷㅏㄹㄱㅏ"), "달가");
  assert.equal(type("ㄱㅘ"), "과");
  assert.equal(type("ㅇㅢ"), "의");
});

test("쌍자음은 받침 불가한 것만 새 글자로", () => {
  assert.equal(type("ㅇㅏㅃㅏ"), "아빠");
  assert.equal(type("ㄲㅗㅊ"), "꽃");
});

test("지우기는 자모 하나씩", () => {
  let s = type("ㄷㅏㄹㄱ");
  s = backspaceJamo(s);
  assert.equal(s, "달");
  s = backspaceJamo(s);
  assert.equal(s, "다");
  s = backspaceJamo(s);
  assert.equal(s, "ㄷ");
  s = backspaceJamo(s);
  assert.equal(s, "");
  assert.equal(backspaceJamo("과"), "고");
});
