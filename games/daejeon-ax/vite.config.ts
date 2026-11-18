import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // 하위 경로에 올려도 동작하도록 상대 경로
  build: {
    target: 'es2022',
    // three.js 가 들어간 메인 청크는 압축 전 약 660KB(gzip 약 175KB).
    // 이 프로젝트의 예산은 "JS gzip 합계 500KB 이하"이므로 압축 전 기준 경고선만 올려 둔다.
    chunkSizeWarningLimit: 800,
  },
  test: { include: ['src/**/*.test.ts'] },
});
