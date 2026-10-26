-- 실험 저장용 표와 보안 규칙. Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 한다.
-- 한 번만 실행하면 된다. (이미 만들었다면 다시 실행하지 말 것: "already exists" 오류가 난다)
--
-- 설계: 실험 하나 = 표의 한 줄. 블록들은 blocks 칸(JSON) 안에 순서대로 들어 있다.
-- 블록마다 필요한 정보가 달라서(측정/계산/그래프) 칸을 나누지 않고 JSON 으로 둔다.
-- 계산 결과는 저장하지 않는다. 원본(측정값·수식·축 설정)만 두고 열 때마다 다시 계산한다.

create table experiments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default '새 실험',
  angle_unit text not null default 'deg' check (angle_unit in ('deg', 'rad')),
  blocks jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 행 단위 보안(RLS) 켜기. 켜면 아래 정책이 허용하는 것만 가능하다.
alter table experiments enable row level security;

-- auth.uid() 는 "지금 로그인한 사용자의 id". 자기 것(user_id 가 같은 줄)만 허용한다.
create policy "내 실험만 읽기" on experiments for select using (auth.uid() = user_id);
create policy "내 실험만 만들기" on experiments for insert with check (auth.uid() = user_id);
create policy "내 실험만 고치기" on experiments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "내 실험만 지우기" on experiments for delete using (auth.uid() = user_id);
