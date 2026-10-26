// Supabase 의 영어 오류 메시지를 알아보기 쉬운 한국어로 바꾼다. 모르는 메시지는 그대로 보여준다.
export function authErrorMessage(error) {
  const m = (error?.message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (m.includes('already registered')) return '이미 가입된 이메일이에요. 로그인해 보세요.'
  if (m.includes('email not confirmed')) return '이메일 인증이 아직이에요. 메일함의 인증 링크를 눌러 주세요.'
  if (m.includes('rate limit') || m.includes('too many')) return '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.'
  if (m.includes('password') && m.includes('characters')) return '비밀번호는 6자 이상이어야 해요.'
  if (m.includes('valid email') || m.includes('invalid email')) return '이메일 형식이 올바르지 않아요.'
  if (m.includes('failed to fetch') || m.includes('network')) return '인터넷 연결을 확인해 주세요.'
  return error?.message || '알 수 없는 오류가 났어요.'
}
