// 블록·실험마다 겹치지 않는 고유 id를 만든다. (브라우저 내장 기능)
export const uid = () => crypto.randomUUID()
