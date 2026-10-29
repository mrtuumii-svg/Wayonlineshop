-- Каталогийн `q` хайлт: lower(... COLLATE "und-x-icu") LIKE '%q%'.
-- ICU collation-ийг тодорхой заасан тул DB-ийн locale (C, en_US, ...) ямар ч байсан
-- кирилл/монгол үсгийн (Ү, Ө) том-жижиг ялгаагүй хайлт ажиллана.
-- Индексийн илэрхийлэл нь query-тэй яг ижил байх ёстой (src/catalog/search.ts).
-- Анхаар: pg_trgm нь DB-ийн LC_CTYPE-аар үсгийг таньдаг. UTF-8 locale (en_US.utf8, C.UTF-8 — docker
-- болон ихэнх managed Postgres) дээр кирилл trigram үүснэ. LC_CTYPE=C бол хайлт зөв ажилласаар
-- боловч индекс кирилл үгэнд үр ашиггүй болно.
-- Багана бүр тусдаа индекстэй, query нь UNION — OR-оор нийлүүлбэл индекс ашиглагдахгүй.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Course_title_trgm_idx" ON "Course" USING GIN (lower("title" COLLATE "und-x-icu") gin_trgm_ops);
CREATE INDEX "Course_description_trgm_idx" ON "Course" USING GIN (lower("description" COLLATE "und-x-icu") gin_trgm_ops);
CREATE INDEX "Course_category_trgm_idx" ON "Course" USING GIN (lower("category" COLLATE "und-x-icu") gin_trgm_ops);
CREATE INDEX "Instructor_name_trgm_idx" ON "Instructor" USING GIN (lower("name" COLLATE "und-x-icu") gin_trgm_ops);
