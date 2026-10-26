// Supabase 연결. 주소와 키는 코드에 쓰지 않고 .env 에서 읽는다.
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
// Vite 는 VITE_ 로 시작하는 값만 브라우저 코드에 넣어준다. 그래서 여기엔 공개돼도 되는
// publishable 키만 쓴다 (실제 보안은 DB의 RLS 규칙이 맡는다). secret/service_role 키는 절대 넣지 않는다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// 값이 없으면 연결을 만들지 않고, 화면에서 안내 문구를 보여준다.
export const supabaseConfigured = Boolean(url && key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
