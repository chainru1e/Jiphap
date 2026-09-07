-- 0003_event_trigger_ensure_rls.sql — RLS 자동 활성화 이벤트 트리거
--
-- 이것은 안전망이지 통제 수단이 아니다.
-- 실제 통제는 각 마이그레이션이 명시적으로 적는 enable row level security가 한다.
-- 0001은 이 트리거가 없어도 스스로 다섯 테이블의 RLS를 켠다. 반대로 이 트리거만 믿고
-- 마이그레이션에서 그 문장을 빼면, 트리거가 꺼졌거나 없는 프로젝트에서 테이블이
-- 그대로 열린다. 그래서 0001의 다섯 줄은 중복이 아니고, 지우지 않는다.
--
-- 이 트리거는 정책을 만들지 않는다. RLS를 켜기만 한다.
-- RLS 켜짐 + 정책 0개 = 전면 차단이므로, 켜는 것만으로 데이터는 새지 않는다.
--
-- 출처: Supabase 대시보드의 옵트인 기능
--   Authentication > Auto-enable RLS for new tables
-- 를 이 프로젝트에서 켜서 생성된 것이다. Supabase의 기본값이 아니다.
-- 아래 함수 본문은 그렇게 만들어진 실제 정의(pg_get_functiondef 출력)를 그대로 옮긴 것이다.
-- supabase/migrations/ 만으로 같은 상태를 재현할 수 있게 하려고 남긴다.
--
-- 이 프로젝트에는 이미 적용돼 있다. 다시 실행해도 결과는 같다(멱등).
-- 새 프로젝트라면 대시보드 토글을 켜는 쪽이 정석이고, 이 파일은 그 경로가 막혔을 때 쓴다.
-- 이벤트 트리거 생성에는 그에 맞는 권한이 필요하므로 SQL Editor(postgres 롤)에서 실행한다.
--
-- 참고: 원본 트리거에 when tag in (...) 필터가 붙어 있는지는 확인하지 않았다.
-- 함수가 본문에서 command_tag를 직접 거르므로 필터 유무와 무관하게 동작은 같다.
-- 정확히 대조하려면: select evtname, evttags from pg_event_trigger where evtname='ensure_rls';

drop event trigger if exists ensure_rls;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();
